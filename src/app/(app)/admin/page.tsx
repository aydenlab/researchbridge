import type { Metadata } from "next";
import Link from "next/link";
import { AdminPanel, MetricGrid } from "@/components/app/admin-ui";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/permissions";
import { STATUS_LABELS, type ApplicationStatus } from "@/lib/application-status";
import { formatShortDate } from "@/lib/format";
import { pendingResearchers, pilotMetrics, recentStatusChanges, statusDistribution } from "@/lib/queries/admin";

export const metadata: Metadata = {
  title: "Pilot overview",
  robots: { index: false, follow: false },
};

export default async function AdminOverviewPage() {
  await requireAdmin();

  const [metrics, pending, distribution, changes] = await Promise.all([
    pilotMetrics(),
    pendingResearchers(),
    statusDistribution(),
    recentStatusChanges(12),
  ]);

  const awaiting = pending.filter((row) => row.verificationStatus === "pending" || row.verificationStatus === "needs_review");
  const totalApplications = distribution.reduce((total, row) => total + row.value, 0);

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="ResearchBridge admin"
        title="Pilot overview"
        lede="Signup count is not the goal here. Confirmed research placements are."
        actions={
          <>
            <ButtonLink href="/admin/system" variant="outline">
              System
            </ButtonLink>
            <ButtonLink href="/api/admin/export?dataset=applications">Export applications</ButtonLink>
          </>
        }
      />

      {awaiting.length > 0 ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#e6d7ae] bg-gold-soft px-4 py-3">
          <p className="text-[13.5px] text-warn">
            {awaiting.length} researcher {awaiting.length === 1 ? "account is" : "accounts are"} waiting for review.
            Positions cannot be published until an account is approved.
          </p>
          <ButtonLink href="/admin/researchers" size="sm" variant="outline">
            Review now
          </ButtonLink>
        </div>
      ) : null}

      <MetricGrid metrics={metrics.headline} />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <AdminPanel title="Funnel" description="Where participants are in the pilot.">
          <div className="px-5 py-4">
            <MetricGrid metrics={metrics.funnel} columns={2} />
          </div>
        </AdminPanel>

        <AdminPanel title="Outcomes" description="What the pilot writeup will be built on.">
          <div className="px-5 py-4">
            <MetricGrid metrics={metrics.outcomes} columns={2} />
          </div>
        </AdminPanel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <AdminPanel title="Timing" description="Measured from real events, or marked as not yet measurable.">
          <div className="px-5 py-4">
            <MetricGrid metrics={metrics.timing} columns={2} />
          </div>
        </AdminPanel>

        <AdminPanel title="Application states" description={`${totalApplications} submitted applications`}>
          <ul className="divide-y divide-line">
            {distribution.length === 0 ? (
              <li className="px-5 py-6 text-[13.5px] text-muted">No applications submitted yet.</li>
            ) : (
              distribution.map((row) => (
                <li key={row.status} className="flex items-center justify-between gap-4 px-5 py-2.5">
                  <span className="text-[13.5px] text-ink">{STATUS_LABELS[row.status as ApplicationStatus]}</span>
                  <span className="font-mono text-[13px] text-muted">{row.value}</span>
                </li>
              ))
            )}
          </ul>
        </AdminPanel>
      </div>

      <div className="mt-6">
        <AdminPanel
          title="Recent activity"
          description="Status changes across every position in the pilot."
          action={
            <Link href="/admin/applications" className="text-[13px] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink">
              All applications
            </Link>
          }
        >
          {changes.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13.5px] text-muted">Nothing has happened yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {changes.map((change) => (
                <li key={change.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-[13.5px] text-ink">{change.opportunityTitle}</p>
                    <p className="mt-0.5 text-[12px] text-subtle">
                      {change.previousStatus ? `${STATUS_LABELS[change.previousStatus as ApplicationStatus]} to ` : ""}
                      {STATUS_LABELS[change.newStatus as ApplicationStatus]}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone="outline">{STATUS_LABELS[change.newStatus as ApplicationStatus]}</Badge>
                    <span className="text-[12px] text-subtle">{formatShortDate(change.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
      </div>

      <p className="mt-6 text-[12.5px] leading-6 text-subtle">
        Values marked as not yet measurable are shown that way on purpose. Nothing on this page is estimated or filled
        in with a placeholder number, and self-reported answers are labelled as such.
      </p>
    </div>
  );
}
