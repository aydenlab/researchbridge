import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, opportunities, researcherProfiles, studentProfiles, users } from "@/db";
import { searchOpportunities } from "@/lib/queries/opportunities";
import { loadStudentProfile } from "@/lib/queries/student";
import { createOpportunity, createResearcher, createStudent } from "../fixtures";

describe("researcher onboarding friction", () => {
  it("lets an unverified researcher own an opportunity", async () => {
    // The point of the change: verification no longer gates creation.
    const researcher = await createResearcher(false);
    const profile = await db
      .select()
      .from(researcherProfiles)
      .where(eq(researcherProfiles.userId, researcher.id))
      .limit(1);
    expect(profile[0].verificationStatus).toBe("pending");

    const opportunity = await createOpportunity(researcher.id, { status: "draft" });
    expect(opportunity.researcherId).toBe(researcher.id);
  });

  it("allows an opportunity with no institution attached", async () => {
    const researcher = await createResearcher();
    // An unrecognised email domain leaves the account unlinked; posting must
    // still work.
    await db.update(users).set({ institutionId: null }).where(eq(users.id, researcher.id));

    const [row] = await db
      .insert(opportunities)
      .values({
        institutionId: null,
        researcherId: researcher.id,
        title: "No institution attached",
        slug: `no-institution-${researcher.id.slice(0, 8)}`,
        summary: "Created by an account with no recognised email domain.",
        status: "draft",
      })
      .returning();

    expect(row.institutionId).toBeNull();
  });
});

describe("opportunity moderation", () => {
  it("hides a listing awaiting review from students", async () => {
    const researcher = await createResearcher();
    const pending = await createOpportunity(researcher.id, {
      status: "pending_review",
      title: "Queued for an administrator",
      publishedAt: new Date(),
    });
    const live = await createOpportunity(researcher.id, {
      status: "published",
      title: "Already approved",
      publishedAt: new Date(),
    });

    const { items } = await searchOpportunities({ openOnly: false, perPage: 100 });
    const ids = items.map((item) => item.id);
    expect(ids).toContain(live.id);
    expect(ids).not.toContain(pending.id);
  });

  it("becomes visible once approved", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id, {
      status: "pending_review",
      title: "Approved later",
      publishedAt: new Date(),
    });

    await db
      .update(opportunities)
      .set({ status: "published" })
      .where(eq(opportunities.id, opportunity.id));

    const { items } = await searchOpportunities({ openOnly: false, perPage: 100 });
    expect(items.map((item) => item.id)).toContain(opportunity.id);
  });
});

describe("student profile additions", () => {
  it("stores the optional links and media, and defaults them to empty", async () => {
    const student = await createStudent();

    const before = await loadStudentProfile(student.id);
    expect(before?.profile.linkedinUrl).toBeNull();
    expect(before?.profile.orcidId).toBeNull();
    expect(before?.profile.writingSampleFileId).toBeNull();
    expect(before?.profile.videoIntroFileId).toBeNull();

    await db
      .update(studentProfiles)
      .set({ linkedinUrl: "https://www.linkedin.com/in/example", orcidId: "0000-0002-1825-0097" })
      .where(eq(studentProfiles.userId, student.id));

    const after = await loadStudentProfile(student.id);
    expect(after?.profile.orcidId).toBe("0000-0002-1825-0097");
  });

  it("does not require a resume to have a usable profile", async () => {
    const student = await createStudent();
    const profile = await loadStudentProfile(student.id);
    // Onboarding stays low friction; the resume is demanded only at submit.
    expect(profile).not.toBeNull();
    expect(profile?.profile.resumeFileId).toBeNull();
  });
});

describe("researcher profile additions", () => {
  it("stores ORCID, LinkedIn and a contact address", async () => {
    const researcher = await createResearcher();
    await db
      .update(researcherProfiles)
      .set({
        orcidId: "0000-0002-1825-0097",
        linkedinUrl: "https://www.linkedin.com/in/prof",
        contactEmail: "lab@example.edu",
      })
      .where(eq(researcherProfiles.userId, researcher.id));

    const [row] = await db
      .select()
      .from(researcherProfiles)
      .where(eq(researcherProfiles.userId, researcher.id))
      .limit(1);

    expect(row.orcidId).toBe("0000-0002-1825-0097");
    expect(row.contactEmail).toBe("lab@example.edu");
  });
});
