import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import { aiAnalyses, applicationSnapshots, applications, criterionEvaluations, db, opportunityCriteria } from "@/db";
import { ANALYSIS_TYPE, analysisInputHash, runApplicationAnalysis } from "@/lib/ai/application-analysis";
import { refreshStaleEvidence, staleEvidenceStudentIds } from "@/lib/evidence/refresh";
import { loadRankedApplicants } from "@/lib/queries/admin-ranking";
import { PAID_COMPENSATION } from "@/lib/labels";
import { log } from "@/lib/log";
import { loadApplication, loadCriteria } from "@/lib/queries/applications";
import { loadSubmittedEvidence, rescoreDeterministicCriteria } from "./rescore";
import { AI_ASSISTED_TYPES, DETERMINISTIC_TYPES, type Criterion } from "./types";

/** Failures that mean "stop calling the model for now", not "this one input is bad". */
const STOP_REASONS = new Set(["throttled", "budget_exceeded", "provider_unavailable", "missing_api_key", "invalid_api_key"]);

/**
 * Re-runs the written-response analysis on every submitted application whose
 * inputs have changed since it last ran: a different prompt, edited criteria,
 * or a resume reading that now feeds it. Each application is analysed on what
 * the student submitted, read the same way the rule-based criteria are.
 *
 * The analysis is keyed on a hash of its inputs, so an application whose
 * inputs are unchanged costs nothing. It stops at the first sign of throttling
 * or an exhausted budget and picks up from there on the next run.
 */
export async function rerunApplicationAnalyses(
  options: { limit?: number; opportunityId?: string; studentId?: string; dryRun?: boolean } = {},
) {
  const rows = await db
    .select({
      applicationId: applications.id,
      studentId: applications.studentId,
      opportunityId: applications.opportunityId,
      profile: applicationSnapshots.profile,
    })
    .from(applications)
    .leftJoin(applicationSnapshots, eq(applicationSnapshots.applicationId, applications.id))
    .where(
      and(
        notInArray(applications.status, ["draft", "withdrawn"]),
        options.opportunityId ? eq(applications.opportunityId, options.opportunityId) : undefined,
        options.studentId ? eq(applications.studentId, options.studentId) : undefined,
      ),
    );
  if (rows.length === 0) return { applications: 0, stale: 0, rerun: 0, stopped: null as string | null };

  const evidenceBy = await loadSubmittedEvidence(rows);
  const latest = new Map<string, string>();
  for (const row of await db
    .select({ applicationId: aiAnalyses.applicationId, inputHash: aiAnalyses.inputHash, status: aiAnalyses.status })
    .from(aiAnalyses)
    .where(
      and(
        inArray(
          aiAnalyses.applicationId,
          rows.map((row) => row.applicationId),
        ),
        eq(aiAnalyses.type, ANALYSIS_TYPE),
        eq(aiAnalyses.status, "ok"),
      ),
    )
    .orderBy(desc(aiAnalyses.createdAt))) {
    if (!latest.has(row.applicationId)) latest.set(row.applicationId, row.inputHash);
  }

  const criteriaBy = new Map<string, Criterion[]>();
  let stale = 0;
  let rerun = 0;
  let stopped: string | null = null;

  for (const row of rows) {
    if (options.limit !== undefined && rerun >= options.limit) break;
    const base = evidenceBy.get(row.applicationId);
    if (!base) continue;

    if (!criteriaBy.has(row.opportunityId)) criteriaBy.set(row.opportunityId, await loadCriteria(row.opportunityId));
    const criteria = criteriaBy.get(row.opportunityId)!;

    const bundle = await loadApplication(row.applicationId);
    if (!bundle) continue;
    const answersByQuestion = new Map(bundle.answers.map((answer) => [answer.questionId, answer]));
    const evidence = {
      ...base,
      answers: bundle.questions.map((question) => ({
        questionId: question.id,
        prompt: question.prompt,
        text: answersByQuestion.get(question.id)?.textAnswer ?? null,
      })),
    };

    const semantic = criteria.filter((criterion) => AI_ASSISTED_TYPES.includes(criterion.type));
    if (semantic.length === 0 && evidence.answers.length === 0) continue;

    const input = {
      criteria: semantic,
      evidence,
      projectTitle: bundle.opportunity.title,
      projectSummary: bundle.opportunity.summary,
    };
    if (latest.get(row.applicationId) === analysisInputHash(input)) continue;

    stale += 1;
    if (options.dryRun) continue;
    const state = await runApplicationAnalysis({
      applicationId: row.applicationId,
      criteria,
      evidence,
      projectTitle: bundle.opportunity.title,
      projectSummary: bundle.opportunity.summary,
      isPaidPosition: PAID_COMPENSATION.has(bundle.opportunity.compensationType),
      // Staleness was decided above from successful runs only, so a failure
      // cached for these inputs (a missing key at the time, say) is retried.
      force: true,
    });
    if (state.state === "ready") rerun += 1;
    if (state.state === "disabled") {
      stopped = "disabled";
      break;
    }
    if (state.state === "unavailable" && STOP_REASONS.has(state.reason)) {
      stopped = state.reason;
      break;
    }
  }

  return { applications: rows.length, stale, rerun, stopped };
}

/**
 * Everything matching stores, brought up to date for every student and every
 * application: resume readings, rule-based criteria, and written-response
 * analysis. Fit percentages, rankings, and recommendations are computed from
 * these on every page load, so once this finishes they all reflect the
 * current rules.
 */
export async function rerunAllMatching(options: { useModel: boolean; analysisLimit?: number }) {
  const evidence = await refreshStaleEvidence({ useModel: options.useModel, limit: 5000 });
  const criteria = await rescoreDeterministicCriteria();
  const analyses = options.useModel ? await rerunApplicationAnalyses({ limit: options.analysisLimit }) : null;
  log.info("matching_rerun_completed", { evidence, criteria, analyses });
  return { evidence, criteria, analyses };
}

/**
 * Counts anything matching has left out of date, without changing it. Every
 * number should be zero once the background pass has caught up; it is logged
 * after each pass so production can be checked without database access.
 */
export async function matchingHealth() {
  const submitted = await db
    .select({ id: applications.id, opportunityId: applications.opportunityId, studentId: applications.studentId })
    .from(applications)
    .where(notInArray(applications.status, ["draft", "withdrawn"]));

  const deterministic = await db
    .select({ id: opportunityCriteria.id, opportunityId: opportunityCriteria.opportunityId })
    .from(opportunityCriteria)
    .where(inArray(opportunityCriteria.type, DETERMINISTIC_TYPES));
  const graded = new Set(
    (
      await db
        .select({ applicationId: criterionEvaluations.applicationId, criterionId: criterionEvaluations.criterionId })
        .from(criterionEvaluations)
        .where(eq(criterionEvaluations.source, "deterministic"))
    ).map((row) => `${row.applicationId}:${row.criterionId}`),
  );
  const criteriaFor = new Map<string, string[]>();
  for (const row of deterministic) criteriaFor.set(row.opportunityId, [...(criteriaFor.get(row.opportunityId) ?? []), row.id]);
  const ungraded = submitted.filter((application) =>
    (criteriaFor.get(application.opportunityId) ?? []).some((criterionId) => !graded.has(`${application.id}:${criterionId}`)),
  ).length;

  const analyses = await rerunApplicationAnalyses({ dryRun: true });
  const pendingResumes = (await staleEvidenceStudentIds({ includeModelPending: true })).length;

  // Every applicant on every position gets a fit figure; count any that fail.
  let fitsComputed = 0;
  let fitFailures = 0;
  for (const opportunityId of new Set(submitted.map((row) => row.opportunityId))) {
    try {
      const ranked = await loadRankedApplicants(opportunityId);
      fitsComputed += ranked?.ranked.filter((row) => Number.isFinite(row.fit.percent)).length ?? 0;
    } catch {
      fitFailures += 1;
    }
  }

  return {
    applications: submitted.length,
    ungradedApplications: ungraded,
    staleAnalyses: analyses.stale,
    resumesAwaitingReading: pendingResumes,
    fitsComputed,
    fitFailures,
  };
}
