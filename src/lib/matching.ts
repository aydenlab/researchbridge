import {
  COMPENSATION_PREFERENCE_LABELS,
  DURATION_LABELS,
  PAID_COMPENSATION,
  type CompensationPreferenceOption,
  type DurationOption,
} from "@/lib/labels";

/**
 * Matching runs over a small number of independent dimensions, each scored out
 * of its own weight and then summed. Keeping the weights in one table is what
 * lets a new dimension be added without silently rescaling the old ones: the
 * score is always reported as a percentage of the weight that actually applied,
 * so a student who has not filled in their durations is not punished for it.
 */
export const MATCH_WEIGHTS = {
  interest: 40,
  duration: 25,
  compensation: 15,
  skills: 12,
  availability: 8,
} as const;

export type MatchDimension = keyof typeof MATCH_WEIGHTS;

export type DimensionScore = {
  dimension: MatchDimension;
  /** Zero when the dimension applied but did not match; null when it did not apply. */
  score: number | null;
  weight: number;
  reason: string | null;
};

export type MatchResult = {
  /** 0 to 100, over the dimensions that applied. Null when none did. */
  percent: number | null;
  points: number;
  applicableWeight: number;
  dimensions: DimensionScore[];
  /** Dimensions that matched, in the words shown to the reader. */
  reasons: string[];
  /** Dimensions that applied and did not match. Worth saying out loud: a
   *  listing ranked lower for running the wrong length should say so rather
   *  than leave the reader guessing why the number is what it is. */
  caveats: string[];
};

function overlap<T>(a: readonly T[], b: readonly T[]): T[] {
  const set = new Set(b);
  return a.filter((item) => set.has(item));
}

function lowerSet(values: readonly string[]): Set<string> {
  return new Set(values.map((value) => value.toLowerCase()));
}

/**
 * Which of the three preference buckets a listing's compensation type falls in.
 * Students answer in buckets because "work study" and "grant funded" are the
 * same answer to the only question they are actually asking, which is whether
 * they get paid.
 */
export function compensationBucket(compensationType: string): CompensationPreferenceOption | null {
  if (PAID_COMPENSATION.has(compensationType)) return "paid";
  if (compensationType === "volunteer" || compensationType === "unpaid") return "volunteer";
  if (compensationType === "academic_credit" || compensationType === "thesis") return "academic_credit";
  return null;
}

/**
 * Everything a listing can honestly claim to offer. A paid position that also
 * carries course credit answers both questions, so a student who only wants
 * credit should still see it as a match: scoring it on the pay bucket alone
 * would rank it below an unpaid listing for exactly the wrong reason.
 */
export function compensationBuckets(opportunity: {
  compensationType: string;
  academicCreditAvailable?: boolean;
}): CompensationPreferenceOption[] {
  const buckets = new Set<CompensationPreferenceOption>();
  const primary = compensationBucket(opportunity.compensationType);
  if (primary) buckets.add(primary);
  if (opportunity.academicCreditAvailable) buckets.add("academic_credit");
  return [...buckets];
}

function listPhrase(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

export type StudentMatchInput = {
  fieldNames: string[];
  skillNames: string[];
  durations: DurationOption[];
  compensationPreferences: CompensationPreferenceOption[];
  weeklyHours: number | null;
  locationPreference: string | null;
  hasExperience: boolean;
};

export type OpportunityMatchInput = {
  fieldNames: string[];
  skillNames: string[];
  durations: DurationOption[];
  compensationType: string;
  academicCreditAvailable?: boolean;
  hoursPerWeekMin: number | null;
  locationMode: string;
  beginnerFriendly: boolean;
  priorResearchRequired: boolean;
};

/**
 * Scores one student against one listing. Deliberately symmetric: the same
 * function ranks listings for a student and students for a listing, so the two
 * sides of the platform can never disagree about who is a good fit.
 */
export function scoreMatch(student: StudentMatchInput, opportunity: OpportunityMatchInput): MatchResult {
  const dimensions: DimensionScore[] = [];

  // Research interest.
  if (student.fieldNames.length > 0 && opportunity.fieldNames.length > 0) {
    const studentFields = lowerSet(student.fieldNames);
    const matched = opportunity.fieldNames.filter((name) => studentFields.has(name.toLowerCase()));
    const ratio = Math.min(matched.length / Math.min(opportunity.fieldNames.length, 2), 1);
    dimensions.push({
      dimension: "interest",
      score: ratio * MATCH_WEIGHTS.interest,
      weight: MATCH_WEIGHTS.interest,
      reason: matched.length > 0 ? `Matches your interest in ${listPhrase(matched.slice(0, 2))}` : null,
    });
  } else {
    dimensions.push({ dimension: "interest", score: null, weight: MATCH_WEIGHTS.interest, reason: null });
  }

  // Duration. Overlap on any single value is a full match: a student wanting one
  // term and a supervisor open to one term or a year want the same thing.
  if (student.durations.length > 0 && opportunity.durations.length > 0) {
    const shared = overlap(opportunity.durations, student.durations);
    dimensions.push({
      dimension: "duration",
      score: shared.length > 0 ? MATCH_WEIGHTS.duration : 0,
      weight: MATCH_WEIGHTS.duration,
      reason:
        shared.length > 0
          ? `Runs for ${listPhrase(shared.map((value) => DURATION_LABELS[value].toLowerCase()))}, which you are looking for`
          : "Runs for a different length than you are looking for",
    });
  } else {
    dimensions.push({ dimension: "duration", score: null, weight: MATCH_WEIGHTS.duration, reason: null });
  }

  // Paid, volunteer, or for credit. A listing can sit in more than one bucket,
  // and matching any single one the student asked for is a full match.
  const buckets = compensationBuckets(opportunity);
  if (student.compensationPreferences.length > 0 && buckets.length > 0) {
    const matchedBuckets = overlap(buckets, student.compensationPreferences);
    dimensions.push({
      dimension: "compensation",
      score: matchedBuckets.length > 0 ? MATCH_WEIGHTS.compensation : 0,
      weight: MATCH_WEIGHTS.compensation,
      reason:
        matchedBuckets.length > 0
          ? listPhrase(matchedBuckets.map((value) => COMPENSATION_PREFERENCE_LABELS[value]))
          : "Not the kind of position you said you were looking for",
    });
  } else {
    dimensions.push({ dimension: "compensation", score: null, weight: MATCH_WEIGHTS.compensation, reason: null });
  }

  // Skills.
  if (student.skillNames.length > 0 && opportunity.skillNames.length > 0) {
    const studentSkills = lowerSet(student.skillNames);
    const matched = opportunity.skillNames.filter((name) => studentSkills.has(name.toLowerCase()));
    const ratio = Math.min(matched.length / Math.min(opportunity.skillNames.length, 3), 1);
    dimensions.push({
      dimension: "skills",
      score: ratio * MATCH_WEIGHTS.skills,
      weight: MATCH_WEIGHTS.skills,
      reason: matched.length > 0 ? `You listed ${listPhrase(matched.slice(0, 3))}` : null,
    });
  } else {
    dimensions.push({ dimension: "skills", score: null, weight: MATCH_WEIGHTS.skills, reason: null });
  }

  // Hours and location.
  const availabilityChecks: number[] = [];
  let availabilityReason: string | null = null;
  if (student.weeklyHours !== null && opportunity.hoursPerWeekMin !== null) {
    const fits = student.weeklyHours >= opportunity.hoursPerWeekMin;
    availabilityChecks.push(fits ? 1 : 0);
    if (fits) availabilityReason = `Fits your ${student.weeklyHours} hours per week`;
  }
  if (student.locationPreference) {
    const fits = opportunity.locationMode === student.locationPreference || opportunity.locationMode === "hybrid";
    availabilityChecks.push(fits ? 1 : 0);
  }
  if (availabilityChecks.length > 0) {
    const ratio = availabilityChecks.reduce((total, value) => total + value, 0) / availabilityChecks.length;
    dimensions.push({
      dimension: "availability",
      score: ratio * MATCH_WEIGHTS.availability,
      weight: MATCH_WEIGHTS.availability,
      reason: availabilityReason,
    });
  } else {
    dimensions.push({ dimension: "availability", score: null, weight: MATCH_WEIGHTS.availability, reason: null });
  }

  let points = dimensions.reduce((total, entry) => total + (entry.score ?? 0), 0);
  const applicableWeight = dimensions.reduce((total, entry) => total + (entry.score === null ? 0 : entry.weight), 0);

  // Experience fit is a nudge rather than a dimension: it moves a listing up or
  // down the page without ever being the reason one is shown.
  const reasons = dimensions
    .filter((entry) => entry.score !== null && entry.score > 0 && entry.reason)
    .map((entry) => entry.reason as string);

  const caveats = dimensions
    .filter((entry) => entry.score === 0 && entry.reason)
    .map((entry) => entry.reason as string);

  if (!student.hasExperience && opportunity.beginnerFriendly) {
    points += 4;
    reasons.push("Open to students without previous research");
  }
  if (!student.hasExperience && opportunity.priorResearchRequired) {
    points -= 10;
  }

  const percent = applicableWeight > 0 ? Math.max(0, Math.min(100, Math.round((points / applicableWeight) * 100))) : null;

  return { percent, points, applicableWeight, dimensions, reasons, caveats };
}
