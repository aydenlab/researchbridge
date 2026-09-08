import { describe, expect, it } from "vitest";
import { db, studentCourseTypes } from "@/db";
import { listApplicantsForOpportunity } from "@/lib/queries/applications";
import { createApplication, createOpportunity, createResearcher, createStudent } from "../fixtures";

/**
 * A student's profile lists every course type they are open to. What they are
 * applying as here is a separate answer, because it changes from one position
 * to the next: an honours thesis with one supervisor, volunteering with another.
 */
describe("course type on an application", () => {
  it("is what the researcher filters on when the student stated one", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    const opportunity = await createOpportunity(researcher.id);

    await db.insert(studentCourseTypes).values([
      { studentId: student.id, courseType: "volunteer" },
      { studentId: student.id, courseType: "honours_thesis" },
    ]);
    const application = await createApplication(opportunity.id, student.id, {
      status: "submitted",
      courseType: "honours_thesis",
    });

    const [row] = await listApplicantsForOpportunity(opportunity.id);

    expect(row.id).toBe(application.id);
    // Narrowed to the one answer that applies here, not everything on the profile.
    expect(row.courseTypes).toEqual(["honours_thesis"]);
    expect(row.profileCourseTypes).toEqual(expect.arrayContaining(["honours_thesis", "volunteer"]));
  });

  it("falls back to the profile when the application left it blank", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    const opportunity = await createOpportunity(researcher.id);

    await db.insert(studentCourseTypes).values([{ studentId: student.id, courseType: "phd_thesis" }]);
    await createApplication(opportunity.id, student.id, { status: "submitted" });

    const [row] = await listApplicantsForOpportunity(opportunity.id);

    expect(row.courseTypes).toEqual(["phd_thesis"]);
  });

  it("leaves an applicant unfiltered when neither the application nor the profile says anything", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    const opportunity = await createOpportunity(researcher.id);

    await createApplication(opportunity.id, student.id, { status: "submitted" });

    const [row] = await listApplicantsForOpportunity(opportunity.id);

    expect(row.courseTypes).toEqual([]);
  });

  it("does not let a stated course type leak between two applications from one student", async () => {
    const researcher = await createResearcher();
    const student = await createStudent();
    const thesisPosition = await createOpportunity(researcher.id, { title: "Thesis position" });
    const volunteerPosition = await createOpportunity(researcher.id, { title: "Volunteer position" });

    await createApplication(thesisPosition.id, student.id, { status: "submitted", courseType: "honours_thesis" });
    await createApplication(volunteerPosition.id, student.id, { status: "submitted", courseType: "volunteer" });

    const [thesisRow] = await listApplicantsForOpportunity(thesisPosition.id);
    const [volunteerRow] = await listApplicantsForOpportunity(volunteerPosition.id);

    expect(thesisRow.courseTypes).toEqual(["honours_thesis"]);
    expect(volunteerRow.courseTypes).toEqual(["volunteer"]);
  });
});
