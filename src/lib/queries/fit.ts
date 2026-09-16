import { and, desc, eq, inArray } from "drizzle-orm";
import {
  aiAnalyses,
  criterionEvaluations,
  db,
  opportunityDurations,
  opportunityFields,
  opportunitySkills,
  opportunities,
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

/**
 * Everything about a listing that the match engine reads, in one round trip.
 * Kept separate from `loadOpportunityDetail` so a page that only needs to score
 * an applicant does not pull criteria, questions, and materials with it.
 */
export async function loadOpportunityMatchInput(opportunityId: string): Promise<OpportunityMatchInput | null> {
  const rows = await db
    .select({
      compensationType: opportunities.compensationType,
      hoursPerWeekMin: opportunities.hoursPerWeekMin,
      locationMode: opportunities.locationMode,
      beginnerFriendly: opportunities.beginnerFriendly,
      priorResearchRequired: opportunities.priorResearchRequired,
    })
    .from(opportunities)
    .where(eq(opportunities.id, opportunityId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const [fieldRows, skillRows, durationRows] = await Promise.all([
    db
      .select({ name: researchFields.name })
      .from(opportunityFields)
      .innerJoin(researchFields, eq(researchFields.id, opportunityFields.researchFieldId))
      .where(eq(opportunityFields.opportunityId, opportunityId)),
    db
      .select({ name: skills.name })
      .from(opportunitySkills)
      .innerJoin(skills, eq(skills.id, opportunitySkills.skillId))
      .where(eq(opportunitySkills.opportunityId, opportunityId)),
    db
      .select({ duration: opportunityDurations.duration })
      .from(opportunityDurations)
      .where(eq(opportunityDurations.opportunityId, opportunityId)),
  ]);

  return {
    fieldNames: fieldRows.map((field) => field.name),
    skillNames: skillRows.map((skill) => skill.name),
    durations: durationRows.map((entry) => entry.duration) as DurationOption[],
    compensationType: row.compensationType,
    hoursPerWeekMin: row.hoursPerWeekMin,
    locationMode: row.locationMode,
    beginnerFriendly: row.beginnerFriendly,
    priorResearchRequired: row.priorResearchRequired,
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
      ...(analysisBy.get(applicant.applicationId) ?? []),
    ];

    fits.set(
      applicant.applicationId,
      applicantFit(input.criteria, results, scoreMatch(student, input.opportunity)),
    );
  }

  return fits;
}
