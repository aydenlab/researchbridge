import { DISCIPLINES } from "@/lib/disciplines";
import {
  describeTrackRecord,
  documentsSkill,
  hasDocumentation,
  researchStrength,
  type DocumentedEvidence,
} from "@/lib/evidence/documented";
import { slugify } from "@/lib/format";
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
 *
 * Research and skills read what the resume and research history document,
 * never the skills list a student typed. Research track record is the second
 * heaviest dimension: prior research roles and publications are the strongest
 * evidence a student can bring.
 */
export const MATCH_WEIGHTS = {
  interest: 32,
  research: 24,
  duration: 18,
  skills: 12,
  compensation: 9,
  availability: 5,
} as const;

export type MatchDimension = keyof typeof MATCH_WEIGHTS;

export type DimensionScore = {
  dimension: MatchDimension;
  /** Zero when the dimension applied but did not match; null when it did not apply. */
  score: number | null;
  weight: number;
  reason: string | null;
  /** True when the reason is something to flag rather than a point in favour. */
  caveat?: boolean;
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

/**
 * How much credit a near miss earns on each dimension. Matching used to be all
 * or nothing, which meant a student interested in Neuroscience scored zero on a
 * Neurology listing and a student who could give eight hours scored zero on a
 * ten-hour one. Neither is a bad fit, and both fell off the list. A near miss
 * now earns part of the weight and is still named as a caveat.
 */
export const PARTIAL_CREDIT = {
  /** A listing field in the same discipline as one of the student's interests. */
  relatedField: 0.5,
  /** A length one step away from one the student asked for. */
  nearbyDuration: 0.5,
  /** A different kind of compensation from the one the student wanted. */
  otherCompensation: 0.3,
  /** Listed skills, none of which this listing names. Skills are learnable. */
  noSharedSkill: 0.25,
  /** The lowest share of a listing's minimum hours that still earns credit. */
  hoursFloor: 0.75,
} as const;

/** Points taken off for no prior research on a listing that requires it. */
export const PRIOR_RESEARCH_PENALTY = 6;

const DISCIPLINES_BY_AREA = (() => {
  const map = new Map<string, Set<string>>();
  for (const discipline of DISCIPLINES) {
    for (const area of discipline.areas) {
      const key = slugify(area);
      map.set(key, new Set([...(map.get(key) ?? []), discipline.slug]));
    }
  }
  return map;
})();

function disciplinesOf(fieldName: string): Set<string> {
  return DISCIPLINES_BY_AREA.get(slugify(fieldName)) ?? new Set();
}

/** Lengths a step apart. A one-semester student is a reasonable ask for a two-semester project. */
const NEARBY_DURATIONS: Record<DurationOption, DurationOption[]> = {
  one_semester: ["two_semesters", "summer_only"],
  summer_only: ["one_semester"],
  two_semesters: ["one_semester", "one_year"],
  one_year: ["two_semesters", "multi_year"],
  multi_year: ["one_year"],
};

function listPhrase(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

export type StudentMatchInput = {
  fieldNames: string[];
  durations: DurationOption[];
  compensationPreferences: CompensationPreferenceOption[];
  weeklyHours: number | null;
  locationPreference: string | null;
  /** What the resume and research history show. Self-reported skills are not part of matching. */
  documented: DocumentedEvidence;
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
  /** A Future Research Opportunity has no length yet, so duration does not apply. */
  futureOpportunity?: boolean;
};

/**
 * Scores one student against one listing. Deliberately symmetric: the same
 * function ranks listings for a student and students for a listing, so the two
 * sides of the platform can never disagree about who is a good fit.
 */
export function scoreMatch(student: StudentMatchInput, opportunity: OpportunityMatchInput): MatchResult {
  const dimensions: DimensionScore[] = [];

  // Research interest. An exact field counts in full; a field in the same
  // discipline as one the student named counts for part of it.
  if (student.fieldNames.length > 0 && opportunity.fieldNames.length > 0) {
    const studentFields = lowerSet(student.fieldNames);
    const studentDisciplines = new Set(student.fieldNames.flatMap((name) => [...disciplinesOf(name)]));
    const matched = opportunity.fieldNames.filter((name) => studentFields.has(name.toLowerCase()));
    const related = opportunity.fieldNames.filter(
      (name) =>
        !studentFields.has(name.toLowerCase()) && [...disciplinesOf(name)].some((slug) => studentDisciplines.has(slug)),
    );
    const credit = matched.length + related.length * PARTIAL_CREDIT.relatedField;
    const ratio = Math.min(credit / Math.min(opportunity.fieldNames.length, 2), 1);
    dimensions.push({
      dimension: "interest",
      score: ratio * MATCH_WEIGHTS.interest,
      weight: MATCH_WEIGHTS.interest,
      reason:
        matched.length > 0
          ? `Matches your interest in ${listPhrase(matched.slice(0, 2))}`
          : related.length > 0
            ? `Close to your research interests: ${listPhrase(related.slice(0, 2))}`
            : null,
    });
  } else {
    dimensions.push({ dimension: "interest", score: null, weight: MATCH_WEIGHTS.interest, reason: null });
  }

  // Research track record, from the resume and the research entries on the
  // profile. A listing that welcomes beginners does not hold its absence
  // against anyone, so it earns half the weight there instead of none.
  const strength = researchStrength(student.documented);
  const track = describeTrackRecord(student.documented);
  const researchScore = opportunity.beginnerFriendly ? Math.max(strength, 0.5) : strength;
  dimensions.push({
    dimension: "research",
    score: researchScore * MATCH_WEIGHTS.research,
    weight: MATCH_WEIGHTS.research,
    reason: track
      ? `Your ${student.documented.hasResume ? "resume shows" : "profile lists"} ${track}`
      : opportunity.beginnerFriendly
        ? null
        : "No research experience or publications found on your resume yet",
    caveat: !track && !opportunity.beginnerFriendly,
  });

  // Duration. Overlap on any single value is a full match: a student wanting one
  // term and a supervisor open to one term or a year want the same thing. A
  // length one step away is a partial match rather than none.
  if (student.durations.length > 0 && opportunity.durations.length > 0 && !opportunity.futureOpportunity) {
    const shared = overlap(opportunity.durations, student.durations);
    const nearby = opportunity.durations.filter((value) =>
      student.durations.some((wanted) => NEARBY_DURATIONS[wanted]?.includes(value)),
    );
    if (shared.length > 0) {
      dimensions.push({
        dimension: "duration",
        score: MATCH_WEIGHTS.duration,
        weight: MATCH_WEIGHTS.duration,
        reason: `Runs for ${listPhrase(shared.map((value) => DURATION_LABELS[value].toLowerCase()))}, which you are looking for`,
      });
    } else if (nearby.length > 0) {
      dimensions.push({
        dimension: "duration",
        score: MATCH_WEIGHTS.duration * PARTIAL_CREDIT.nearbyDuration,
        weight: MATCH_WEIGHTS.duration,
        reason: `Runs for ${listPhrase(nearby.map((value) => DURATION_LABELS[value].toLowerCase()))}, a different length than you are looking for but close to it`,
        caveat: true,
      });
    } else {
      dimensions.push({
        dimension: "duration",
        score: 0,
        weight: MATCH_WEIGHTS.duration,
        reason: "Runs for a different length than you are looking for",
        caveat: true,
      });
    }
  } else {
    dimensions.push({ dimension: "duration", score: null, weight: MATCH_WEIGHTS.duration, reason: null });
  }

  // Paid, volunteer, or for credit. A listing can sit in more than one bucket,
  // and matching any single one the student asked for is a full match. A
  // different kind still earns a little: plenty of students would take an
  // unpaid position in the right lab, and only they can decide that.
  const buckets = compensationBuckets(opportunity);
  if (student.compensationPreferences.length > 0 && buckets.length > 0) {
    const matchedBuckets = overlap(buckets, student.compensationPreferences);
    const matched = matchedBuckets.length > 0;
    dimensions.push({
      dimension: "compensation",
      score: matched ? MATCH_WEIGHTS.compensation : MATCH_WEIGHTS.compensation * PARTIAL_CREDIT.otherCompensation,
      weight: MATCH_WEIGHTS.compensation,
      reason: matched
        ? listPhrase(matchedBuckets.map((value) => COMPENSATION_PREFERENCE_LABELS[value]))
        : "Not the kind of position you said you were looking for",
      caveat: !matched,
    });
  } else {
    dimensions.push({ dimension: "compensation", score: null, weight: MATCH_WEIGHTS.compensation, reason: null });
  }

  // Skills, judged on whether the resume or research history shows them. A
  // student with documented work, just not these exact skills, can learn them.
  if (hasDocumentation(student.documented) && opportunity.skillNames.length > 0) {
    const matched = opportunity.skillNames.filter((name) => documentsSkill(student.documented, name) !== null);
    const ratio = Math.max(
      Math.min(matched.length / Math.min(opportunity.skillNames.length, 3), 1),
      PARTIAL_CREDIT.noSharedSkill,
    );
    dimensions.push({
      dimension: "skills",
      score: ratio * MATCH_WEIGHTS.skills,
      weight: MATCH_WEIGHTS.skills,
      reason:
        matched.length > 0
          ? `Your ${student.documented.hasResume ? "resume" : "research experience"} shows ${listPhrase(matched.slice(0, 3))}`
          : null,
    });
  } else {
    dimensions.push({ dimension: "skills", score: null, weight: MATCH_WEIGHTS.skills, reason: null });
  }

  // Hours and location. A student a few hours short of the minimum is close
  // enough to be worth a conversation, so hours earn credit in proportion.
  const availabilityChecks: number[] = [];
  let availabilityReason: string | null = null;
  if (student.weeklyHours !== null && opportunity.hoursPerWeekMin !== null && opportunity.hoursPerWeekMin > 0) {
    const share = student.weeklyHours / opportunity.hoursPerWeekMin;
    availabilityChecks.push(share >= 1 ? 1 : share >= PARTIAL_CREDIT.hoursFloor ? share : 0);
    if (share >= 1) availabilityReason = `Fits your ${student.weeklyHours} hours per week`;
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

  // Openness to beginners is a nudge rather than a dimension: it moves a listing
  // up or down the page without ever being the reason one is shown.
  const reasons = dimensions
    .filter((entry) => !entry.caveat && entry.score !== null && entry.score > 0 && entry.reason)
    .map((entry) => entry.reason as string);

  const caveats = dimensions.filter((entry) => entry.caveat && entry.reason).map((entry) => entry.reason as string);

  const hasResearch = student.documented.researchCount > 0;
  if (!hasResearch && opportunity.beginnerFriendly) {
    points += 4;
    reasons.push("Open to students without previous research");
  }
  if (!hasResearch && opportunity.priorResearchRequired) {
    points -= PRIOR_RESEARCH_PENALTY;
  }

  const percent = applicableWeight > 0 ? Math.max(0, Math.min(100, Math.round((points / applicableWeight) * 100))) : null;

  return { percent, points, applicableWeight, dimensions, reasons, caveats };
}
