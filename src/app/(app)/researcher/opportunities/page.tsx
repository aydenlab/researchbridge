import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireResearcher } from "@/lib/auth/permissions";
import { deadlineNote, formatShortDate, hoursLabel } from "@/lib/format";
import { COMPENSATION_LABELS, LOCATION_LABELS, OPPORTUNITY_STATUS_LABELS, labelOr } from "@/lib/labels";
import { researcherOpportunities } from "@/lib/queries/researcher";
import { StatusControls } from "./status-controls";

export const metadata: Metadata = {
  title: "Your opportunities",
  robots: { index: false, follow: false },
};

const STATUS_TONE = {
  published: "forest",
  draft: "outline",
  closed: "neutral",
  unpublished: "warn",
  archived: "neutral",
} as const;

export default async function ResearcherOpportunitiesPage() {
  const user = await requireResearcher();
  if (user.researcherVerification !== "verified") redirect("/researcher/pending");

  const rows = await researcherOpportunities(user.id);

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title="Your opportunities"
        lede="Positions you control. Closing or unpublishing keeps every application and its history intact."
        actions={<ButtonLink href="/researcher/opportunities/new">Post opportunity</ButtonLink>}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Post your first research opportunity to begin receiving applications."
          body="You describe the project, state what matters for it, and write the questions students answer. It takes about ten minutes."
          actionHref="/researcher/opportunities/new"
          actionLabel="Post opportunity"
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((row) => {
            const deadline = deadlineNote(row.deadline);
            return (
              <li key={row.id} className="rounded-[12px] border border-line bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={STATUS_TONE[row.status]}>{labelOr(OPPORTUNITY_STATUS_LABELS, row.status)}</Badge>
                      <Badge tone="outline">{labelOr(COMPENSATION_LABELS, row.compensationType)}</Badge>
                      {row.awaitingReview > 0 ? <Badge tone="clay">{row.awaitingReview} awaiting review</Badge> : null}
                    </div>

                    <h2 className="mt-2.5 font-display text-[20px] leading-7 text-ink">
                      {row.status === "draft" ? (
                        <Link href={`/researcher/opportunities/${row.id}/edit?step=${row.draftStep}`} className="hover:underline">
                          {row.title}
                        </Link>
                      ) : (
                        <Link href={`/researcher/opportunities/${row.id}/applicants`} className="hover:underline">
                          {row.title}
                        </Link>
                      )}
                    </h2>
                    {row.summary ? <p className="mt-1 text-[13.5px] leading-6 text-muted">{row.summary}</p> : null}

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-muted">
                      <span>{row.numberOfOpenings} {row.numberOfOpenings === 1 ? "opening" : "openings"}</span>
                      <span>{hoursLabel(row.hoursPerWeekMin, row.hoursPerWeekMax)}</span>
                      <span>{labelOr(LOCATION_LABELS, row.locationMode)}</span>
                      <span className={deadline.urgent ? "text-warn" : ""}>{deadline.text}</span>
                      {row.publishedAt ? <span>Published {formatShortDate(row.publishedAt)}</span> : null}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px]">
                      <span className="text-ink">
                        <span className="font-medium">{row.applicationCount}</span> applications
                      </span>
                      <span className="text-ink">
                        <span className="font-medium">{row.shortlistedCount}</span> shortlisted
                      </span>
                      <span className="text-ink">
                        <span className="font-medium">{row.acceptedCount}</span> offers
                      </span>
                      <span className="text-muted">{row.viewCount} views</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-stretch gap-2">
                    {row.status === "draft" ? (
                      <ButtonLink href={`/researcher/opportunities/${row.id}/edit?step=${row.draftStep}`} size="sm">
                        Continue draft
                      </ButtonLink>
                    ) : (
                      <>
                        <ButtonLink href={`/researcher/opportunities/${row.id}/applicants`} size="sm">
                          Review applicants
                        </ButtonLink>
                        <ButtonLink href={`/researcher/opportunities/${row.id}/edit?step=1`} size="sm" variant="outline">
                          Edit listing
                        </ButtonLink>
                        <ButtonLink href={`/opportunities/${row.slug}`} size="sm" variant="ghost">
                          View as student
                        </ButtonLink>
                      </>
                    )}
                  </div>
                </div>

                {row.status !== "draft" ? (
                  <div className="mt-4 border-t border-line pt-4">
                    <StatusControls opportunityId={row.id} status={row.status} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
