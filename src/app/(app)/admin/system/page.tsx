import type { Metadata } from "next";
import { desc, sql } from "drizzle-orm";
import { aiAnalyses, auditLogs, db, waitlistEntries } from "@/db";
import { AdminPanel, DataTable } from "@/components/app/admin-ui";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/permissions";
import { activeDriver } from "@/db";
import { anthropicAvailable } from "@/lib/ai/anthropic";
import { formatUsd, isPricedModel } from "@/lib/ai/pricing";
import { spendSummary } from "@/lib/ai/spend";
import { env } from "@/lib/env";
import { allFlags } from "@/lib/flags";
import { formatShortDate } from "@/lib/format";
import { WAITLIST_STATUS_LABELS, labelOr } from "@/lib/labels";
import { FlagToggle } from "./flag-toggle";

export const metadata: Metadata = {
  title: "System",
  robots: { index: false, follow: false },
};

const FLAG_DESCRIPTIONS: Record<string, string> = {
  AI_ANALYSIS_ENABLED: "Claude evidence analysis on submitted applications. Deterministic criteria keep working when this is off.",
  VIDEO_RESPONSES_ENABLED: "Allow researchers to request a short video response on a position.",
  WAITLIST_ENABLED: "Public waitlist and researcher interest forms accept submissions.",
  PUBLIC_SIGNUP_ENABLED: "New accounts can be created directly from an institutional email.",
  RESEARCHER_SIGNUP_ENABLED: "Researchers can register interest and create accounts.",
};

export default async function AdminSystemPage() {
  await requireAdmin();

  const [flags, aiRows, auditRows, waitlist, aiStats, spend] = await Promise.all([
    allFlags(),
    db.select().from(aiAnalyses).orderBy(desc(aiAnalyses.createdAt)).limit(12),
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(20),
    db.select().from(waitlistEntries).orderBy(desc(waitlistEntries.createdAt)).limit(50),
    db
      .select({
        total: sql<number>`count(*)::int`,
        failed: sql<number>`count(*) filter (where ${aiAnalyses.status} <> 'ok')::int`,
        inputTokens: sql<number>`coalesce(sum(${aiAnalyses.inputTokens}), 0)::int`,
        outputTokens: sql<number>`coalesce(sum(${aiAnalyses.outputTokens}), 0)::int`,
      })
      .from(aiAnalyses),
    spendSummary(),
  ]);

  const stats = aiStats[0];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Admin"
        title="System"
        lede="Feature flags, integration health, pilot participant lists, and the audit trail."
        actions={
          <>
            <ButtonLink href="/api/admin/export?dataset=waitlist" variant="outline">
              Export waitlist
            </ButtonLink>
            <ButtonLink href="/api/admin/export?dataset=placements" variant="outline">
              Export placements
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <AdminPanel title="Feature flags" description="Stored in the database and cached for thirty seconds.">
          <ul className="divide-y divide-line">
            {Object.entries(flags).map(([key, enabled]) => (
              <li key={key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="font-mono text-[13px] text-ink">{key}</p>
                  <p className="mt-1 text-[12.5px] leading-5 text-muted">{FLAG_DESCRIPTIONS[key]}</p>
                </div>
                <FlagToggle flagKey={key} enabled={enabled} />
              </li>
            ))}
          </ul>
        </AdminPanel>

        <AdminPanel title="Integration health" description="What is configured in this environment.">
          <dl className="divide-y divide-line">
            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <dt className="text-[13.5px] text-ink">Database driver</dt>
              <dd>
                <Badge tone={activeDriver() === "postgres" ? "ok" : "warn"}>{activeDriver()}</Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <dt className="text-[13.5px] text-ink">Anthropic API key</dt>
              <dd>
                <Badge tone={anthropicAvailable() ? "ok" : "warn"}>{anthropicAvailable() ? "Configured" : "Not set"}</Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <dt className="text-[13.5px] text-ink">Model</dt>
              <dd className="font-mono text-[12.5px] text-muted">{env.ANTHROPIC_MODEL}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <dt className="text-[13.5px] text-ink">Email provider</dt>
              <dd>
                <Badge tone={env.EMAIL_PROVIDER === "console" ? "warn" : "ok"}>{env.EMAIL_PROVIDER}</Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <dt className="text-[13.5px] text-ink">File storage</dt>
              <dd>
                <Badge tone={env.FILE_STORAGE_PROVIDER === "local" ? "warn" : "ok"}>{env.FILE_STORAGE_PROVIDER}</Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <dt className="text-[13.5px] text-ink">Analyses run</dt>
              <dd className="text-[13px] text-muted">
                {stats.total} total, {stats.failed} failed
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <dt className="text-[13.5px] text-ink">Approximate tokens used</dt>
              <dd className="text-[13px] text-muted">
                {stats.inputTokens} in, {stats.outputTokens} out
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <dt className="text-[13.5px] text-ink">Spend today</dt>
              <dd className="text-[13px] text-muted">
                {formatUsd(spend.dayUsd)} of {formatUsd(spend.dailyLimitUsd)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <dt className="text-[13.5px] text-ink">Spend this month</dt>
              <dd className="text-[13px] text-muted">
                {formatUsd(spend.monthUsd)} of {formatUsd(spend.monthlyLimitUsd)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <dt className="text-[13.5px] text-ink">Prompt cache hit rate</dt>
              <dd className="text-[13px] text-muted">
                {Math.round(spend.cacheHitRate * 100)} percent of prompt tokens this month
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <dt className="text-[13.5px] text-ink">Budget</dt>
              <dd>
                <Badge tone={spend.exceeded ? "warn" : "ok"}>
                  {spend.exceeded ? `${spend.exceeded} limit reached` : "Within limits"}
                </Badge>
              </dd>
            </div>
          </dl>
          <p className="border-t border-line px-5 py-3 text-[12px] leading-5 text-subtle">
            {isPricedModel(env.ANTHROPIC_MODEL)
              ? "Spend is estimated from published list prices and the token counts the provider reports."
              : `Spend for ${env.ANTHROPIC_MODEL} is estimated at Opus list prices because it is not in the price table.`}{" "}
            When a budget is reached, analysis stops until the next period and the deterministic criteria keep running.
          </p>
          <p className="border-t border-line px-5 py-3 text-[12px] leading-5 text-subtle">
            When the email provider is console, verification codes are printed to the server log rather than sent. Local
            file storage is not durable on Railway, so connect object storage before relying on uploads in production.
          </p>
        </AdminPanel>
      </div>

      <div className="mt-6">
        <AdminPanel title="Pilot participants" description={`${waitlist.length} waitlist and interest entries`}>
          <DataTable
            caption="Waitlist and researcher interest"
            empty="Nobody has joined the waitlist yet."
            columns={["Name", "Kind", "Email", "Details", "Status", "Joined"]}
            rows={waitlist.map((entry) => [
              `${entry.firstName} ${entry.lastName}`,
              <Badge key={`${entry.id}-kind`} tone={entry.kind === "researcher" ? "forest" : "outline"}>
                {entry.kind}
              </Badge>,
              entry.email,
              <div key={`${entry.id}-detail`} className="text-[12.5px] leading-5">
                {entry.kind === "student" ? (
                  <>
                    <p>{entry.program ?? "Program not set"}</p>
                    <p className="text-subtle">{entry.yearLevel ?? "Year not set"}</p>
                  </>
                ) : (
                  <>
                    <p>{entry.department ?? "Department not set"}</p>
                    <p className="text-subtle">
                      {entry.expectedStudentCount ? `${entry.expectedStudentCount} students expected` : "Count not stated"}
                    </p>
                  </>
                )}
              </div>,
              labelOr(WAITLIST_STATUS_LABELS, entry.status),
              formatShortDate(entry.createdAt),
            ])}
          />
        </AdminPanel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AdminPanel title="Recent AI analyses" description="Model, prompt version, and outcome for each run.">
          {aiRows.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13.5px] text-muted">No analyses have run yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {aiRows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[12.5px] text-ink">{row.type}</p>
                    <p className="mt-0.5 text-[11.5px] text-subtle">
                      {row.model ?? "no model"}, prompt version {row.promptVersion}, run{" "}
                      {formatShortDate(row.createdAt)}
                    </p>
                  </div>
                  <Badge tone={row.status === "ok" ? "ok" : "warn"}>{row.errorCode ?? row.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>

        <AdminPanel title="Audit log" description="Administrative and security-relevant actions.">
          {auditRows.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13.5px] text-muted">Nothing recorded yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {auditRows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <div className="min-w-0">
                    <p className="font-mono text-[12.5px] text-ink">{row.action}</p>
                    <p className="mt-0.5 text-[11.5px] text-subtle">
                      {row.subjectType ?? "system"}, {formatShortDate(row.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
      </div>
    </div>
  );
}
