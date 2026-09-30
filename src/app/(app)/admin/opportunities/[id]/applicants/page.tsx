import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPanel, DataTable } from "@/components/app/admin-ui";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-pill";
import { Badge } from "@/components/ui/badge";
import { requireApplicationReader } from "@/lib/auth/permissions";
import type { ApplicationStatus } from "@/lib/application-status";
import { FIT_BAND_LABEL, type FitBasis } from "@/lib/criteria/fit";
import { formatShortDate } from "@/lib/format";
import { log } from "@/lib/log";
import { loadRankedApplicants, type RankedApplicant } from "@/lib/queries/admin-ranking";

export const metadata: Metadata = {
  title: "Ranked applicants",
  robots: { index: false, follow: false },
};

const BASIS_LABEL: Record<FitBasis, string> = {
  criteria_and_profile: "Criteria and profile",
  criteria: "Criteria only",
  profile: "Profile only",
  none: "Nothing to score",
};

function AnalysisCell({ row }: { row: RankedApplicant }) {
  const run = row.analysis;
  if (!run) return <Badge tone="outline">Not run</Badge>;
  if (run.status !== "ok") {
    return (
      <div>
        <Badge tone="bad">Failed</Badge>
        <p className="mt-1 font-mono text-[11px] text-subtle">{run.errorCode ?? "unknown error"}</p>
      </div>
    );
  }
  return (
    <div>
      <Badge tone="ok">Ran</Badge>
      <p className="mt-1 font-mono text-[11px] text-subtle">{run.model ?? "model not recorded"}</p>
      <p className="text-[11px] text-subtle">{formatShortDate(run.createdAt)}</p>
    </div>
  );
}

function Delta({ value }: { value: number }) {
  if (value === 0) return <span className="font-mono text-[12.5px] text-subtle">0</span>;
  return (
    <span className={`font-mono text-[12.5px] ${value > 0 ? "text-ok" : "text-bad"}`}>
      {value > 0 ? `+${value}` : value}
    </span>
  );
}

/**
 * A position's applicants in fit order, as the pilot operator's check on the
 * scoring. Showing the score with and without the written-response analysis
 * side by side is what makes a model that is off obvious at a glance.
 */
export default async function AdminRankedApplicantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireApplicationReader();

  const data = await loadRankedApplicants(id);
  if (!data) notFound();
  const { detail, criteria, ranked } = data;

  log.info("admin_ranked_applicants_read", { userId: user.id, opportunityId: id });

  const ran = ranked.filter((row) => row.analysis?.status === "ok").length;
  const failed = ranked.filter((row) => row.analysis && row.analysis.status !== "ok").length;

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-4">
        <Link
          href="/admin/opportunities"
          className="text-[13px] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink"
        >
          All opportunities
        </Link>
      </nav>

      <PageHeader
        eyebrow="Admin, ranked applicants"
        title={detail.opportunity.title}
        lede="Applicants in order of the fit score the researcher sees. The researcher's own list is never ranked; this order is for checking the scoring."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        {[
          { label: "Applicants", value: ranked.length },
          { label: "Criteria set", value: criteria.length },
          { label: "Analysis ran", value: ran },
          { label: "Analysis failed", value: failed },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[12px] border border-line bg-white px-5 py-4">
            <p className="text-[12px] text-subtle">{stat.label}</p>
            <p className="font-display text-[24px] leading-tight text-ink">{stat.value}</p>
          </div>
        ))}
      </div>

      {criteria.length > 0 ? (
        <AdminPanel title="Criteria for this position" description="What the analysis is asked to find evidence for">
          <ul className="flex flex-col gap-2 px-5 py-4">
            {criteria.map((criterion) => (
              <li key={criterion.id} className="flex flex-wrap items-baseline gap-2 text-[13px]">
                <Badge tone={criterion.required ? "clay" : "outline"}>{criterion.required ? "Required" : "Preferred"}</Badge>
                <span className="font-medium text-ink">{criterion.label}</span>
                {criterion.description ? <span className="text-muted">{criterion.description}</span> : null}
              </li>
            ))}
          </ul>
        </AdminPanel>
      ) : null}

      <div className="mt-5">
        <AdminPanel title="Applicants by fit" description="Ties go to whoever applied first">
          <DataTable
            caption="Applicants ranked by fit"
            empty="No applications have been submitted to this position yet."
            columns={["Rank", "Student", "Fit", "Without analysis", "Analysis effect", "Required", "Preferred", "Analysis", "Status"]}
            rows={ranked.map((row) => {
              const { applicant, fit, fitWithoutAnalysis } = row;
              const summary = fit.summary;
              return [
                <span key={`${applicant.id}-rank`} className="font-display text-[18px] text-ink">
                  {row.rank}
                </span>,
                <div key={`${applicant.id}-student`}>
                  <Link
                    href={`/admin/opportunities/${id}/applicants/${applicant.id}`}
                    className="text-[13.5px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:text-forest"
                  >
                    {applicant.preferredName ?? applicant.firstName} {applicant.lastName}
                  </Link>
                  <p className="mt-0.5 text-[12px] text-subtle">{applicant.program ?? "Program not set"}</p>
                </div>,
                <div key={`${applicant.id}-fit`}>
                  <p className="font-display text-[20px] leading-none text-ink">{fit.percent}%</p>
                  <p className="mt-1 text-[11.5px] text-muted">{FIT_BAND_LABEL[fit.band]}</p>
                  <p className="text-[11px] text-subtle">{BASIS_LABEL[fit.basis]}</p>
                </div>,
                <span key={`${applicant.id}-base`} className="font-mono text-[13px] text-muted">
                  {fitWithoutAnalysis.percent}%
                </span>,
                <Delta key={`${applicant.id}-delta`} value={fit.percent - fitWithoutAnalysis.percent} />,
                <div key={`${applicant.id}-required`} className="text-[12px] leading-5">
                  {summary.requiredTotal === 0 ? (
                    <span className="text-subtle">None</span>
                  ) : (
                    <>
                      <p className="text-ok">{summary.requiredMet} met</p>
                      {summary.requiredUnmet > 0 ? <p className="text-bad">{summary.requiredUnmet} not met</p> : null}
                      {summary.requiredUnknown > 0 ? <p className="text-subtle">{summary.requiredUnknown} unknown</p> : null}
                    </>
                  )}
                </div>,
                <div key={`${applicant.id}-preferred`} className="text-[12px] leading-5">
                  {summary.preferencePercent === null ? (
                    <span className="text-subtle">Not scored</span>
                  ) : (
                    <>
                      <p className="text-ink">{summary.preferencePercent}%</p>
                      <p className="text-subtle">
                        {summary.evaluatedPreferences} scored
                        {summary.unscoredPreferences > 0 ? `, ${summary.unscoredPreferences} not` : ""}
                      </p>
                    </>
                  )}
                </div>,
                <AnalysisCell key={`${applicant.id}-analysis`} row={row} />,
                <StatusPill key={`${applicant.id}-status`} status={applicant.status as ApplicationStatus} />,
              ];
            })}
          />
        </AdminPanel>
      </div>
    </div>
  );
}
