import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { applicationSnapshots, criterionEvaluations, db, researchFields } from "@/db";
import { rescoreDeterministicCriteria } from "@/lib/criteria/rescore";
import { persistCriterionResults } from "@/lib/queries/applications";
import { addCriterion, createApplication, createOpportunity, createResearcher, createStudent } from "../fixtures";

async function submittedWith(opportunityId: string, academicRecords: object[], extra: Record<string, unknown> = {}) {
  const student = await createStudent();
  const application = await createApplication(opportunityId, student.id, { status: "submitted", submittedAt: new Date() });
  await db.insert(applicationSnapshots).values({ applicationId: application.id, profile: { skills: [], courses: [], academicRecords, ...extra } });
  return application;
}

async function storedStatus(applicationId: string, criterionId: string) {
  const [row] = await db
    .select({
      status: criterionEvaluations.status,
      score: criterionEvaluations.score,
      updatedAt: criterionEvaluations.updatedAt,
    })
    .from(criterionEvaluations)
    .where(and(eq(criterionEvaluations.applicationId, applicationId), eq(criterionEvaluations.criterionId, criterionId)));
  return row;
}

describe("rescoring rule-based criteria on submitted applications", () => {
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
      { metricType: "institution_scale", value: "11.50", scaleMax: "12.00", institutionScaleName: "12 point" },
    ]);
    // What the old evaluator stored for every weighted GPA.
    await persistCriterionResults(application.id, [
      { criterionId: criterion.id, status: "unknown", evidence: ["No minimum was set."], source: "deterministic" },
    ]);

    await rescoreDeterministicCriteria();

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

    await rescoreDeterministicCriteria();
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
      profile: {
        skills: [],
        courses: [],
        academicRecords: [{ metricType: "gpa", value: "3.9", scaleMax: "4", institutionScaleName: null }],
      },
    });

    await rescoreDeterministicCriteria();
    expect(await storedStatus(draft.id, criterion.id)).toBeUndefined();
  });

  it("moves a year of study one off from a flat no to partly met", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    const criterion = await addCriterion(opportunity.id, {
      type: "year_level",
      label: "Year 3 or above",
      required: true,
      importance: "required",
      config: { minYear: 3 },
    });
    const application = await submittedWith(opportunity.id, [], { yearLevel: 2 });
    await persistCriterionResults(application.id, [
      { criterionId: criterion.id, status: "not_met", evidence: ["Student is in year 2."], source: "deterministic" },
    ]);

    await rescoreDeterministicCriteria();
    expect((await storedStatus(application.id, criterion.id)).status).toBe("partially_met");
  });

  it("reads skills and research areas back from the names a snapshot stores", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    const name = `Rescore Field ${randomUUID().slice(0, 6)}`;
    const [field] = await db.insert(researchFields).values({ name, slug: `custom-slug-${randomUUID().slice(0, 6)}` }).returning();
    const skill = await addCriterion(opportunity.id, {
      type: "skill",
      label: "Python",
      required: false,
      importance: "medium",
      config: { skillSlug: "python", skillName: "Python" },
    });
    const interest = await addCriterion(opportunity.id, {
      type: "research_interest",
      label: `Interest in ${name}`,
      required: false,
      importance: "high",
      config: { fieldSlugs: [field.slug] },
      sortOrder: 1,
    });
    const application = await submittedWith(opportunity.id, [], {
      skills: [{ name: "Python", proficiency: "intermediate", context: null }],
      researchFields: [name],
    });

    await rescoreDeterministicCriteria();
    expect((await storedStatus(application.id, skill.id)).status).toBe("met");
    // The taxonomy slug differs from slugify(name), so this only passes if it is looked up.
    expect((await storedStatus(application.id, interest.id)).status).toBe("met");
  });

  it("falls back to the current profile when an application has no snapshot", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    const criterion = await addCriterion(opportunity.id, {
      type: "year_level",
      label: "Year 2 or above",
      required: true,
      importance: "required",
      config: { minYear: 2 },
    });
    const student = await createStudent({ yearLevel: 3 });
    const application = await createApplication(opportunity.id, student.id, { status: "submitted", submittedAt: new Date() });

    await rescoreDeterministicCriteria();
    expect((await storedStatus(application.id, criterion.id)).status).toBe("met");
  });

  it("leaves a result alone when nothing about it changed", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    const criterion = await addCriterion(opportunity.id, {
      type: "year_level",
      label: "Year 2 or above",
      required: true,
      importance: "required",
      config: { minYear: 2 },
    });
    const application = await submittedWith(opportunity.id, [], { yearLevel: 3 });

    await rescoreDeterministicCriteria();
    const first = await storedStatus(application.id, criterion.id);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await rescoreDeterministicCriteria();
    const second = await storedStatus(application.id, criterion.id);
    expect(second.updatedAt.getTime()).toBe(first.updatedAt.getTime());
  });

  it("reads the current profile when the snapshot is only a placeholder", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    const criterion = await addCriterion(opportunity.id, {
      type: "year_level",
      label: "Year 2 or above",
      required: true,
      importance: "required",
      config: { minYear: 2 },
    });
    const student = await createStudent({ yearLevel: 3 });
    const application = await createApplication(opportunity.id, student.id, { status: "submitted", submittedAt: new Date() });
    // What the seed script writes instead of a profile.
    await db.insert(applicationSnapshots).values({
      applicationId: application.id,
      profile: { capturedFrom: "seed", studentEmail: "someone@example.edu" },
    });

    await rescoreDeterministicCriteria();
    expect((await storedStatus(application.id, criterion.id)).status).toBe("met");
  });
});
