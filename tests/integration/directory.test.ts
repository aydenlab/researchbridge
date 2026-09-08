import { describe, expect, it } from "vitest";
import { db, studentCompensationPreferences, studentDurations } from "@/db";
import { searchResearchers, searchStudents } from "@/lib/queries/directory";
import { createOpportunity, createResearcher, createStudent } from "../fixtures";

async function wantsPay(studentId: string, preferences: ("paid" | "volunteer" | "academic_credit")[]) {
  await db
    .insert(studentCompensationPreferences)
    .values(preferences.map((preference) => ({ studentId, preference })))
    .onConflictDoNothing();
}

describe("browsing students", () => {
  it("finds a student on their program without any posting in between", async () => {
    const student = await createStudent({ program: "Bachelor of Kinesiology" });

    const results = await searchStudents({ q: "Kinesiology" });
    expect(results.items.map((item) => item.id)).toContain(student.id);
  });

  it("leaves out an account that has not finished onboarding", async () => {
    const student = await createStudent();
    const { users } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    await db.update(users).set({ onboardingCompletedAt: null }).where(eq(users.id, student.id));

    const results = await searchStudents({});
    expect(results.items.map((item) => item.id)).not.toContain(student.id);
  });

  it("narrows to students who will take a paid position", async () => {
    const paid = await createStudent({ program: "Paid Only Program" });
    const volunteer = await createStudent({ program: "Volunteer Only Program" });
    await wantsPay(paid.id, ["paid"]);
    await wantsPay(volunteer.id, ["volunteer"]);

    const results = await searchStudents({ compensationPreferences: ["paid"] });
    const ids = results.items.map((item) => item.id);
    expect(ids).toContain(paid.id);
    expect(ids).not.toContain(volunteer.id);
  });

  it("keeps a student open to either side in both searches", async () => {
    const open = await createStudent({ program: "Open To Both Program" });
    await wantsPay(open.id, ["paid", "volunteer"]);

    const paidResults = await searchStudents({ compensationPreferences: ["paid"] });
    const volunteerResults = await searchStudents({ compensationPreferences: ["volunteer"] });
    expect(paidResults.items.map((item) => item.id)).toContain(open.id);
    expect(volunteerResults.items.map((item) => item.id)).toContain(open.id);
  });

  it("returns what a student will accept alongside the row", async () => {
    const student = await createStudent({ program: "Badge Rendering Program" });
    await wantsPay(student.id, ["paid", "academic_credit"]);
    await db.insert(studentDurations).values({ studentId: student.id, duration: "one_semester" }).onConflictDoNothing();

    const results = await searchStudents({ q: "Badge Rendering" });
    const row = results.items.find((item) => item.id === student.id);
    expect(row?.compensationPreferences.sort()).toEqual(["academic_credit", "paid"]);
    expect(row?.durations).toEqual(["one_semester"]);
  });
});

describe("browsing researchers", () => {
  it("lists a verified researcher who has nothing posted", async () => {
    const researcher = await createResearcher();

    const results = await searchResearchers({});
    const row = results.items.find((item) => item.id === researcher.id);
    expect(row).toBeDefined();
    expect(row?.openPositions).toBe(0);
  });

  it("leaves out a researcher who has not been verified yet", async () => {
    const pending = await createResearcher(false);

    const results = await searchResearchers({});
    expect(results.items.map((item) => item.id)).not.toContain(pending.id);
  });

  it("narrows to researchers who are recruiting when asked", async () => {
    const recruiting = await createResearcher();
    const quiet = await createResearcher();
    await createOpportunity(recruiting.id, { status: "published" });

    const results = await searchResearchers({ recruitingOnly: true });
    const ids = results.items.map((item) => item.id);
    expect(ids).toContain(recruiting.id);
    expect(ids).not.toContain(quiet.id);
  });
});
