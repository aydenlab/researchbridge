import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, researcherFields, researcherProfiles, users } from "@/db";
import { applyFacultyImport, listUnclaimedFaculty, planFacultyImport } from "@/lib/faculty/import";
import { parseCsv, splitAreas } from "@/lib/faculty/csv";
import { ensureInstitution, createStudent } from "../fixtures";

function csv(rows: string[]): string {
  return rows.join("\n");
}

function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}@example.edu`;
}

async function profileFor(email: string) {
  const rows = await db
    .select({ profile: researcherProfiles, user: users })
    .from(users)
    .innerJoin(researcherProfiles, eq(researcherProfiles.userId, users.id))
    .where(eq(users.email, email))
    .limit(1);
  return rows[0] ?? null;
}

describe("reading a faculty list", () => {
  it("handles quoted commas and quoted newlines, which is what breaks a naive split", () => {
    const { rows } = parseCsv(
      csv([
        "email,first name,last name,biography",
        `a@example.edu,Ada,Lovelace,"Works on notes, engines, and ""analytical"" machines"`,
        `b@example.edu,Alan,Turing,"First line\nSecond line"`,
      ]),
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].biography).toBe('Works on notes, engines, and "analytical" machines');
    expect(rows[1].biography).toBe("First line\nSecond line");
  });

  it("matches columns whatever the export called them", async () => {
    const email = uniqueEmail("headers");
    const { outcomes } = await planFacultyImport(
      csv(["Given Name,Surname,Mail,Dept,Expertise", `Grace,Hopper,${email},Computing,"Compilers; Naval systems"`]),
    );

    expect(outcomes).toHaveLength(1);
    const [outcome] = outcomes;
    expect(outcome.status).toBe("ready");
    if (outcome.status !== "ready") return;
    expect(outcome.candidate.firstName).toBe("Grace");
    expect(outcome.candidate.email).toBe(email);
    expect(outcome.candidate.department).toBe("Computing");
    expect(outcome.candidate.researchAreas).toEqual(["Compilers", "Naval systems"]);
  });

  it("splits research areas on the separators exports actually use", () => {
    expect(splitAreas("Cardiology; Epidemiology")).toEqual(["Cardiology", "Epidemiology"]);
    expect(splitAreas("Cardiology|Epidemiology")).toEqual(["Cardiology", "Epidemiology"]);
    expect(splitAreas("Cardiology, Epidemiology")).toEqual(["Cardiology", "Epidemiology"]);
  });

  it("rejects a row rather than importing half a person", async () => {
    const { outcomes } = await planFacultyImport(
      csv(["email,first name,last name", "not-an-email,Ada,Lovelace", `${uniqueEmail("noname")},,Lovelace`]),
    );

    expect(outcomes.every((outcome) => outcome.status === "rejected")).toBe(true);
    expect(outcomes[0].status === "rejected" && outcomes[0].reason).toContain("valid email");
    expect(outcomes[1].status === "rejected" && outcomes[1].reason).toContain("name");
  });

  it("catches the same person listed twice in one file", async () => {
    const email = uniqueEmail("dupe");
    const { outcomes } = await planFacultyImport(
      csv(["email,first name,last name", `${email},Ada,Lovelace`, `${email},Ada,Lovelace`]),
    );

    expect(outcomes[0].status).toBe("ready");
    expect(outcomes[1].status === "rejected" && outcomes[1].reason).toContain("more than once");
  });

  it("writes nothing while planning", async () => {
    const email = uniqueEmail("dryrun");
    await planFacultyImport(csv(["email,first name,last name", `${email},Ada,Lovelace`]));
    expect(await profileFor(email)).toBeNull();
  });
});

describe("importing a faculty list", () => {
  it("creates a pending, verified, pre-filled account", async () => {
    await ensureInstitution();
    const email = uniqueEmail("import");

    const result = await applyFacultyImport(
      csv([
        "email,first name,last name,title,department,lab,research areas,bio",
        `${email},Rosalind,Franklin,Professor,Biochemistry,Diffraction Group,"Crystallography; Virology",Studies molecular structure.`,
      ]),
      { source: "mcmaster_experts" },
    );

    expect(result.created).toBe(1);
    expect(result.rejected).toBe(0);

    const row = await profileFor(email);
    expect(row).not.toBeNull();
    if (!row) return;

    expect(row.user.role).toBe("researcher");
    // Pending until they sign in: an imported row is an invitation, not a user.
    expect(row.user.accountStatus).toBe("pending");
    expect(row.user.onboardingCompletedAt).toBeNull();
    expect(row.profile.firstName).toBe("Rosalind");
    expect(row.profile.title).toBe("Professor");
    expect(row.profile.researcherType).toBe("professor");
    expect(row.profile.labName).toBe("Diffraction Group");
    expect(row.profile.verificationStatus).toBe("verified");
    expect(row.profile.prefilledSource).toBe("mcmaster_experts");
    expect(row.profile.claimedAt).toBeNull();

    const areas = await db
      .select()
      .from(researcherFields)
      .where(eq(researcherFields.researcherId, row.user.id));
    expect(areas).toHaveLength(2);
  });

  it("adds a scheme to a bare website rather than dropping it", async () => {
    const email = uniqueEmail("website");
    await applyFacultyImport(
      csv(["email,first name,last name,lab website", `${email},Barbara,McClintock,cytogenetics.example.edu`]),
      { source: "faculty_list" },
    );

    const row = await profileFor(email);
    expect(row?.profile.labWebsite).toBe("https://cytogenetics.example.edu");
  });

  it("refreshes an unclaimed profile on a re-import", async () => {
    const email = uniqueEmail("refresh");
    await applyFacultyImport(csv(["email,first name,last name,title", `${email},Jane,Goodall,Lecturer`]), {
      source: "faculty_list",
    });

    const second = await applyFacultyImport(
      csv(["email,first name,last name,title", `${email},Jane,Goodall,Professor`]),
      { source: "mcmaster_experts" },
    );

    expect(second.created).toBe(0);
    expect(second.refreshed).toBe(1);

    const row = await profileFor(email);
    expect(row?.profile.title).toBe("Professor");
    expect(row?.profile.prefilledSource).toBe("mcmaster_experts");
  });

  it("never overwrites a profile the person has confirmed", async () => {
    const email = uniqueEmail("claimed");
    await applyFacultyImport(csv(["email,first name,last name,title", `${email},Katherine,Johnson,Lecturer`]), {
      source: "faculty_list",
    });

    const before = await profileFor(email);
    if (!before) throw new Error("import did not create the profile");

    // The person signs in and corrects the import.
    await db
      .update(researcherProfiles)
      .set({ title: "Research Mathematician", claimedAt: new Date() })
      .where(eq(researcherProfiles.userId, before.user.id));

    const second = await applyFacultyImport(
      csv(["email,first name,last name,title", `${email},Katherine,Johnson,Lecturer`]),
      { source: "faculty_list" },
    );

    expect(second.rejected).toBe(1);
    expect(second.reasons[0].reason).toContain("already confirmed");

    const after = await profileFor(email);
    expect(after?.profile.title).toBe("Research Mathematician");
  });

  it("refuses to convert somebody who is already a student", async () => {
    const student = await createStudent();
    const [row] = await db.select({ email: users.email }).from(users).where(eq(users.id, student.id));

    const result = await applyFacultyImport(
      csv(["email,first name,last name", `${row.email},Wrong,Person`]),
      { source: "faculty_list" },
    );

    expect(result.created).toBe(0);
    expect(result.rejected).toBe(1);
    expect(result.reasons[0].reason).toContain("student");
  });

  it("lists imported people who have not signed in yet", async () => {
    const email = uniqueEmail("unclaimed");
    await applyFacultyImport(csv(["email,first name,last name", `${email},Chien-Shiung,Wu`]), {
      source: "faculty_list",
    });

    const waiting = await listUnclaimedFaculty();
    expect(waiting.some((entry) => entry.email === email)).toBe(true);

    const row = await profileFor(email);
    if (!row) return;
    await db
      .update(researcherProfiles)
      .set({ claimedAt: new Date() })
      .where(eq(researcherProfiles.userId, row.user.id));

    const after = await listUnclaimedFaculty();
    expect(after.some((entry) => entry.email === email)).toBe(false);
  });
});
