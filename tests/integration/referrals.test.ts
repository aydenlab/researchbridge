import { describe, expect, it } from "vitest";
import { db, profileReferrals, storedFiles } from "@/db";
import { listReferralsFor, referralByReferrer, referralCounts } from "@/lib/queries/referrals";
import { createResearcher, createStudent } from "../fixtures";

describe("referrals on a profile", () => {
  it("shows who did the referring, read live from their account", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();

    await db.insert(profileReferrals).values({
      subjectId: student.id,
      referrerId: researcher.id,
      note: "Ran the extraction for two terms without supervision.",
    });

    const referrals = await listReferralsFor(student.id);
    expect(referrals).toHaveLength(1);
    expect(referrals[0].referrerName).toBe("Test Researcher");
    expect(referrals[0].referrerHeadline).toContain("Health Research Methods");
    expect(referrals[0].note).toContain("two terms");
  });

  it("names the attached reference letter when there is one", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    const [file] = await db
      .insert(storedFiles)
      .values({
        ownerId: researcher.id,
        provider: "local",
        storageKey: "attachment/test/letter.pdf",
        fileName: "letter.pdf",
        contentType: "application/pdf",
        byteSize: 2048,
        purpose: "attachment",
      })
      .returning();

    await db.insert(profileReferrals).values({
      subjectId: student.id,
      referrerId: researcher.id,
      letterFileId: file.id,
    });

    const [referral] = await listReferralsFor(student.id);
    expect(referral.letterFileId).toBe(file.id);
    expect(referral.letterFileName).toBe("letter.pdf");
  });

  it("holds one referral per pair, so a second is an edit rather than a duplicate", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();

    await db.insert(profileReferrals).values({ subjectId: student.id, referrerId: researcher.id, note: "First" });
    await db
      .insert(profileReferrals)
      .values({ subjectId: student.id, referrerId: researcher.id, note: "Second" })
      .onConflictDoUpdate({
        target: [profileReferrals.subjectId, profileReferrals.referrerId],
        set: { note: "Second" },
      });

    const referrals = await listReferralsFor(student.id);
    expect(referrals).toHaveLength(1);
    expect(referrals[0].note).toBe("Second");
  });

  it("refuses a referral of yourself at the database level", async () => {
    const student = await createStudent();
    await expect(
      db.insert(profileReferrals).values({ subjectId: student.id, referrerId: student.id }),
    ).rejects.toThrow();
  });

  it("finds an existing referral so the button can offer to edit it", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    expect(await referralByReferrer(student.id, researcher.id)).toBeNull();

    await db.insert(profileReferrals).values({ subjectId: student.id, referrerId: researcher.id });
    expect(await referralByReferrer(student.id, researcher.id)).not.toBeNull();
  });

  it("counts referrals per person in one pass", async () => {
    const student = await createStudent();
    const other = await createStudent();
    const first = await createResearcher();
    const second = await createResearcher();

    await db.insert(profileReferrals).values([
      { subjectId: student.id, referrerId: first.id },
      { subjectId: student.id, referrerId: second.id },
      { subjectId: other.id, referrerId: first.id },
    ]);

    const counts = await referralCounts([student.id, other.id]);
    expect(counts.get(student.id)).toBe(2);
    expect(counts.get(other.id)).toBe(1);
  });
});
