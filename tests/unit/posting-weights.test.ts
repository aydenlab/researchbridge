import { describe, expect, it } from "vitest";
import { criteriaFromWeights, importanceOf, readWeight, readWeights } from "@/lib/criteria/from-weights";
import { evaluateCriterion } from "@/lib/criteria/engine";
import type { ApplicantEvidence, Criterion } from "@/lib/criteria/types";

const FIELD = { name: "Epidemiology", slug: "epidemiology" };

const ALL_FIFTY = {
  weightGpa: 50,
  weightExtracurriculars: 50,
  weightPriorResearch: 50,
  weightResearchInterests: 50,
  weightSkills: 50,
};

describe("reading a slider", () => {
  it("clamps to the range the slider can actually produce", () => {
    expect(readWeight("-40")).toBe(0);
    expect(readWeight("400")).toBe(100);
    expect(readWeight("35")).toBe(35);
  });

  it("treats a missing or unreadable slider as nothing rather than a default", () => {
    expect(readWeight(null)).toBe(0);
    expect(readWeight("")).toBe(0);
    expect(readWeight("high")).toBe(0);
  });

  it("reads every slider the form posts", () => {
    const form = new FormData();
    form.set("weightGpa", "80");
    form.set("weightSkills", "20");
    expect(readWeights(form)).toEqual({
      weightGpa: 80,
      weightExtracurriculars: 0,
      weightPriorResearch: 0,
      weightResearchInterests: 0,
      weightSkills: 20,
    });
  });
});

describe("turning a slider into an importance", () => {
  it("drops anything left at zero", () => {
    expect(importanceOf(0)).toBeNull();
  });

  it("splits the rest across the three levels the schema has", () => {
    expect(importanceOf(1)).toBe("low");
    expect(importanceOf(33)).toBe("low");
    expect(importanceOf(34)).toBe("medium");
    expect(importanceOf(66)).toBe("medium");
    expect(importanceOf(67)).toBe("high");
    expect(importanceOf(100)).toBe("high");
  });
});

describe("criteria built from the posting form", () => {
  it("makes one criterion per skill, carrying the skills weight", () => {
    const criteria = criteriaFromWeights({
      weights: { ...ALL_FIFTY, weightSkills: 90 },
      field: FIELD,
      skillNames: ["Python", "Data analysis"],
      priorResearchRequired: false,
    });

    const skills = criteria.filter((criterion) => criterion.type === "skill");
    expect(skills.map((criterion) => criterion.label)).toEqual(["Python", "Data analysis"]);
    expect(skills.every((criterion) => criterion.importance === "high")).toBe(true);
    expect(skills[0].config).toEqual({ skillSlug: "python", skillName: "Python" });
  });

  it("orders the heaviest first so it is the evidence a reviewer meets first", () => {
    const criteria = criteriaFromWeights({
      weights: {
        weightGpa: 10,
        weightExtracurriculars: 40,
        weightPriorResearch: 100,
        weightResearchInterests: 70,
        weightSkills: 0,
      },
      field: FIELD,
      skillNames: ["Python"],
      priorResearchRequired: false,
    });

    expect(criteria.map((criterion) => criterion.type)).toEqual([
      "prior_research",
      "research_interest",
      "custom",
      "academic_metric",
    ]);
    expect(criteria.map((criterion) => criterion.sortOrder)).toEqual([0, 1, 2, 3]);
  });

  it("stores nothing at all when every slider is at zero", () => {
    const criteria = criteriaFromWeights({
      weights: {
        weightGpa: 0,
        weightExtracurriculars: 0,
        weightPriorResearch: 0,
        weightResearchInterests: 0,
        weightSkills: 0,
      },
      field: FIELD,
      skillNames: ["Python"],
      priorResearchRequired: false,
    });

    expect(criteria).toEqual([]);
  });

  it("lets the required checkbox outrank its own slider", () => {
    const criteria = criteriaFromWeights({
      weights: { ...ALL_FIFTY, weightPriorResearch: 1 },
      field: FIELD,
      skillNames: [],
      priorResearchRequired: true,
    });

    const prior = criteria.find((criterion) => criterion.type === "prior_research");
    expect(prior?.required).toBe(true);
    expect(prior?.importance).toBe("required");
    expect(prior?.sortOrder).toBe(0);
  });

  it("skips the interest criterion when no field was chosen", () => {
    const criteria = criteriaFromWeights({
      weights: ALL_FIFTY,
      field: null,
      skillNames: [],
      priorResearchRequired: false,
    });

    expect(criteria.some((criterion) => criterion.type === "research_interest")).toBe(false);
  });

  it("builds skill criteria the engine can evaluate against a profile", () => {
    const [draft] = criteriaFromWeights({
      weights: { ...ALL_FIFTY, weightGpa: 0, weightExtracurriculars: 0, weightPriorResearch: 0, weightResearchInterests: 0 },
      field: FIELD,
      skillNames: ["Python"],
      priorResearchRequired: false,
    });

    const criterion: Criterion = { id: "skill-1", ...draft };
    const evidence = {
      skills: [{ name: "Python", slug: "python", proficiency: "working", context: null }],
    } as unknown as ApplicantEvidence;

    expect(evaluateCriterion(criterion, evidence)?.status).toBe("met");
  });
});

describe("a weighted GPA criterion with no cut-off", () => {
  const criterion: Criterion = {
    id: "gpa",
    type: "academic_metric",
    label: "GPA and academic standing",
    description: null,
    required: false,
    importance: "medium",
    config: {},
    sortOrder: 0,
  };

  it("reports the standing instead of complaining about a missing threshold", () => {
    const evidence = {
      academicRecords: [{ type: "institution_scale", value: 10.5, scaleMax: 12 }],
    } as unknown as ApplicantEvidence;

    const result = evaluateCriterion(criterion, evidence);
    expect(result?.status).toBe("unknown");
    expect(result?.evidence[0]).toContain("10.5");
    expect(result?.evidence[0]).toContain("No minimum was set");
  });

  it("still says so plainly when the student shared nothing", () => {
    const evidence = { academicRecords: [] } as unknown as ApplicantEvidence;
    expect(evaluateCriterion(criterion, evidence)?.evidence[0]).toContain("No academic standing shared");
  });
});
