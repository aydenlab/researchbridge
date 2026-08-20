import type { Criterion, CriterionImportance, CriterionResult, CriterionStatus } from "./types";

export const IMPORTANCE_WEIGHT: Record<Exclude<CriterionImportance, "required">, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export const IMPORTANCE_LABEL: Record<CriterionImportance, string> = {
  required: "Required",
  high: "High importance",
  medium: "Medium importance",
  low: "Low importance",
};

export const STATUS_FACTOR: Record<CriterionStatus, number | null> = {
  met: 1,
  partially_met: 0.5,
  not_met: 0,
  unknown: null,
};

export function weightOf(criterion: Criterion): number {
  if (criterion.required || criterion.importance === "required") return 0;
  return IMPORTANCE_WEIGHT[criterion.importance as Exclude<CriterionImportance, "required">] ?? 2;
}

export function treatsUnknownAsNotMet(criterion: Criterion): boolean {
  return criterion.config?.unknownCountsAgainst === true;
}

export type AlignmentSummary = {
  requiredTotal: number;
  requiredMet: number;
  requiredUnknown: number;
  requiredUnmet: number;
  preferenceScore: number;
  preferenceMax: number;
  preferencePercent: number | null;
  evaluatedPreferences: number;
  unscoredPreferences: number;
  allRequiredMet: boolean;
};

export function summarizeAlignment(criteria: Criterion[], results: CriterionResult[]): AlignmentSummary {
  const byId = new Map(results.map((result) => [result.criterionId, result]));

  let requiredTotal = 0;
  let requiredMet = 0;
  let requiredUnknown = 0;
  let requiredUnmet = 0;
  let preferenceScore = 0;
  let preferenceMax = 0;
  let evaluatedPreferences = 0;
  let unscoredPreferences = 0;

  for (const criterion of criteria) {
    const result = byId.get(criterion.id);
    const status: CriterionStatus = result?.status ?? "unknown";

    if (criterion.required) {
      requiredTotal += 1;
      if (status === "met") requiredMet += 1;
      else if (status === "unknown") requiredUnknown += 1;
      else requiredUnmet += 1;
      continue;
    }

    const weight = weightOf(criterion);
    if (weight <= 0) continue;

    const factor = STATUS_FACTOR[status];
    if (factor === null) {
      if (treatsUnknownAsNotMet(criterion)) {
        preferenceMax += weight;
        evaluatedPreferences += 1;
      } else {
        unscoredPreferences += 1;
      }
      continue;
    }

    preferenceScore += weight * factor;
    preferenceMax += weight;
    evaluatedPreferences += 1;
  }

  return {
    requiredTotal,
    requiredMet,
    requiredUnknown,
    requiredUnmet,
    preferenceScore: round(preferenceScore),
    preferenceMax: round(preferenceMax),
    preferencePercent: preferenceMax > 0 ? Math.round((preferenceScore / preferenceMax) * 100) : null,
    evaluatedPreferences,
    unscoredPreferences,
    allRequiredMet: requiredUnmet === 0 && requiredUnknown === 0 && requiredTotal > 0,
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
