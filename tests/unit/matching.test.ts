import { describe, expect, it } from "vitest";
import {
  compensationBucket,
  compensationBuckets,
  scoreMatch,
  type OpportunityMatchInput,
  type StudentMatchInput,
} from "@/lib/matching";

function student(overrides: Partial<StudentMatchInput> = {}): StudentMatchInput {
  return {
    fieldNames: ["Cardiology"],
    skillNames: ["Python"],
    durations: ["one_semester"],
    compensationPreferences: ["paid"],
    weeklyHours: 10,
    locationPreference: "hybrid",
    hasExperience: true,
    ...overrides,
  };
}

function opportunity(overrides: Partial<OpportunityMatchInput> = {}): OpportunityMatchInput {
  return {
    fieldNames: ["Cardiology"],
    skillNames: ["Python"],
    durations: ["one_semester"],
    compensationType: "paid",
    hoursPerWeekMin: 6,
    locationMode: "hybrid",
    beginnerFriendly: false,
    priorResearchRequired: false,
    ...overrides,
  };
}

describe("duration matching", () => {
  it("counts overlap on any single value as a full match", () => {
    const result = scoreMatch(
      student({ durations: ["one_semester", "multi_year"] }),
      opportunity({ durations: ["multi_year"] }),
    );
    const duration = result.dimensions.find((entry) => entry.dimension === "duration");
    expect(duration?.score).toBe(duration?.weight);
  });

  it("scores zero when the two sides want different lengths", () => {
    const result = scoreMatch(
      student({ durations: ["one_semester"] }),
      opportunity({ durations: ["multi_year"] }),
    );
    const duration = result.dimensions.find((entry) => entry.dimension === "duration");
    expect(duration?.score).toBe(0);
    expect(duration?.reason).toContain("different length");
  });

  it("separates two candidates who differ only on duration", () => {
    const posting = opportunity({ durations: ["multi_year"] });
    const wants = scoreMatch(student({ durations: ["multi_year"] }), posting);
    const doesNot = scoreMatch(student({ durations: ["one_semester"] }), posting);
    expect(wants.points).toBeGreaterThan(doesNot.points);
    expect((wants.percent ?? 0) - (doesNot.percent ?? 0)).toBeGreaterThan(20);
  });

  it("does not penalise a student who has not answered yet", () => {
    const answered = scoreMatch(student({ durations: [] }), opportunity());
    const duration = answered.dimensions.find((entry) => entry.dimension === "duration");
    expect(duration?.score).toBeNull();
    // The weight of an unanswered dimension leaves the percentage alone rather
    // than dragging it down, so a half-filled profile is not punished twice.
    expect(answered.percent).toBe(100);
  });

  it("weighs duration alongside interest rather than beneath it", () => {
    const wrongField = scoreMatch(student(), opportunity({ fieldNames: ["Immunology"] }));
    const wrongDuration = scoreMatch(student(), opportunity({ durations: ["multi_year"] }));
    // Interest still matters more, but a duration mismatch has to be able to
    // move a listing on its own or it is not really a dimension.
    expect(wrongField.points).toBeLessThan(wrongDuration.points);
    expect(wrongDuration.percent).toBeLessThan(100);
  });
});

describe("paid and volunteer preferences", () => {
  it("buckets every compensation type a listing can carry", () => {
    expect(compensationBucket("paid")).toBe("paid");
    expect(compensationBucket("work_study")).toBe("paid");
    expect(compensationBucket("grant_funded")).toBe("paid");
    expect(compensationBucket("volunteer")).toBe("volunteer");
    expect(compensationBucket("unpaid")).toBe("volunteer");
    expect(compensationBucket("academic_credit")).toBe("academic_credit");
    expect(compensationBucket("thesis")).toBe("academic_credit");
    expect(compensationBucket("other")).toBeNull();
  });

  it("rewards a listing that pays when the student needs paying", () => {
    const paid = scoreMatch(student({ compensationPreferences: ["paid"] }), opportunity({ compensationType: "paid" }));
    const unpaid = scoreMatch(
      student({ compensationPreferences: ["paid"] }),
      opportunity({ compensationType: "volunteer" }),
    );
    expect(paid.points).toBeGreaterThan(unpaid.points);
  });

  it("treats a student open to both as matching either", () => {
    const preferences: StudentMatchInput["compensationPreferences"] = ["paid", "volunteer"];
    const paid = scoreMatch(student({ compensationPreferences: preferences }), opportunity({ compensationType: "paid" }));
    const volunteer = scoreMatch(
      student({ compensationPreferences: preferences }),
      opportunity({ compensationType: "volunteer" }),
    );
    expect(paid.percent).toBe(volunteer.percent);
  });

  it("counts a paid position that also carries credit as both", () => {
    expect(compensationBuckets({ compensationType: "paid" })).toEqual(["paid"]);
    expect(compensationBuckets({ compensationType: "paid", academicCreditAvailable: true }).sort()).toEqual([
      "academic_credit",
      "paid",
    ]);
  });

  it("matches a credit-seeking student to a paid position that offers credit", () => {
    const creditOnly = student({ compensationPreferences: ["academic_credit"] });

    const withCredit = scoreMatch(
      creditOnly,
      opportunity({ compensationType: "paid", academicCreditAvailable: true }),
    );
    const withoutCredit = scoreMatch(creditOnly, opportunity({ compensationType: "paid" }));

    expect(withCredit.points).toBeGreaterThan(withoutCredit.points);
    expect(withCredit.reasons.join(" ")).toContain("credit");
  });

  it("says out loud when the pay arrangement is not what the student asked for", () => {
    const result = scoreMatch(
      student({ compensationPreferences: ["paid"] }),
      opportunity({ compensationType: "volunteer" }),
    );
    expect(result.caveats.join(" ")).toContain("Not the kind of position");
  });

  it("leaves an unclassifiable arrangement out of scoring rather than guessing", () => {
    const result = scoreMatch(student(), opportunity({ compensationType: "other" }));
    const compensation = result.dimensions.find((entry) => entry.dimension === "compensation");
    expect(compensation?.score).toBeNull();
  });
});

describe("explaining a score", () => {
  it("reports a duration mismatch as a caveat rather than silence", () => {
    const result = scoreMatch(
      student({ durations: ["one_semester"] }),
      opportunity({ durations: ["multi_year"] }),
    );
    expect(result.reasons.join(" ")).not.toContain("different length");
    expect(result.caveats.join(" ")).toContain("different length");
  });

  it("keeps a dimension that did not apply out of both lists", () => {
    const result = scoreMatch(student({ durations: [] }), opportunity({ durations: ["one_year"] }));
    expect(result.reasons.join(" ")).not.toContain("length");
    expect(result.caveats.join(" ")).not.toContain("length");
  });
});

describe("overall scoring", () => {
  it("reports a percentage only over the dimensions that applied", () => {
    const result = scoreMatch(
      student({ fieldNames: [], skillNames: [], durations: [], compensationPreferences: [], weeklyHours: null, locationPreference: null }),
      opportunity(),
    );
    expect(result.percent).toBeNull();
    expect(result.applicableWeight).toBe(0);
  });

  it("gives reasons only for dimensions that actually matched", () => {
    const result = scoreMatch(student(), opportunity({ fieldNames: ["Immunology"], skillNames: ["Western blot"] }));
    expect(result.reasons.some((reason) => reason.includes("Immunology"))).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("one semester"))).toBe(true);
  });

  it("pushes down a position that requires experience the student does not have", () => {
    const open = scoreMatch(student({ hasExperience: false }), opportunity({ beginnerFriendly: true }));
    const closed = scoreMatch(student({ hasExperience: false }), opportunity({ priorResearchRequired: true }));
    expect(open.points).toBeGreaterThan(closed.points);
  });
});
