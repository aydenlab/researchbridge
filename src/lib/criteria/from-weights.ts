import { slugify } from "@/lib/format";
import type { CriterionImportance, CriterionType } from "./types";

/**
 * The one-page posting form asks for five weights on a 0-100 slider instead of
 * walking a supervisor through building criteria by hand. The weights are not a
 * score: they decide which evidence a reviewer sees first, which is exactly what
 * a criterion's importance already means. So a weight becomes a criterion, and a
 * weight left at zero becomes nothing at all.
 */
export const WEIGHT_FIELDS = [
  "weightGpa",
  "weightExtracurriculars",
  "weightPriorResearch",
  "weightResearchInterests",
  "weightSkills",
] as const;

export type WeightField = (typeof WEIGHT_FIELDS)[number];
export type Weights = Record<WeightField, number>;

export const DEFAULT_WEIGHT = 50;

export type CriterionDraft = {
  type: CriterionType;
  label: string;
  description: string | null;
  required: boolean;
  importance: CriterionImportance;
  config: Record<string, unknown>;
  sortOrder: number;
};

/** A slider position, clamped and rounded. Anything unreadable falls back to 0. */
export function readWeight(raw: FormDataEntryValue | null): number {
  const value = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function readWeights(formData: FormData): Weights {
  return Object.fromEntries(WEIGHT_FIELDS.map((field) => [field, readWeight(formData.get(field))])) as Weights;
}

/** 0 drops the criterion; the rest split the slider into the three levels the schema has. */
export function importanceOf(weight: number): CriterionImportance | null {
  if (weight <= 0) return null;
  if (weight <= 33) return "low";
  if (weight <= 66) return "medium";
  return "high";
}

export function criteriaFromWeights({
  weights,
  field,
  skillNames,
  priorResearchRequired,
}: {
  weights: Weights;
  /** The research field chosen on the form, used to match stated interests. */
  field: { name: string; slug: string } | null;
  skillNames: string[];
  priorResearchRequired: boolean;
}): CriterionDraft[] {
  const drafts: { weight: number; draft: Omit<CriterionDraft, "sortOrder"> }[] = [];

  function add(weight: number, draft: Omit<CriterionDraft, "sortOrder" | "importance" | "required">) {
    const importance = importanceOf(weight);
    if (!importance) return;
    drafts.push({ weight, draft: { ...draft, required: false, importance } });
  }

  add(weights.weightGpa, {
    type: "academic_metric",
    label: "GPA and academic standing",
    // No threshold: the form never asks for a cut-off, and a weight is not one.
    // The evaluator reports what the student shared and leaves the judgement.
    description: "Weighted on the posting form. No minimum was set, so this reports academic standing rather than filtering on it.",
    config: {},
  });

  add(weights.weightExtracurriculars, {
    type: "custom",
    label: "Extracurricular involvement",
    description: "Clubs, volunteering, teaching, and other commitments outside coursework.",
    config: {},
  });

  if (priorResearchRequired) {
    // The checkbox above the sliders is a hard condition, so it outranks
    // whatever the slider says and becomes a required criterion.
    drafts.push({
      weight: 101,
      draft: {
        type: "prior_research",
        label: "Previous research experience",
        description: "Marked as required on the posting form.",
        required: true,
        importance: "required",
        config: { minExperiences: 1 },
      },
    });
  } else {
    add(weights.weightPriorResearch, {
      type: "prior_research",
      label: "Previous research experience",
      description: "Lab, field, or project work already listed on the profile.",
      config: { minExperiences: 1 },
    });
  }

  if (field) {
    add(weights.weightResearchInterests, {
      type: "research_interest",
      label: `Research interest in ${field.name}`,
      description: "How closely the student's stated interests line up with this project.",
      config: { fieldSlugs: [field.slug] },
    });
  }

  for (const name of skillNames) {
    add(weights.weightSkills, {
      type: "skill",
      label: name,
      description: null,
      config: { skillSlug: slugify(name), skillName: name },
    });
  }

  return drafts
    .sort((a, b) => b.weight - a.weight)
    .map(({ draft }, index) => ({ ...draft, sortOrder: index }));
}
