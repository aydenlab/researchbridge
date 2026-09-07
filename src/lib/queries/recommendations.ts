import { and, desc, eq, inArray, ne, notInArray } from "drizzle-orm";
import {
  db,
  researchFields,
  skills,
  studentCompensationPreferences,
  studentDurations,
  studentProfiles,
  studentResearchInterests,
  studentSkills,
  researchExperiences,
  users,
} from "@/db";
import type { StudentProfileBundle } from "./student";
import type { OpportunityListItem } from "./opportunities";
import { searchOpportunities } from "./opportunities";
import { scoreMatch, type MatchResult, type StudentMatchInput } from "@/lib/matching";
import type { CompensationPreferenceOption, DurationOption } from "@/lib/labels";

export type RecommendationReason = string;

export type Recommendation = {
  item: OpportunityListItem;
  score: number;
  percent: number | null;
  reasons: RecommendationReason[];
};

export function studentMatchInput(bundle: StudentProfileBundle): StudentMatchInput {
  return {
    fieldNames: bundle.fields.map((field) => field.name),
    skillNames: bundle.skills.map((skill) => skill.name),
    durations: bundle.durations,
    compensationPreferences: bundle.compensationPreferences,
    weeklyHours: bundle.profile.weeklyHours,
    locationPreference: bundle.profile.locationPreference,
    hasExperience: bundle.experiences.length > 0,
  };
}

export function matchOpportunity(student: StudentMatchInput, item: OpportunityListItem): MatchResult {
  return scoreMatch(student, {
    fieldNames: item.fieldNames,
    skillNames: item.skillNames,
    durations: item.durations as DurationOption[],
    compensationType: item.compensationType,
    hoursPerWeekMin: item.hoursPerWeekMin,
    locationMode: item.locationMode,
    beginnerFriendly: item.beginnerFriendly,
    priorResearchRequired: item.priorResearchRequired,
  });
}

export async function recommendOpportunities(
  bundle: StudentProfileBundle,
  options: { limit?: number; excludeIds?: Set<string>; kind?: "research_position" | "review_project" } = {},
): Promise<Recommendation[]> {
  const limit = options.limit ?? 4;
  const { items } = await searchOpportunities({
    openOnly: true,
    perPage: 60,
    sort: "recent",
    kind: options.kind ?? "research_position",
  });

  const student = studentMatchInput(bundle);
  const scored: Recommendation[] = [];

  for (const item of items) {
    if (options.excludeIds?.has(item.id)) continue;
    const result = matchOpportunity(student, item);
    if (result.points <= 0) continue;
    scored.push({ item, score: result.points, percent: result.percent, reasons: result.reasons.slice(0, 3) });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

export type StudentCandidate = {
  userId: string;
  displayName: string;
  program: string | null;
  programCategory: string | null;
  degreeLevel: string | null;
  yearLevel: number | null;
  weeklyHours: number | null;
  locationPreference: string | null;
  fieldNames: string[];
  skillNames: string[];
  durations: DurationOption[];
  compensationPreferences: CompensationPreferenceOption[];
  hasExperience: boolean;
};

/**
 * The other half of matching. Loads enough of every student profile to score it
 * without pulling each one individually, so a researcher browsing candidates
 * costs a handful of queries rather than one per student.
 */
export async function loadStudentCandidates(options: { limit?: number; excludeIds?: string[] } = {}): Promise<
  StudentCandidate[]
> {
  const conditions = [ne(users.accountStatus, "disabled"), eq(users.role, "student")];
  if (options.excludeIds?.length) {
    conditions.push(notInArray(users.id, options.excludeIds));
  }

  const rows = await db
    .select({
      userId: studentProfiles.userId,
      firstName: studentProfiles.firstName,
      lastName: studentProfiles.lastName,
      preferredName: studentProfiles.preferredName,
      program: studentProfiles.program,
      programCategory: studentProfiles.programCategory,
      degreeLevel: studentProfiles.degreeLevel,
      yearLevel: studentProfiles.yearLevel,
      weeklyHours: studentProfiles.weeklyHours,
      locationPreference: studentProfiles.locationPreference,
    })
    .from(studentProfiles)
    .innerJoin(users, eq(users.id, studentProfiles.userId))
    .where(and(...conditions))
    .orderBy(desc(studentProfiles.profileCompletion))
    .limit(options.limit ?? 200);

  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.userId);

  const [fieldRows, skillRows, durationRows, compensationRows, experienceRows] = await Promise.all([
    db
      .select({ studentId: studentResearchInterests.studentId, name: researchFields.name })
      .from(studentResearchInterests)
      .innerJoin(researchFields, eq(researchFields.id, studentResearchInterests.researchFieldId))
      .where(inArray(studentResearchInterests.studentId, ids)),
    db
      .select({ studentId: studentSkills.studentId, name: skills.name })
      .from(studentSkills)
      .innerJoin(skills, eq(skills.id, studentSkills.skillId))
      .where(inArray(studentSkills.studentId, ids)),
    db
      .select({ studentId: studentDurations.studentId, duration: studentDurations.duration })
      .from(studentDurations)
      .where(inArray(studentDurations.studentId, ids)),
    db
      .select({ studentId: studentCompensationPreferences.studentId, preference: studentCompensationPreferences.preference })
      .from(studentCompensationPreferences)
      .where(inArray(studentCompensationPreferences.studentId, ids)),
    db
      .select({ studentId: researchExperiences.studentId })
      .from(researchExperiences)
      .where(inArray(researchExperiences.studentId, ids)),
  ]);

  const group = <T, K extends string>(entries: T[], key: (row: T) => string, value: (row: T) => K) => {
    const map = new Map<string, K[]>();
    for (const row of entries) map.set(key(row), [...(map.get(key(row)) ?? []), value(row)]);
    return map;
  };

  const fieldsBy = group(fieldRows, (row) => row.studentId, (row) => row.name);
  const skillsBy = group(skillRows, (row) => row.studentId, (row) => row.name);
  const durationsBy = group(durationRows, (row) => row.studentId, (row) => row.duration);
  const compensationBy = group(compensationRows, (row) => row.studentId, (row) => row.preference);
  const withExperience = new Set(experienceRows.map((row) => row.studentId));

  return rows.map((row) => ({
    userId: row.userId,
    displayName: `${row.preferredName ?? row.firstName} ${row.lastName}`.trim(),
    program: row.program,
    programCategory: row.programCategory,
    degreeLevel: row.degreeLevel,
    yearLevel: row.yearLevel,
    weeklyHours: row.weeklyHours,
    locationPreference: row.locationPreference,
    fieldNames: fieldsBy.get(row.userId) ?? [],
    skillNames: skillsBy.get(row.userId) ?? [],
    durations: durationsBy.get(row.userId) ?? [],
    compensationPreferences: compensationBy.get(row.userId) ?? [],
    hasExperience: withExperience.has(row.userId),
  }));
}

export function candidateMatchInput(candidate: StudentCandidate): StudentMatchInput {
  return {
    fieldNames: candidate.fieldNames,
    skillNames: candidate.skillNames,
    durations: candidate.durations,
    compensationPreferences: candidate.compensationPreferences,
    weeklyHours: candidate.weeklyHours,
    locationPreference: candidate.locationPreference,
    hasExperience: candidate.hasExperience,
  };
}
