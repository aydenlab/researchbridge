import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, profileReferences, users } from "@/db";
import {
  emailForUser,
  listConfirmedProfileReferences,
  listProfileReferences,
  profileReferenceAlreadyRequested,
  resolveReferenceToken,
} from "@/lib/queries/references";
import { generateReferenceToken, hashReferenceToken, referenceUrl } from "@/lib/references/tokens";
import { createApplicationGraph, createResearcher, createStudent } from "../fixtures";

async function addProfileReference(userId: string, refereeEmail: string) {
  const token = generateReferenceToken();
  const [row] = await db
    .insert(profileReferences)
    .values({
      userId,
      refereeEmail,
      refereeName: "Dr Vouch",
      relationship: "Thesis supervisor",
      tokenHash: hashReferenceToken(token),
    })
    .returning();
  return { token, row };
}

async function approve(id: string) {
  await db
    .update(profileReferences)
    .set({ status: "approved", respondedAt: new Date() })
    .where(eq(profileReferences.id, id));
}

describe("profile references", () => {
  it("works for a student", async () => {
    const student = await createStudent();
    const { token } = await addProfileReference(student.id, "vouch-student@example.edu");

    const resolved = await resolveReferenceToken(token);
    expect(resolved?.kind).toBe("profile");
    expect(resolved?.status).toBe("pending");
    expect(resolved?.subjectName).toBe("Test Student");
  });

  it("works for a researcher too", async () => {
    const researcher = await createResearcher();
    const { token } = await addProfileReference(researcher.id, "vouch-prof@example.edu");

    const resolved = await resolveReferenceToken(token);
    expect(resolved?.kind).toBe("profile");
    expect(resolved?.subjectName).toBe("Test Researcher");
  });

  it("is asked once and is not tied to any application", async () => {
    const student = await createStudent();
    const { row } = await addProfileReference(student.id, "reused@example.edu");
    await approve(row.id);

    // Confirmed once, and it stays confirmed no matter how many times they apply.
    expect(await listConfirmedProfileReferences(student.id)).toHaveLength(1);
    const columns = Object.keys(row);
    expect(columns).not.toContain("applicationId");
  });

  it("only lists confirmed references publicly", async () => {
    const student = await createStudent();
    const approved = await addProfileReference(student.id, "yes@example.edu");
    await addProfileReference(student.id, "waiting@example.edu");
    const declined = await addProfileReference(student.id, "no@example.edu");

    await approve(approved.row.id);
    await db
      .update(profileReferences)
      .set({ status: "declined", respondedAt: new Date() })
      .where(eq(profileReferences.id, declined.row.id));

    expect(await listProfileReferences(student.id)).toHaveLength(3);
    const confirmed = await listConfirmedProfileReferences(student.id);
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0].refereeEmail).toBe("yes@example.edu");
  });

  it("refuses the same referee twice for one person", async () => {
    const student = await createStudent();
    await addProfileReference(student.id, "dupe@example.edu");

    expect(await profileReferenceAlreadyRequested(student.id, "dupe@example.edu")).toBe(true);
    await expect(addProfileReference(student.id, "dupe@example.edu")).rejects.toThrow();
  });

  it("lets two different people name the same referee", async () => {
    const first = await createStudent();
    const second = await createStudent();
    await addProfileReference(first.id, "popular@example.edu");
    await expect(addProfileReference(second.id, "popular@example.edu")).resolves.toBeTruthy();
  });

  it("disappears when the account is deleted", async () => {
    const student = await createStudent();
    await addProfileReference(student.id, "cascade@example.edu");
    await db.delete(users).where(eq(users.id, student.id));
    expect(await listProfileReferences(student.id)).toHaveLength(0);
  });

  it("finds the person to notify when the referee answers", async () => {
    const student = await createStudent();
    expect(await emailForUser(student.id)).toBe(student.email);
  });
});

describe("one link format covers both kinds", () => {
  it("tells an application request apart from a profile one", async () => {
    const graph = await createApplicationGraph();
    const profile = await addProfileReference(graph.student.id, "profile-kind@example.edu");

    const { applicationReferences } = await import("@/db");
    const applicationToken = generateReferenceToken();
    await db.insert(applicationReferences).values({
      applicationId: graph.application.id,
      refereeEmail: "application-kind@example.edu",
      tokenHash: hashReferenceToken(applicationToken),
    });

    const resolvedProfile = await resolveReferenceToken(profile.token);
    const resolvedApplication = await resolveReferenceToken(applicationToken);

    expect(resolvedProfile?.kind).toBe("profile");
    expect(resolvedApplication?.kind).toBe("application");
    if (resolvedApplication?.kind === "application") {
      expect(resolvedApplication.projectTitle).toBe(graph.opportunity.title);
    }
  });

  it("uses the same URL shape for both", () => {
    const token = generateReferenceToken();
    expect(referenceUrl(token)).toContain("/reference/");
  });

  it("returns nothing for an unknown token", async () => {
    expect(await resolveReferenceToken(generateReferenceToken())).toBeNull();
  });

  it("cannot be resolved using the stored hash", async () => {
    const student = await createStudent();
    const { token } = await addProfileReference(student.id, "hash-probe@example.edu");
    expect(await resolveReferenceToken(hashReferenceToken(token))).toBeNull();
  });
});

describe("the link that actually goes in the email", () => {
  it("round trips from the sent message back to the right pending request", async () => {
    const { sendProfileReferenceRequest } = await import("@/lib/email");
    const student = await createStudent();
    const token = generateReferenceToken();
    const [row] = await db
      .insert(profileReferences)
      .values({
        userId: student.id,
        refereeEmail: "roundtrip@example.edu",
        refereeName: "Dr Roundtrip",
        tokenHash: hashReferenceToken(token),
      })
      .returning();

    const captured: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      captured.push(args.map(String).join(" "));
    });
    const delivery = await sendProfileReferenceRequest({
      to: "roundtrip@example.edu",
      refereeName: "Dr Roundtrip",
      personName: "Test Student",
      personDetail: null,
      relationship: null,
      url: referenceUrl(token),
    });
    spy.mockRestore();

    expect(delivery.ok).toBe(true);

    // Pull the link out of the delivered body rather than trusting the input.
    const body = captured.join("\n");
    const match = body.match(/\/reference\/([A-Za-z0-9_-]+)/);
    expect(match).not.toBeNull();
    const emailedToken = match![1];

    const resolved = await resolveReferenceToken(emailedToken);
    expect(resolved).not.toBeNull();
    expect(resolved?.referenceId).toBe(row.id);
    expect(resolved?.status).toBe("pending");

    // And answering it once closes it.
    await approve(row.id);
    const answered = await resolveReferenceToken(emailedToken);
    expect(answered?.status).toBe("approved");
  });
});
