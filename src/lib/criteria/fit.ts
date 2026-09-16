import type { MatchResult } from "@/lib/matching";
import type { Criterion, CriterionResult } from "./types";
import { summarizeAlignment, type AlignmentSummary } from "./weights";

/**
 * One number for one application, and it is always there.
 *
 * The criteria engine only speaks about criteria, so a position posted without
 * any leaves a reviewer with nothing at all, and so does a position whose
 * criteria all came back "no information". Neither is the applicant's fault.
 * Every submitted application therefore falls back to the same profile-against-
 * listing match that the student was shown before they applied, which needs no
 * criteria, no written answers, and no model call.
 *
 * This is a summary of evidence rather than a recommendation: nothing here
 * orders candidates, and it is never the only thing on the screen.
 */
export type FitBasis = "criteria_and_profile" | "criteria" | "profile" | "none";

export type FitBand = "strong" | "good" | "partial" | "limited";

export type ApplicantFit = {
  /** 0 to 100. Always a number so there is never an empty score on a review. */
  percent: number;
  band: FitBand;
  basis: FitBasis;
  /** Says in one line what the number was computed from. */
  note: string;
  summary: AlignmentSummary;
};

export const FIT_BAND_LABEL: Record<FitBand, string> = {
  strong: "Strong fit",
  good: "Good fit",
  partial: "Partial fit",
  limited: "Limited fit",
};

const BASIS_NOTE: Record<FitBasis, string> = {
  criteria_and_profile:
    "Combines the criteria you set for this position with how this student's profile lines up with the listing.",
  criteria: "Computed from the criteria you set for this position.",
  profile:
    "No criterion could be evaluated, so this compares the student's profile against the listing: interests, length, compensation, skills, and availability.",
  none: "There was not enough information on this profile to compare it against the listing.",
};

/** How much the researcher's own criteria outweigh the generic profile match. */
const CRITERIA_SHARE = 0.65;

/** Required conditions are what a position stands or falls on. */
const REQUIRED_SHARE = 2;
const PREFERENCE_SHARE = 1;

function band(percent: number): FitBand {
  if (percent >= 80) return "strong";
  if (percent >= 60) return "good";
  if (percent >= 35) return "partial";
  return "limited";
}

/** Zero to one over the criteria that could actually be judged, or null. */
function criteriaFraction(summary: AlignmentSummary): number | null {
  // Unknowns are left out rather than counted as a failure, which is the same
  // rule the criteria panel states to the reviewer.
  const decidedRequired = summary.requiredMet + summary.requiredUnmet;
  const required = decidedRequired > 0 ? summary.requiredMet / decidedRequired : null;
  const preference = summary.preferencePercent === null ? null : summary.preferencePercent / 100;

  if (required !== null && preference !== null) {
    return (required * REQUIRED_SHARE + preference * PREFERENCE_SHARE) / (REQUIRED_SHARE + PREFERENCE_SHARE);
  }
  return required ?? preference;
}

export function applicantFit(
  criteria: Criterion[],
  results: CriterionResult[],
  match: MatchResult | null,
): ApplicantFit {
  const summary = summarizeAlignment(criteria, results);
  const fromCriteria = criteriaFraction(summary);
  const fromProfile = match?.percent === null || match?.percent === undefined ? null : match.percent / 100;

  let fraction: number | null;
  let basis: FitBasis;

  if (fromCriteria !== null && fromProfile !== null) {
    fraction = fromCriteria * CRITERIA_SHARE + fromProfile * (1 - CRITERIA_SHARE);
    basis = "criteria_and_profile";
  } else if (fromCriteria !== null) {
    fraction = fromCriteria;
    basis = "criteria";
  } else if (fromProfile !== null) {
    fraction = fromProfile;
    basis = "profile";
  } else {
    fraction = null;
    basis = "none";
  }

  const percent = fraction === null ? 0 : Math.max(0, Math.min(100, Math.round(fraction * 100)));

  return { percent, band: band(percent), basis, note: BASIS_NOTE[basis], summary };
}
