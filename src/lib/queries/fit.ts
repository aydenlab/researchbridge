import { and, desc, eq, inArray } from "drizzle-orm";
import {
  aiAnalyses,
  criterionEvaluations,
  db,
  researchFields,
  studentCompensationPreferences,
  studentDurations,
  studentResearchInterests,
} from "@/db";
import { analysisToCriterionResults } from "@/lib/ai/application-analysis";
import { applicationAnalysisSchema } from "@/lib/ai/schemas";
import { applicantFit, type ApplicantFit } from "@/lib/criteria/fit";
import type { Criterion, CriterionResult } from "@/lib/criteria/types";
import type { CompensationPreferenceOption, DurationOption } from "@/lib/labels";
import { scoreMatch, type OpportunityMatchInput, type StudentMatchInput } from "@/lib/matching";
import { EMPTY_DOCUMENTED } from "@/lib/evidence/documented";
import { loadDocumentedEvidence } from "@/lib/evidence/refresh";
import { evaluateDeterministic } from "@/lib/criteria/engine";
import { loadCriteria } from "./applications";
import { loadOpportunityMatchInput as loadOpportunityMatchInputFor, studentMatchInput } from "./recommendations";
import { loadStudentProfile, toApplicantEvidence } from "./student";

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
    futureOpportunity: boolean;
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
    futureOpportunity: detail.opportunity.futureOpportunity,
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

  const [evaluationRows, analysisRows, fieldRows, durationRows, compensationRows, documented] =
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
      loadDocumentedEvidence(studentIds),
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
  const durationsBy = group(durationRows, (row) => row.studentId, (row) => row.duration as DurationOption);
  const compensationBy = group(
    compensationRows,
    (row) => row.studentId,
    (row) => row.preference as CompensationPreferenceOption,
  );

  for (const applicant of input.applicants) {
    const student: StudentMatchInput = {
      fieldNames: fieldsBy.get(applicant.studentId) ?? [],
      durations: durationsBy.get(applicant.studentId) ?? [],
      compensationPreferences: compensationBy.get(applicant.studentId) ?? [],
      weeklyHours: applicant.weeklyHours,
      locationPreference: applicant.locationPreference,
      documented: documented.get(applicant.studentId) ?? EMPTY_DOCUMENTED,
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

export type CandidateRanking = {
  percent: number;
  band: ApplicantFit["band"];
  basis: ApplicantFit["basis"];
  reasons: string[];
};

/**
 * Ranks students who have not applied against one of the researcher's
 * positions, on exactly the figure their applicant rail would show: the
 * criteria the researcher set (GPA weight, prior research, skills read from
 * the resume) combined with the profile match. Scoped to the students already
 * on the page, so paging the directory never scores the whole platform.
 */
export async function rankCandidatesAgainst(
  opportunityId: string,
  studentIds: string[],
): Promise<Map<string, CandidateRanking>> {
  const rankings = new Map<string, CandidateRanking>();
  if (studentIds.length === 0) return rankings;

  const [input, criteria] = await Promise.all([loadOpportunityMatchInputFor(opportunityId), loadCriteria(opportunityId)]);
  if (!input) return rankings;

  const bundles = await Promise.all(studentIds.map((id) => loadStudentProfile(id)));
  for (const bundle of bundles) {
    if (!bundle) continue;
    const match = scoreMatch(studentMatchInput(bundle), input);
    const results = evaluateDeterministic(criteria, toApplicantEvidence(bundle, []));
    const fit = applicantFit(criteria, results, match);
    rankings.set(bundle.profile.userId, { percent: fit.percent, band: fit.band, basis: fit.basis, reasons: match.reasons });
  }
  return rankings;
}
