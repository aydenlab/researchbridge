import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader, StatGrid } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-pill";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireResearcher } from "@/lib/auth/permissions";
import type { ApplicationStatus } from "@/lib/application-status";
import { deadlineNote, formatShortDate, hoursLabel } from "@/lib/format";
import { COMPENSATION_LABELS, OPPORTUNITY_STATUS_LABELS, labelOr } from "@/lib/labels";
import { researcherOpportunities, researcherRecentApplicants } from "@/lib/queries/researcher";

export const metadata: Metadata = {
  title: "Researcher home",
  robots: { index: false, follow: false },
};

export default async function ResearcherDashboardPage() {
  const user = await requireResearcher();
  if (user.researcherVerification !== "verified") redirect("/researcher/pending");

  const [rows, recent] = await Promise.all([
    researcherOpportunities(user.id),
    researcherRecentApplicants(user.id, 6),
  ]);

  const published = rows.filter((row) => row.status === "published");
  const drafts = rows.filter((row) => row.status === "draft");
  const closed = rows.filter((row) => row.status === "closed" || row.status === "unpublished");

  const awaiting = rows.reduce((total, row) => total + row.awaitingReview, 0);
  const totalApplications = rows.reduce((total, row) => total + row.applicationCount, 0);
  const filled = rows.reduce((total, row) => total + row.acceptedCount, 0);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title={`Hello, ${user.displayName ?? "there"}`}
        lede="Your open positions and the candidates waiting on you."
        actions={
          <>
            <ButtonLink href="/directory/students" variant="outline">
              Find students
            </ButtonLink>
            <ButtonLink href="/researcher/reviews/new" variant="outline">
              Post a review
            </ButtonLink>
            <ButtonLink href="/researcher/opportunities/new">Post a position</ButtonLink>
          </>
        }
      />

      <StatGrid
        stats={[
          { label: "Active positions", value: String(published.length), hint: drafts.length > 0 ? `${drafts.length} draft not published` : "No drafts open" },
          { label: "Awaiting your review", value: String(awaiting), hint: awaiting > 0 ? "Applications you have not opened" : "Nothing waiting" },
          { label: "Applications received", value: String(totalApplications) },
          { label: "Offers made", value: String(filled) },
        ]}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px] lg:gap-10">
        <div className="min-w-0">
          <section>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-[21px] text-ink" style={{ letterSpacing: "-0.4px" }}>
                Active positions
              </h2>
              <Link href="/researcher/opportunities" className="text-[13px] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink">
                Manage all
              </Link>
            </div>

            {published.length === 0 ? (
              <EmptyState
                title="Post your first research opportunity to begin receiving applications."
                body="One page. You describe the project, say what the work needs, and set how much each part of an application counts."
                actionHref="/researcher/opportunities/new"
                actionLabel="Post opportunity"
              />
            ) : (
              <ul className="overflow-hidden rounded-[12px] border border-line bg-white">
                {published.map((row) => {
                  const deadline = deadlineNote(row.deadline);
                  return (
                    <li key={row.id} className="relative border-b border-line px-4 py-4 last:border-b-0 hover:bg-shell/70 sm:px-5">
                      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-display text-[18px] leading-6 text-ink">
                            <Link href={`/researcher/opportunities/${row.id}/applicants`} className="after:absolute after:inset-0 after:content-['']">
                              {row.title}
                            </Link>
                          </h3>
                          <p className="mt-1 text-[13px] text-muted">{row.summary}</p>
                        </div>
                        {row.awaitingReview > 0 ? (
                          <Badge tone="clay">{row.awaitingReview} awaiting review</Badge>
                        ) : (
                          <Badge tone="outline">Up to date</Badge>
                        )}
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-muted">
                        <span>{row.applicationCount} {row.applicationCount === 1 ? "application" : "applications"}</span>
                        <span>{row.shortlistedCount} shortlisted</span>
                        <span>{hoursLabel(row.hoursPerWeekMin, row.hoursPerWeekMax)}</span>
                        <span className={deadline.urgent ? "text-warn" : ""}>{deadline.text}</span>
                        <span>{row.viewCount} views</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {drafts.length > 0 ? (
            <section className="mt-9">
              <h2 className="mb-3 font-display text-[21px] text-ink" style={{ letterSpacing: "-0.4px" }}>
                Drafts
              </h2>
              <ul className="overflow-hidden rounded-[12px] border border-line bg-white">
                {drafts.map((row) => (
                  <li key={row.id} className="relative border-b border-line px-4 py-3.5 last:border-b-0 hover:bg-shell/70 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14.5px] font-medium text-ink">
                          <Link href={`/researcher/opportunities/${row.id}/edit?step=${row.draftStep}`} className="after:absolute after:inset-0 after:content-['']">
                            {row.title}
                          </Link>
                        </p>
                        <p className="mt-0.5 text-[12.5px] text-muted">
                          Step {row.draftStep} of 9, last edited {formatShortDate(row.updatedAt)}
                        </p>
                      </div>
                      <Badge tone="outline">Draft</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {closed.length > 0 ? (
            <section className="mt-9">
              <h2 className="mb-3 font-display text-[21px] text-ink" style={{ letterSpacing: "-0.4px" }}>
                Closed positions
              </h2>
              <ul className="overflow-hidden rounded-[12px] border border-line bg-white">
                {closed.map((row) => (
                  <li key={row.id} className="relative border-b border-line px-4 py-3.5 last:border-b-0 hover:bg-shell/70 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-[14.5px] text-ink">
                        <Link href={`/researcher/opportunities/${row.id}/applicants`} className="after:absolute after:inset-0 after:content-['']">
                          {row.title}
                        </Link>
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[12.5px] text-muted">{row.applicationCount} applications</span>
                        <Badge tone="neutral">{labelOr(OPPORTUNITY_STATUS_LABELS, row.status)}</Badge>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-5">
          <section className="rounded-[12px] border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="font-display text-[17px] text-ink">Recent applicants</h2>
              <Link href="/researcher/applicants" className="text-[12.5px] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink">
                All
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="px-5 py-5 text-[13.5px] leading-6 text-muted">
                No applications yet. They appear here as soon as students submit.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {recent.map((row) => (
                  <li key={row.id} className="px-5 py-3.5">
                    <Link href={`/researcher/opportunities/${row.opportunityId}/applicants/${row.id}`} className="block">
                      <p className="text-[13.5px] font-medium text-ink">
                        {row.preferredName ?? row.firstName} {row.lastName}
                      </p>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {row.program ?? "Program not set"}
                        {row.yearLevel ? `, year ${row.yearLevel}` : ""}
                      </p>
                      <p className="mt-1 text-[12px] leading-5 text-subtle">{row.opportunityTitle}</p>
                      <div className="mt-1.5">
                        <StatusPill status={row.status as ApplicationStatus} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[12px] border border-line bg-white p-5">
            <h2 className="font-display text-[17px] text-ink">How review works here</h2>
            <p className="mt-2 text-[13px] leading-6 text-muted">
              Availability, coursework, and listed skills are checked in code. Written responses are organized around
              the criteria you set, with the passage each observation came from.
            </p>
            <p className="mt-2 text-[13px] leading-6 text-muted">
              Nothing accepts, declines, or ranks a candidate for you. For positions that may constitute paid
              employment, automated ordering is switched off entirely.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
