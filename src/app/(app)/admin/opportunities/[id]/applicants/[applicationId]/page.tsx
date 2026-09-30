import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ApplicationDetail } from "@/components/app/application-detail";
import { CriteriaEvidence, type AiState } from "@/components/app/criteria-evidence";
import { StatusPill } from "@/components/app/status-pill";
import { requireApplicationReader } from "@/lib/auth/permissions";
import { analysisToCriterionResults, loadStoredAnalysis, type AnalysisState } from "@/lib/ai/application-analysis";
import type { ApplicationStatus } from "@/lib/application-status";
import { FIT_BAND_LABEL } from "@/lib/criteria/fit";
import type { CriterionResult } from "@/lib/criteria/types";
import { formatDate } from "@/lib/format";
import { COURSE_TYPE_LABELS, DEGREE_LABELS, PAID_COMPENSATION, labelOr } from "@/lib/labels";
import { log } from "@/lib/log";
import { loadRankedApplicants } from "@/lib/queries/admin-ranking";
import { loadApplication, loadCriterionResults } from "@/lib/queries/applications";
import { loadStudentProfile } from "@/lib/queries/student";

export const metadata: Metadata = {
  title: "Applicant, researcher view",
  robots: { index: false, follow: false },
};

const navLink =
  "inline-flex h-8 items-center gap-1 rounded-full border border-line-strong bg-white px-3 text-[12.5px] text-ink hover:bg-shell";

const REPORTABLE_REASONS = new Set<AiState>([
  "missing_api_key",
  "invalid_api_key",
  "throttled",
  "budget_exceeded",
  "provider_unavailable",
]);

function aiStateFor(state: AnalysisState): AiState {
  if (state.state !== "unavailable") return state.state;
  return REPORTABLE_REASONS.has(state.reason as AiState) ? (state.reason as AiState) : "unavailable";
}

/**
 * One applicant as the researcher reviewing them sees it, read-only, with the
 * raw model output underneath so the pilot operator can check the analysis
 * against the answers it was given. Notes and status changes stay with the
 * researcher and are not shown.
 */
export default async function AdminApplicantResearcherViewPage({
  params,
}: {
  params: Promise<{ id: string; applicationId: string }>;
}) {
  const { id, applicationId } = await params;
  const user = await requireApplicationReader();

  const [data, bundle] = await Promise.all([loadRankedApplicants(id), loadApplication(applicationId)]);
  if (!data || !bundle || bundle.opportunity.id !== id || bundle.application.status === "draft") notFound();

  const index = data.ranked.findIndex((row) => row.applicant.id === applicationId);
  if (index < 0) notFound();
  const row = data.ranked[index];
  const previous = index > 0 ? data.ranked[index - 1] : null;
  const next = index < data.ranked.length - 1 ? data.ranked[index + 1] : null;

  log.info("admin_application_read", { userId: user.id, applicationId, view: "researcher" });

  const [profile, storedResults, analysisState] = await Promise.all([
    loadStudentProfile(bundle.application.studentId),
    loadCriterionResults(applicationId),
    loadStoredAnalysis(applicationId),
  ]);

  // Built the same way as the researcher's review screen, so the evidence panel
  // reads identically.
  const aiResults: CriterionResult[] =
    analysisState.state === "ready" ? analysisToCriterionResults(data.criteria, analysisState.analysis) : [];
  const combined: CriterionResult[] = [
    ...storedResults.filter((result) => result.source !== "ai_assisted"),
    ...aiResults,
  ];

  const { fit, fitWithoutAnalysis } = row;
  const delta = fit.percent - fitWithoutAnalysis.percent;
  const displayName = `${bundle.student.preferredName ?? bundle.student.firstName} ${bundle.student.lastName}`;

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/admin/opportunities/${id}/applicants`}
          className="text-[13px] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink"
        >
          Ranked applicants for {bundle.opportunity.title}
        </Link>
        <nav aria-label="Applicant navigation" className="flex items-center gap-2">
          {previous ? (
            <Link href={`/admin/opportunities/${id}/applicants/${previous.applicant.id}`} className={navLink}>
              <ChevronLeft className="size-3.5" aria-hidden="true" />
              Rank {previous.rank}
            </Link>
          ) : null}
          <span className="text-[12.5px] text-muted">
            Rank {row.rank} of {data.ranked.length}
          </span>
          {next ? (
            <Link href={`/admin/opportunities/${id}/applicants/${next.applicant.id}`} className={navLink}>
              Rank {next.rank}
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null}
        </nav>
      </div>

      <header className="rounded-[12px] border border-line bg-white px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="font-display text-[26px] leading-tight text-ink" style={{ letterSpacing: "-0.5px" }}>
              {displayName}
            </h1>
            <p className="mt-1 text-[13.5px] text-muted">
              {bundle.student.program ?? "Program not set"}
              {bundle.student.yearLevel ? `, year ${bundle.student.yearLevel}` : ""}
              {`, ${labelOr(DEGREE_LABELS, bundle.student.degreeLevel).toLowerCase()}`}
            </p>
            {bundle.application.courseType ? (
              <p className="mt-1 text-[12.5px] text-forest">
                Applying as: {labelOr(COURSE_TYPE_LABELS, bundle.application.courseType)}
              </p>
            ) : null}
            <p className="mt-0.5 text-[12.5px] text-subtle">
              Submitted {formatDate(bundle.application.submittedAt)}. Profile is {bundle.student.profileCompletion} percent
              complete.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-[11.5px] text-subtle">Fit</p>
              <p className="font-display text-[26px] leading-none text-ink">{fit.percent}%</p>
              <p className="mt-1 text-[11.5px] text-muted">{FIT_BAND_LABEL[fit.band]}</p>
              <p className="mt-1 text-[11.5px] text-subtle">
                {fitWithoutAnalysis.percent}% without analysis ({delta > 0 ? `+${delta}` : delta})
              </p>
            </div>
            <StatusPill status={bundle.application.status as ApplicationStatus} />
          </div>
        </div>
      </header>

      <CriteriaEvidence
        criteria={data.criteria}
        results={combined}
        fit={fit}
        aiState={aiStateFor(analysisState)}
        isPaidPosition={PAID_COMPENSATION.has(bundle.opportunity.compensationType)}
      />

      <section className="rounded-[12px] border border-line bg-white">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="font-display text-[17px] text-ink">Raw model output</h2>
          <p className="mt-1 text-[12px] leading-5 text-muted">
            {analysisState.state === "ready"
              ? `${analysisState.model ?? "Model not recorded"}, ${formatDate(analysisState.createdAt)}. Only visible here, never to the researcher.`
              : analysisState.state === "unavailable"
                ? `The latest run failed: ${analysisState.reason}.`
                : analysisState.state === "disabled"
                  ? "Analysis is switched off."
                  : "Analysis has not run for this application yet."}
          </p>
        </div>
        {analysisState.state === "ready" ? (
          <pre className="max-h-[520px] overflow-auto px-5 py-4 font-mono text-[11.5px] leading-5 text-ink rb-scroll">
            {JSON.stringify(analysisState.analysis, null, 2)}
          </pre>
        ) : null}
      </section>

      <ApplicationDetail bundle={bundle} profile={profile} />
    </div>
  );
}
