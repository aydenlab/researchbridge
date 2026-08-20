import { describe, expect, it } from "vitest";
import { evaluateCriterion, evaluateDeterministic } from "@/lib/criteria/engine";
import type { ApplicantEvidence, Criterion } from "@/lib/criteria/types";
import { IMPORTANCE_WEIGHT, summarizeAlignment, weightOf } from "@/lib/criteria/weights";

function criterion(overrides: Partial<Criterion> & Pick<Criterion, "id" | "type" | "label">): Criterion {
  return {
    description: null,
    required: false,
    importance: "medium",
    config: {},
    sortOrder: 0,
    ...overrides,
  };
}

const baseEvidence: ApplicantEvidence = {
  program: "Bachelor of Health Sciences",
  faculty: "Faculty of Health Sciences",
  degreeLevel: "undergraduate",
  yearLevel: 2,
  graduationYear: 2028,
  weeklyHours: 10,
  locationPreference: "hybrid",
  desiredStartDate: "2026-09-01",
  semesters: ["Fall"],
  summerAvailable: true,
  skills: [{ name: "Python", slug: "python", proficiency: "working", context: "Cleaned clinical data" }],
  courses: [{ courseCode: "STATS 2B03", courseName: "Statistical Methods", status: "completed" }],
  researchFields: [{ name: "Epidemiology", slug: "epidemiology" }],
  experiences: [],
  academicRecords: [],
  answers: [],
};

describe("deterministic availability", () => {
  const availability = criterion({
    id: "availability",
    type: "availability",
    label: "At least 8 hours per week",
    required: true,
    importance: "required",
    config: { minHoursPerWeek: 8 },
  });

  it("computes 10 >= 8 in code rather than asking a model", () => {
    const result = evaluateCriterion(availability, baseEvidence);
    expect(result?.status).toBe("met");
    expect(result?.source).toBe("deterministic");
    expect(result?.evidence[0]).toContain("10 hours per week");
  });

  it("marks a shortfall as not met with the numbers stated", () => {
    const result = evaluateCriterion(availability, { ...baseEvidence, weeklyHours: 5 });
    expect(result?.status).toBe("not_met");
    expect(result?.evidence[0]).toContain("Requested minimum 8");
  });

  it("returns unknown when the student has not stated availability", () => {
    const result = evaluateCriterion(availability, { ...baseEvidence, weeklyHours: null });
    expect(result?.status).toBe("unknown");
  });
});

describe("deterministic skills and coursework", () => {
  it("matches a listed skill and carries its context as evidence", () => {
    const result = evaluateCriterion(
      criterion({ id: "skill", type: "skill", label: "Python", config: { skillSlug: "python", skillName: "Python" } }),
      baseEvidence,
    );
    expect(result?.status).toBe("met");
    expect(result?.evidence.join(" ")).toContain("Cleaned clinical data");
  });

  it("reports a missing skill as not met without touching other criteria", () => {
    const result = evaluateCriterion(
      criterion({ id: "skill", type: "skill", label: "Cell culture", config: { skillSlug: "cell-culture", skillName: "Cell culture" } }),
      baseEvidence,
    );
    expect(result?.status).toBe("not_met");
  });

  it("accepts any one of several alternative course codes", () => {
    const result = evaluateCriterion(
      criterion({ id: "course", type: "coursework", label: "Statistics", config: { courseCodes: ["STATS 2B03", "STATS 3Y03"] } }),
      baseEvidence,
    );
    expect(result?.status).toBe("met");
  });

  it("returns unknown when no coursework is listed at all", () => {
    const result = evaluateCriterion(
      criterion({ id: "course", type: "coursework", label: "Statistics", config: { courseCodes: ["STATS 2B03"] } }),
      { ...baseEvidence, courses: [] },
    );
    expect(result?.status).toBe("unknown");
  });
});

describe("prior research", () => {
  const priorResearch = criterion({
    id: "prior",
    type: "prior_research",
    label: "Prior research experience",
    importance: "low",
    config: { minExperiences: 1 },
  });

  it("does not treat an inexperienced student as ineligible", () => {
    const result = evaluateCriterion(priorResearch, baseEvidence);
    expect(result?.status).toBe("not_met");
    expect(result?.maxScore).toBe(IMPORTANCE_WEIGHT.low);
    expect(result?.score).toBe(0);
  });

  it("recognises listed experience", () => {
    const result = evaluateCriterion(priorResearch, {
      ...baseEvidence,
      experiences: [
        { organization: "Mobility Lab", title: "Research assistant", supervisor: null, description: null, techniques: [], outputs: [] },
      ],
    });
    expect(result?.status).toBe("met");
  });
});

describe("weight normalization", () => {
  const criteria: Criterion[] = [
    criterion({ id: "req", type: "availability", label: "At least 8 hours", required: true, importance: "required", config: { minHoursPerWeek: 8 } }),
    criterion({ id: "high", type: "skill", label: "Python", importance: "high", config: { skillSlug: "python", skillName: "Python" } }),
    criterion({ id: "med", type: "coursework", label: "Statistics", importance: "medium", config: { courseCodes: ["STATS 2B03"] } }),
    criterion({ id: "low", type: "skill", label: "Cell culture", importance: "low", config: { skillSlug: "cell-culture", skillName: "Cell culture" } }),
  ];

  it("gives required criteria no preference weight of their own", () => {
    expect(weightOf(criteria[0])).toBe(0);
    expect(weightOf(criteria[1])).toBe(3);
    expect(weightOf(criteria[2])).toBe(2);
    expect(weightOf(criteria[3])).toBe(1);
  });

  it("charges a missing preferred criterion only its own share", () => {
    const results = evaluateDeterministic(criteria, baseEvidence);
    const summary = summarizeAlignment(criteria, results);

    expect(summary.requiredTotal).toBe(1);
    expect(summary.requiredMet).toBe(1);
    expect(summary.preferenceMax).toBe(6);
    expect(summary.preferenceScore).toBe(5);
    expect(summary.preferencePercent).toBe(83);
  });

  it("never lets one missing low-importance item swing the result by more than its weight", () => {
    const withSkill = summarizeAlignment(criteria, evaluateDeterministic(criteria, {
      ...baseEvidence,
      skills: [
        ...baseEvidence.skills,
        { name: "Cell culture", slug: "cell-culture", proficiency: "working", context: null },
      ],
    }));
    const withoutSkill = summarizeAlignment(criteria, evaluateDeterministic(criteria, baseEvidence));

    expect(withSkill.preferenceScore - withoutSkill.preferenceScore).toBe(IMPORTANCE_WEIGHT.low);
    expect(withSkill.preferencePercent! - withoutSkill.preferencePercent!).toBeLessThanOrEqual(17);
  });

  it("excludes unknown criteria from the denominator instead of counting them as failures", () => {
    const unknownCriteria: Criterion[] = [
      criterion({ id: "a", type: "skill", label: "Python", importance: "high", config: { skillSlug: "python", skillName: "Python" } }),
      criterion({ id: "b", type: "coursework", label: "Statistics", importance: "high", config: { courseCodes: ["STATS 2B03"] } }),
    ];

    const summary = summarizeAlignment(
      unknownCriteria,
      evaluateDeterministic(unknownCriteria, { ...baseEvidence, courses: [] }),
    );

    expect(summary.preferenceMax).toBe(3);
    expect(summary.preferenceScore).toBe(3);
    expect(summary.preferencePercent).toBe(100);
    expect(summary.unscoredPreferences).toBe(1);
  });

  it("counts unknown against the student only when the researcher opted into that", () => {
    const strict: Criterion[] = [
      criterion({
        id: "strict",
        type: "coursework",
        label: "Statistics",
        importance: "high",
        config: { courseCodes: ["STATS 2B03"], unknownCountsAgainst: true },
      }),
    ];

    const summary = summarizeAlignment(strict, evaluateDeterministic(strict, { ...baseEvidence, courses: [] }));
    expect(summary.preferenceMax).toBe(3);
    expect(summary.preferenceScore).toBe(0);
    expect(summary.preferencePercent).toBe(0);
  });

  it("keeps required failures separate from the preference score", () => {
    const summary = summarizeAlignment(criteria, evaluateDeterministic(criteria, { ...baseEvidence, weeklyHours: 2 }));
    expect(summary.requiredUnmet).toBe(1);
    expect(summary.allRequiredMet).toBe(false);
    expect(summary.preferencePercent).toBe(83);
  });
});
