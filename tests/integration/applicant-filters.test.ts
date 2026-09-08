import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { applications, db, studentCourseTypes, studentProfiles } from "@/db";
import { applicantStatusCounts, listAllApplicants } from "@/lib/queries/researcher";
import { createApplication, createOpportunity, createResearcher, createStudent } from "../fixtures";

async function profileCourseTypes(studentId: string, values: string[]) {
  await db
    .insert(studentCourseTypes)
    .values(values.map((courseType) => ({ studentId, courseType: courseType as never })))
    .onConflictDoNothing();
}

describe("filtering the whole applicant pool", () => {
  it("filters on what the student is applying as", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    const honours = await createStudent();
    const volunteer = await createStudent();

    const a = await createApplication(opportunity.id, honours.id, { status: "submitted", submittedAt: new Date() });
    const b = await createApplication(opportunity.id, volunteer.id, { status: "submitted", submittedAt: new Date() });
    await db.update(applications).set({ courseType: "honours_thesis" }).where(eq(applications.id, a.id));
    await db.update(applications).set({ courseType: "volunteer" }).where(eq(applications.id, b.id));

    const results = await listAllApplicants(researcher.id, { courseTypes: ["honours_thesis"] });
    expect(results.items.map((row) => row.studentId)).toEqual([honours.id]);
    expect(results.total).toBe(1);
  });

  it("falls back to the profile when the application did not say", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    const student = await createStudent();
    await profileCourseTypes(student.id, ["thesis_course"]);
    await createApplication(opportunity.id, student.id, { status: "submitted", submittedAt: new Date() });

    const matched = await listAllApplicants(researcher.id, { courseTypes: ["thesis_course"] });
    expect(matched.items.map((row) => row.studentId)).toEqual([student.id]);
    expect(matched.items[0].courseTypes).toEqual(["thesis_course"]);

    const missed = await listAllApplicants(researcher.id, { courseTypes: ["phd_thesis"] });
    expect(missed.items).toHaveLength(0);
  });

  it("lets the answer on the application override the profile", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    const student = await createStudent();
    await profileCourseTypes(student.id, ["volunteer"]);
    const application = await createApplication(opportunity.id, student.id, {
      status: "submitted",
      submittedAt: new Date(),
    });
    await db.update(applications).set({ courseType: "honours_thesis" }).where(eq(applications.id, application.id));

    const byApplication = await listAllApplicants(researcher.id, { courseTypes: ["honours_thesis"] });
    expect(byApplication.items).toHaveLength(1);

    // The profile value must not keep matching once the application overrode it.
    const byProfile = await listAllApplicants(researcher.id, { courseTypes: ["volunteer"] });
    expect(byProfile.items).toHaveLength(0);
  });

  it("filters on program category", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    const nursing = await createStudent();
    const engineering = await createStudent();
    await db.update(studentProfiles).set({ programCategory: "nursing" }).where(eq(studentProfiles.userId, nursing.id));
    await db
      .update(studentProfiles)
      .set({ programCategory: "engineering" })
      .where(eq(studentProfiles.userId, engineering.id));

    await createApplication(opportunity.id, nursing.id, { status: "submitted", submittedAt: new Date() });
    await createApplication(opportunity.id, engineering.id, { status: "submitted", submittedAt: new Date() });

    const results = await listAllApplicants(researcher.id, { programCategories: ["nursing"] });
    expect(results.items.map((row) => row.studentId)).toEqual([nursing.id]);
  });

  it("never shows applicants belonging to another researcher", async () => {
    const mine = await createResearcher();
    const theirs = await createResearcher();
    const myOpportunity = await createOpportunity(mine.id);
    const theirOpportunity = await createOpportunity(theirs.id);
    const oneStudent = await createStudent();
    const another = await createStudent();

    await createApplication(myOpportunity.id, oneStudent.id, { status: "submitted", submittedAt: new Date() });
    await createApplication(theirOpportunity.id, another.id, { status: "submitted", submittedAt: new Date() });

    const results = await listAllApplicants(mine.id, {});
    expect(results.items.map((row) => row.studentId)).toEqual([oneStudent.id]);
  });

  it("leaves drafts out of the pool entirely", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    const student = await createStudent();
    await createApplication(opportunity.id, student.id, { status: "draft" });

    const results = await listAllApplicants(researcher.id, {});
    expect(results.items).toHaveLength(0);
  });

  it("counts a submitted application as both awaiting and active", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    const waiting = await createStudent();
    const shortlisted = await createStudent();
    const declined = await createStudent();

    await createApplication(opportunity.id, waiting.id, { status: "submitted", submittedAt: new Date() });
    await createApplication(opportunity.id, shortlisted.id, { status: "shortlisted", submittedAt: new Date() });
    await createApplication(opportunity.id, declined.id, { status: "declined", submittedAt: new Date() });

    const counts = await applicantStatusCounts(researcher.id);
    expect(counts.all).toBe(3);
    expect(counts.awaiting).toBe(1);
    // Active is everything not terminal and not a draft, so it includes the
    // one still sitting in the queue.
    expect(counts.active).toBe(2);
  });

  it("pages without dropping anybody", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    for (let index = 0; index < 5; index += 1) {
      const student = await createStudent();
      await createApplication(opportunity.id, student.id, {
        status: "submitted",
        submittedAt: new Date(Date.now() + index * 1000),
      });
    }

    const first = await listAllApplicants(researcher.id, { perPage: 2, page: 1 });
    const second = await listAllApplicants(researcher.id, { perPage: 2, page: 2 });
    const third = await listAllApplicants(researcher.id, { perPage: 2, page: 3 });

    expect(first.total).toBe(5);
    expect(first.pageCount).toBe(3);
    expect(first.items).toHaveLength(2);
    expect(second.items).toHaveLength(2);
    expect(third.items).toHaveLength(1);

    const seen = new Set([...first.items, ...second.items, ...third.items].map((row) => row.id));
    expect(seen.size).toBe(5);
  });
});
