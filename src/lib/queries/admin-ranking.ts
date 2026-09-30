import { and, desc, eq, inArray } from "drizzle-orm";
import { aiAnalyses, db } from "@/db";
import { ANALYSIS_TYPE } from "@/lib/ai/application-analysis";
import type { ApplicantFit } from "@/lib/criteria/fit";
import type { Criterion } from "@/lib/criteria/types";
import type { DurationOption } from "@/lib/labels";
import { listApplicantsForOpportunity, type ApplicantRow } from "./applications";
import { loadApplicantFits } from "./fit";
import { loadOpportunityDetail } from "./opportunities";

export type AnalysisRun = {
  status: string;
  errorCode: string | null;
  model: string | null;
  createdAt: Date;
};

export type RankedApplicant = {
  rank: number;
  applicant: ApplicantRow;
  /** What the researcher sees, written-response analysis included. */
  fit: ApplicantFit;
  /** The same figure on deterministic evidence alone. */
  fitWithoutAnalysis: ApplicantFit;
  /** The latest analysis attempt, successful or not, or null if none ran. */
  analysis: AnalysisRun | null;
};

/**
 * One position's applicant pool ordered by fit, for the pilot operator checking
 * whether the written-response analysis is scoring sensibly. Researchers never
 * see an order: their rail stays in submission order, and this lives only
 * behind the application-reader check.
 */
export async function loadRankedApplicants(opportunityId: string) {
  const [detail, applicants] = await Promise.all([
    loadOpportunityDetail(opportunityId),
    listApplicantsForOpportunity(opportunityId),
  ]);
  if (!detail) return null;

  const criteria: Criterion[] = detail.criteria.map((criterion) => ({
    id: criterion.id,
    type: criterion.type,
    label: criterion.label,
    description: criterion.description,
    required: criterion.required,
    importance: criterion.importance,
    config: criterion.config,
    sortOrder: criterion.sortOrder,
  }));

  const fitInput = {
    criteria,
    opportunity: {
      fieldNames: detail.fields.map((field) => field.name),
      skillNames: detail.skills.map((skill) => skill.name),
      durations: detail.durations as DurationOption[],
      compensationType: detail.opportunity.compensationType,
      hoursPerWeekMin: detail.opportunity.hoursPerWeekMin,
      locationMode: detail.opportunity.locationMode,
      beginnerFriendly: detail.opportunity.beginnerFriendly,
      priorResearchRequired: detail.opportunity.priorResearchRequired,
    },
    applicants: applicants.map((applicant) => ({
      applicationId: applicant.id,
      studentId: applicant.studentId,
      weeklyHours: applicant.weeklyHours,
      locationPreference: applicant.locationPreference,
    })),
  };

  const ids = applicants.map((applicant) => applicant.id);
  const [fits, baseFits, runRows] = await Promise.all([
    loadApplicantFits(fitInput),
    loadApplicantFits({ ...fitInput, withAnalysis: false }),
    ids.length === 0
      ? Promise.resolve([])
      : db
          .select({
            applicationId: aiAnalyses.applicationId,
            status: aiAnalyses.status,
            errorCode: aiAnalyses.errorCode,
            model: aiAnalyses.model,
            createdAt: aiAnalyses.createdAt,
          })
          .from(aiAnalyses)
          .where(and(inArray(aiAnalyses.applicationId, ids), eq(aiAnalyses.type, ANALYSIS_TYPE)))
          .orderBy(desc(aiAnalyses.createdAt)),
  ]);

  // Newest first, so the first row seen for an application is its latest run.
  const runs = new Map<string, AnalysisRun>();
  for (const { applicationId, ...run } of runRows) {
    if (!runs.has(applicationId)) runs.set(applicationId, run);
  }

  const ranked = applicants
    .map((applicant) => ({
      applicant,
      fit: fits.get(applicant.id)!,
      fitWithoutAnalysis: baseFits.get(applicant.id)!,
      analysis: runs.get(applicant.id) ?? null,
    }))
    .sort(
      (a, b) =>
        b.fit.percent - a.fit.percent ||
        (a.applicant.submittedAt?.getTime() ?? 0) - (b.applicant.submittedAt?.getTime() ?? 0),
    )
    .map((row, index): RankedApplicant => ({ ...row, rank: index + 1 }));

  return { detail, criteria, ranked };
}
