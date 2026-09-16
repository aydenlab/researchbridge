import { describe, expect, it } from "vitest";
import { applicantFit } from "@/lib/criteria/fit";
import type { Criterion, CriterionResult } from "@/lib/criteria/types";
import type { MatchResult } from "@/lib/matching";

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

function result(overrides: Partial<CriterionResult> & Pick<CriterionResult, "criterionId" | "status">): CriterionResult {
  return { evidence: [], source: "deterministic", ...overrides };
}

function match(percent: number | null): MatchResult {
  return { percent, points: 0, applicableWeight: 0, dimensions: [], reasons: [], caveats: [] };
}

describe("applicant fit", () => {
  it("scores a position with no criteria from the profile match alone", () => {
    const fit = applicantFit([], [], match(72));
    expect(fit.percent).toBe(72);
    expect(fit.basis).toBe("profile");
    expect(fit.band).toBe("good");
  });

  it("still returns a number when nothing at all could be compared", () => {
    const fit = applicantFit([], [], match(null));
    expect(fit.percent).toBe(0);
    expect(fit.basis).toBe("none");
    expect(fit.note).toMatch(/not enough information/i);
  });

  it("returns a number when every criterion came back unknown", () => {
    const criteria = [criterion({ id: "a", type: "skill", label: "Python", required: true, importance: "required" })];
    const fit = applicantFit(criteria, [result({ criterionId: "a", status: "unknown" })], match(50));
    expect(fit.percent).toBe(50);
    expect(fit.basis).toBe("profile");
  });

  it("combines criteria with the profile match when both are available", () => {
    const criteria = [
      criterion({ id: "req", type: "skill", label: "Python", required: true, importance: "required" }),
      criterion({ id: "pref", type: "prior_research", label: "Prior research", importance: "medium" }),
    ];
    const results = [
      result({ criterionId: "req", status: "met" }),
      result({ criterionId: "pref", status: "met", score: 2, maxScore: 2 }),
    ];

    const fit = applicantFit(criteria, results, match(50));
    // Criteria are fully met, so 0.65 of the score, plus 0.35 of a 50 percent match.
    expect(fit.percent).toBe(83);
    expect(fit.basis).toBe("criteria_and_profile");
    expect(fit.band).toBe("strong");
  });

  it("does not count an unmet required condition as a pass", () => {
    const criteria = [criterion({ id: "req", type: "skill", label: "Python", required: true, importance: "required" })];
    const fit = applicantFit(criteria, [result({ criterionId: "req", status: "not_met" })], match(40));
    expect(fit.percent).toBe(14);
    expect(fit.band).toBe("limited");
  });

  it("leaves unknown criteria out rather than counting them against the applicant", () => {
    const criteria = [
      criterion({ id: "met", type: "skill", label: "Python", required: true, importance: "required" }),
      criterion({ id: "unknown", type: "skill", label: "R", required: true, importance: "required" }),
    ];
    const results = [
      result({ criterionId: "met", status: "met" }),
      result({ criterionId: "unknown", status: "unknown" }),
    ];

    const decided = applicantFit(criteria, results, match(100));
    expect(decided.percent).toBe(100);
  });

  it("reports the summary it scored from", () => {
    const criteria = [criterion({ id: "req", type: "skill", label: "Python", required: true, importance: "required" })];
    const fit = applicantFit(criteria, [result({ criterionId: "req", status: "met" })], match(60));
    expect(fit.summary.requiredTotal).toBe(1);
    expect(fit.summary.requiredMet).toBe(1);
  });
});
