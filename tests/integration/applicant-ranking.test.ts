import { describe, expect, it } from "vitest";
import { db, studentCompensationPreferences } from "@/db";
import { loadRankedApplicants } from "@/lib/queries/admin-ranking";
import { persistCriterionResults } from "@/lib/queries/applications";
import { loadOpportunityMatchInput } from "@/lib/queries/fit";
import { scoreMatch } from "@/lib/matching";
import { addCriterion, createApplication, createOpportunity, createResearcher, createStudent } from "../fixtures";

describe("ranking a position's applicants by fit", () => {
  it("orders applicants by fit and agrees with the rail's figures", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    const gpa = await addCriterion(opportunity.id, {
      type: "academic_metric",
      label: "GPA and academic standing",
      required: false,
      importance: "high",
      config: {},
    });

    const strong = await createStudent();
    const weak = await createStudent();
    const strongApp = await createApplication(opportunity.id, strong.id, { status: "submitted", submittedAt: new Date() });
    const weakApp = await createApplication(opportunity.id, weak.id, { status: "submitted", submittedAt: new Date() });
    // Graded academic standing: an A average earns all of the weight, a C+ very little.
    await persistCriterionResults(strongApp.id, [
      { criterionId: gpa.id, status: "met", score: 3, maxScore: 3, evidence: [], source: "deterministic" },
    ]);
    await persistCriterionResults(weakApp.id, [
      { criterionId: gpa.id, status: "not_met", score: 0.4, maxScore: 3, evidence: [], source: "deterministic" },
    ]);

    const ranked = await loadRankedApplicants(opportunity.id);
    expect(ranked?.ranked.map((row) => row.applicant.id)).toEqual([strongApp.id, weakApp.id]);
    expect(ranked!.ranked[0].fit.percent).toBeGreaterThan(ranked!.ranked[1].fit.percent);
    // The weaker record still earns something rather than zeroing the applicant.
    expect(ranked!.ranked[1].fit.percent).toBeGreaterThan(0);
  });

  it("counts academic credit on a paid position for a student who wants credit", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id, {
      compensationType: "paid",
      academicCreditAvailable: true,
    });
    const student = await createStudent();
    await db.insert(studentCompensationPreferences).values({ studentId: student.id, preference: "academic_credit" });
    await createApplication(opportunity.id, student.id, { status: "submitted", submittedAt: new Date() });

    const ranked = await loadRankedApplicants(opportunity.id);
    const fromDetail = ranked!.detail;
    expect(fromDetail.opportunity.academicCreditAvailable).toBe(true);

    // The review screens and the dashboard now read a listing identically.
    const input = await loadOpportunityMatchInput(opportunity.id);
    const result = scoreMatch(
      {
        fieldNames: [],
        skillNames: [],
        durations: [],
        compensationPreferences: ["academic_credit"],
        weeklyHours: null,
        locationPreference: null,
        hasExperience: true,
      },
      input!,
    );
    expect(result.dimensions.find((entry) => entry.dimension === "compensation")?.score).toBe(15);
    expect(ranked!.ranked[0].fit.percent).toBe(100);
  });
});
