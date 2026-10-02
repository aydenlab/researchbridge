import { and, desc, eq, inArray } from "drizzle-orm";
import {
  aiAnalyses,
  criterionEvaluations,
  db,
  researchExperiences,
  researchFields,
  skills,
  studentCompensationPreferences,
  studentDurations,
  studentResearchInterests,
  studentSkills,
} from "@/db";
import { analysisToCriterionResults } from "@/lib/ai/application-analysis";
import { applicationAnalysisSchema } from "@/lib/ai/schemas";
import { applicantFit, type ApplicantFit } from "@/lib/criteria/fit";
import type { Criterion, CriterionResult } from "@/lib/criteria/types";
import type { CompensationPreferenceOption, DurationOption } from "@/lib/labels";
import { scoreMatch, type OpportunityMatchInput, type StudentMatchInput } from "@/lib/matching";

// One loader for the listing side of matching, so the review screens and the
// student dashboard can never read a listing differently.
export { loadOpportunityMatchInput } from "./recommendations";

/**
 * The listing side of matching, from a detail bundle a page has already loaded.
 * Skills nobody needs are left out and academic credit is carried through, the
 * same as the loader above, so the rail and the review screen agree with it.
 */
export function matchInputFromDetail(detail: {
  fields: { name: string }[];
  skills: { name: string; requirementLevel: string }[];
  durations: string[];
  opportunity: {
    compensationType: string;
    academicCreditAvailable: boolean;
    hoursPerWeekMin: number | null;
    locationMode: string;
    beginnerFriendly: boolean;
    priorResearchRequired: boolean;
  };
}): OpportunityMatchInput {
  return {
    fieldNames: detail.fields.map((field) => field.name),
    skillNames: detail.skills.filter((skill) => skill.requirementLevel !== "not_required").map((skill) => skill.name),
    durations: detail.durations as DurationOption[],
    compensationType: detail.opportunity.compensationType,
    academicCreditAvailable: detail.opportunity.academicCreditAvailable,
    hoursPerWeekMin: detail.opportunity.hoursPerWeekMin,
    locationMode: detail.opportunity.locationMode,
    beginnerFriendly: detail.opportunity.beginnerFriendly,
    priorResearchRequired: detail.opportunity.priorResearchRequired,
  };
}

export type ApplicantFitSubject = {
  applicationId: string;
  studentId: string;
  weeklyHours: number | null;
  locationPreference: string | null;
};

/**
 * Scores a whole applicant pool at once.
 *
 * The rail and the review screen have to agree to the percentage point, so both
 * read the same stored evidence: the deterministic criterion rows written at
 * submission, plus the stored written-response analysis where one exists. A
 * pool of forty costs a fixed handful of queries rather than one per applicant.
 */
export async function loadApplicantFits(input: {
  criteria: Criterion[];
  opportunity: OpportunityMatchInput;
  applicants: ApplicantFitSubject[];
  /** False scores on the deterministic evidence alone, to show what the model changed. */
  withAnalysis?: boolean;
}): Promise<Map<string, ApplicantFit>> {
  const fits = new Map<string, ApplicantFit>();
  if (input.applicants.length === 0) return fits;

  const applicationIds = input.applicants.map((applicant) => applicant.applicationId);
  const studentIds = [...new Set(input.applicants.map((applicant) => applicant.studentId))];

  const [evaluationRows, analysisRows, fieldRows, skillRows, durationRows, compensationRows, experienceRows] =
    await Promise.all([
      db.select().from(criterionEvaluations).where(inArray(criterionEvaluations.applicationId, applicationIds)),
      db
        .select({
          applicationId: aiAnalyses.applicationId,
          result: aiAnalyses.result,
          createdAt: aiAnalyses.createdAt,
        })
        .from(aiAnalyses)
        .where(and(inArray(aiAnalyses.applicationId, applicationIds), eq(aiAnalyses.status, "ok")))
        .orderBy(desc(aiAnalyses.createdAt)),
      db
        .select({ studentId: studentResearchInterests.studentId, name: researchFields.name })
        .from(studentResearchInterests)
        .innerJoin(researchFields, eq(researchFields.id, studentResearchInterests.researchFieldId))
        .where(inArray(studentResearchInterests.studentId, studentIds)),
      db
        .select({ studentId: studentSkills.studentId, name: skills.name })
        .from(studentSkills)
        .innerJoin(skills, eq(skills.id, studentSkills.skillId))
        .where(inArray(studentSkills.studentId, studentIds)),
      db
        .select({ studentId: studentDurations.studentId, duration: studentDurations.duration })
        .from(studentDurations)
        .where(inArray(studentDurations.studentId, studentIds)),
      db
        .select({
          studentId: studentCompensationPreferences.studentId,
          preference: studentCompensationPreferences.preference,
        })
        .from(studentCompensationPreferences)
        .where(inArray(studentCompensationPreferences.studentId, studentIds)),
      db
        .select({ studentId: researchExperiences.studentId })
        .from(researchExperiences)
        .where(inArray(researchExperiences.studentId, studentIds)),
    ]);

  const group = <Row, Value>(rows: Row[], key: (row: Row) => string, value: (row: Row) => Value) => {
    const map = new Map<string, Value[]>();
    for (const row of rows) map.set(key(row), [...(map.get(key(row)) ?? []), value(row)]);
    return map;
  };

  const evaluationsBy = group(
    evaluationRows,
    (row) => row.applicationId,
    (row): CriterionResult => ({
      criterionId: row.criterionId,
      status: row.status,
      score: row.score === null ? undefined : Number(row.score),
      maxScore: row.maxScore === null ? undefined : Number(row.maxScore),
      evidence: row.evidence ?? [],
      source: row.source,
    }),
  );

  // Rows arrive newest first, so the first one seen for an application wins.
  const analysisBy = new Map<string, CriterionResult[]>();
  for (const row of analysisRows) {
    if (analysisBy.has(row.applicationId)) continue;
    const parsed = applicationAnalysisSchema.safeParse(row.result);
    if (!parsed.success) continue;
    analysisBy.set(row.applicationId, analysisToCriterionResults(input.criteria, parsed.data));
  }

  const fieldsBy = group(fieldRows, (row) => row.studentId, (row) => row.name);
  const skillsBy = group(skillRows, (row) => row.studentId, (row) => row.name);
  const durationsBy = group(durationRows, (row) => row.studentId, (row) => row.duration as DurationOption);
  const compensationBy = group(
    compensationRows,
    (row) => row.studentId,
    (row) => row.preference as CompensationPreferenceOption,
  );
  const withExperience = new Set(experienceRows.map((row) => row.studentId));

  for (const applicant of input.applicants) {
    const student: StudentMatchInput = {
      fieldNames: fieldsBy.get(applicant.studentId) ?? [],
      skillNames: skillsBy.get(applicant.studentId) ?? [],
      durations: durationsBy.get(applicant.studentId) ?? [],
      compensationPreferences: compensationBy.get(applicant.studentId) ?? [],
      weeklyHours: applicant.weeklyHours,
      locationPreference: applicant.locationPreference,
      hasExperience: withExperience.has(applicant.studentId),
    };

    const stored = evaluationsBy.get(applicant.applicationId) ?? [];
    const results = [
      ...stored.filter((result) => result.source !== "ai_assisted"),
      ...(input.withAnalysis === false ? [] : (analysisBy.get(applicant.applicationId) ?? [])),
    ];

    fits.set(
      applicant.applicationId,
      applicantFit(input.criteria, results, scoreMatch(student, input.opportunity)),
    );
  }

  return fits;
}
