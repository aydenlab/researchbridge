import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { applicationSnapshots, criterionEvaluations, db } from "@/db";
import { rescoreAcademicCriteria } from "@/lib/criteria/rescore";
import { persistCriterionResults } from "@/lib/queries/applications";
import { addCriterion, createApplication, createOpportunity, createResearcher, createStudent } from "../fixtures";

async function submittedWith(opportunityId: string, academicRecords: object[]) {
  const student = await createStudent();
  const application = await createApplication(opportunityId, student.id, { status: "submitted", submittedAt: new Date() });
  await db.insert(applicationSnapshots).values({ applicationId: application.id, profile: { academicRecords } });
  return application;
}

async function storedStatus(applicationId: string, criterionId: string) {
  const [row] = await db
    .select({ status: criterionEvaluations.status, score: criterionEvaluations.score })
    .from(criterionEvaluations)
    .where(and(eq(criterionEvaluations.applicationId, applicationId), eq(criterionEvaluations.criterionId, criterionId)));
  return row;
}

describe("rescoring academic standing on submitted applications", () => {
  it("replaces the old 'no information' result for a weighted GPA with a graded one", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    const criterion = await addCriterion(opportunity.id, {
      type: "academic_metric",
      label: "GPA and academic standing",
      required: false,
      importance: "high",
      config: {},
    });

    const application = await submittedWith(opportunity.id, [
      { metricType: "institution_scale", value: "10.50", scaleMax: "12.00", institutionScaleName: "12 point" },
    ]);
    // What the old evaluator stored for every weighted GPA.
    await persistCriterionResults(application.id, [
      { criterionId: criterion.id, status: "unknown", evidence: ["No minimum was set."], source: "deterministic" },
    ]);

    await rescoreAcademicCriteria();

    const row = await storedStatus(application.id, criterion.id);
    expect(row.status).toBe("met");
    expect(Number(row.score)).toBeGreaterThan(0);
  });

  it("compares a student on another scale against a 12 point minimum", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    const criterion = await addCriterion(opportunity.id, {
      type: "academic_metric",
      label: "Minimum average",
      required: false,
      importance: "medium",
      config: { minValue: 9, metricType: "institution_scale", scaleMax: 12 },
    });

    const application = await submittedWith(opportunity.id, [
      { metricType: "percentage", value: "84.00", scaleMax: null, institutionScaleName: null },
    ]);

    await rescoreAcademicCriteria();
    expect((await storedStatus(application.id, criterion.id)).status).toBe("met");
  });

  it("leaves drafts alone", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    const criterion = await addCriterion(opportunity.id, {
      type: "academic_metric",
      label: "GPA",
      required: false,
      importance: "medium",
      config: {},
    });
    const student = await createStudent();
    const draft = await createApplication(opportunity.id, student.id);
    await db.insert(applicationSnapshots).values({
      applicationId: draft.id,
      profile: { academicRecords: [{ metricType: "gpa", value: "3.9", scaleMax: "4", institutionScaleName: null }] },
    });

    await rescoreAcademicCriteria();
    expect(await storedStatus(draft.id, criterion.id)).toBeUndefined();
  });
});
