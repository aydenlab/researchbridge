import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { CheckCircle2 } from "lucide-react";
import { db, placementOutcomes } from "@/db";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-pill";
import { Badge } from "@/components/ui/badge";
import { requireStudent } from "@/lib/auth/permissions";
import { STATUS_LABELS, STUDENT_STATUS_DESCRIPTION, type ApplicationStatus } from "@/lib/application-status";
import { formatDate, formatShortDate } from "@/lib/format";
import { COMPENSATION_LABELS, QUESTION_TYPE_LABELS, labelOr } from "@/lib/labels";
import { loadApplication } from "@/lib/queries/applications";
import { OutcomeForm, WithdrawForm } from "./client-forms";

export const metadata: Metadata = {
  title: "Application",
  robots: { index: false, follow: false },
};

export default async function ApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { id } = await params;
  const { submitted } = await searchParams;
  const user = await requireStudent();

  const bundle = await loadApplication(id);
  if (!bundle || bundle.application.studentId !== user.id) notFound();

  const outcomeRows = await db.select().from(placementOutcomes).where(eq(placementOutcomes.applicationId, id)).limit(1);
  const outcome = outcomeRows[0] ?? null;

  const answersByQuestion = new Map(bundle.answers.map((answer) => [answer.questionId, answer]));
  const status = bundle.application.status as ApplicationStatus;
  const canWithdraw = !["withdrawn", "declined", "position_filled", "draft"].includes(status);
  const showOutcomePrompt =
    ["accepted", "researcher_contacted", "interview", "declined"].includes(status) && !outcome?.studentReportedOutcome;

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-5">
        <Link href="/applications" className="text-[13px] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink">
          Back to your applications
        </Link>
      </nav>

      {submitted ? (
        <div className="mb-7 flex items-start gap-3 rounded-[12px] border border-[#c2dccc] bg-moss px-5 py-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden="true" />
          <div>
            <p className="font-display text-[19px] text-forest">Application submitted</p>
            <p className="mt-1 text-[14px] leading-6 text-forest/85">
              Your application has been sent to {bundle.researcher.firstName} {bundle.researcher.lastName} for review.
              You can track its status from this page.
            </p>
          </div>
        </div>
      ) : null}

      <PageHeader
        eyebrow="Application"
        title={bundle.opportunity.title}
        lede={`${bundle.researcher.title ? `${bundle.researcher.title} ` : ""}${bundle.researcher.firstName} ${bundle.researcher.lastName}${bundle.opportunity.department ? `, ${bundle.opportunity.department}` : ""}`}
        actions={<StatusPill status={status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_290px] lg:gap-8">
        <div className="min-w-0">
          <section className="rounded-[12px] border border-line bg-white p-5">
            <h2 className="font-display text-[19px] text-ink" style={{ letterSpacing: "-0.4px" }}>
              Where this stands
            </h2>
            <p className="mt-2 text-[14.5px] leading-7 text-muted">{STUDENT_STATUS_DESCRIPTION[status]}</p>
            {bundle.application.submittedAt ? (
              <p className="mt-2 text-[13px] text-muted">Submitted {formatDate(bundle.application.submittedAt)}.</p>
            ) : null}
          </section>

          <section className="mt-6 rounded-[12px] border border-line bg-white p-5">
            <h2 className="font-display text-[19px] text-ink" style={{ letterSpacing: "-0.4px" }}>
              What you sent
            </h2>
            {bundle.questions.length === 0 ? (
              <p className="mt-3 text-[14.5px] leading-7 text-muted">
                This position asked only for your ResearchBridge profile.
              </p>
            ) : (
              <ol className="mt-4 flex flex-col gap-5">
                {bundle.questions.map((question, index) => {
                  const answer = answersByQuestion.get(question.id);
                  const external = (answer?.structuredAnswer as { externalUrl?: string } | null)?.externalUrl;
                  return (
                    <li key={question.id} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
                      <p className="text-[14.5px] leading-6 text-ink">
                        <span className="mr-2 font-mono text-[12px] text-subtle">{String(index + 1).padStart(2, "0")}</span>
                        {question.prompt}
                      </p>
                      <p className="mt-1 pl-8 text-[11.5px] uppercase tracking-[0.08em] text-subtle">
                        {labelOr(QUESTION_TYPE_LABELS, question.type)}
                      </p>
                      <div className="mt-2 pl-8">
                        {answer?.textAnswer ? (
                          <div className="rb-measure whitespace-pre-wrap rounded-[8px] border border-line bg-shell/60 px-3.5 py-3 text-[14px] leading-7 text-muted">
                            {answer.textAnswer}
                          </div>
                        ) : external ? (
                          <a
                            href={external}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13.5px] text-forest underline decoration-line-strong underline-offset-4"
                          >
                            {external}
                          </a>
                        ) : answer?.fileId ? (
                          <p className="text-[13.5px] text-muted">A file was attached to this answer.</p>
                        ) : (
                          <p className="text-[13.5px] text-subtle">No answer recorded.</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {showOutcomePrompt ? (
            <section className="mt-6 rounded-[12px] border border-line bg-white p-5">
              <h2 className="font-display text-[19px] text-ink" style={{ letterSpacing: "-0.4px" }}>
                Did this application result in a research opportunity?
              </h2>
              <p className="mt-2 text-[13.5px] leading-6 text-muted">
                This is asked once and it is the only measure the pilot really cares about. It is not shared with the
                researcher.
              </p>
              <OutcomeForm applicationId={id} />
            </section>
          ) : null}

          {outcome?.studentReportedOutcome ? (
            <section className="mt-6 rounded-[12px] border border-line bg-white p-5">
              <p className="text-[13.5px] text-muted">
                You reported the outcome of this application as{" "}
                <span className="font-medium text-ink">{outcome.studentReportedOutcome.replace(/_/g, " ")}</span>. Thank
                you.
              </p>
            </section>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-[76px] lg:self-start">
          <div className="rounded-[12px] border border-line bg-white p-5">
            <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-subtle">Position</p>
            <Link
              href={`/opportunities/${bundle.opportunity.slug}`}
              className="mt-2 block text-[14.5px] font-medium leading-6 text-ink underline decoration-line-strong underline-offset-4"
            >
              {bundle.opportunity.title}
            </Link>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone="outline">{labelOr(COMPENSATION_LABELS, bundle.opportunity.compensationType)}</Badge>
            </div>
            <dl className="mt-4 divide-y divide-line border-t border-line">
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-[12.5px] text-muted">Deadline</dt>
                <dd className="text-[12.5px] font-medium text-ink">{formatShortDate(bundle.opportunity.deadline)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-[12.5px] text-muted">Submitted</dt>
                <dd className="text-[12.5px] font-medium text-ink">
                  {bundle.application.submittedAt ? formatShortDate(bundle.application.submittedAt) : "Not yet"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-[12.5px] text-muted">Last update</dt>
                <dd className="text-[12.5px] font-medium text-ink">{formatShortDate(bundle.application.updatedAt)}</dd>
              </div>
            </dl>

            {canWithdraw ? (
              <div className="mt-4 border-t border-line pt-4">
                <WithdrawForm applicationId={id} />
              </div>
            ) : null}
          </div>

          <div className="mt-4 rounded-[12px] border border-line bg-white p-5">
            <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-subtle">History</p>
            <ol className="mt-3 flex flex-col gap-3">
              {bundle.history.map((entry) => (
                <li key={entry.id} className="text-[12.5px] leading-5">
                  <p className="font-medium text-ink">{STATUS_LABELS[entry.newStatus as ApplicationStatus]}</p>
                  <p className="text-subtle">{formatShortDate(entry.createdAt)}</p>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
