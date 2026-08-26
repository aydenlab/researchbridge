import type { Metadata } from "next";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, SectionTitle } from "@/components/ui/card";
import { requireOnboardedUser } from "@/lib/auth/permissions";
import { listReviewablePlacements, listReviewsFor, reviewsByApplication } from "@/lib/queries/reviews";
import { loadPeople } from "@/lib/queries/social";
import { formatShortDate } from "@/lib/format";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = {
  title: "Reviews",
  robots: { index: false, follow: false },
};

export default async function ReviewsPage() {
  const user = await requireOnboardedUser();

  const placements = await listReviewablePlacements(user.id, user.role);
  const [written, received, people] = await Promise.all([
    reviewsByApplication(placements.map((placement) => placement.applicationId)),
    listReviewsFor(user.id),
    loadPeople(placements.map((placement) => placement.counterpartId)),
  ]);

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title="Reviews"
        lede="You can review somebody once you have actually worked together through a placement here. Reviews are shown on their profile with your name on them."
      />

      <Card className="mt-6">
        <CardHeader>
          <SectionTitle>People you worked with</SectionTitle>
        </CardHeader>
        <CardBody>
          {placements.length === 0 ? (
            <p className="text-[13.5px] leading-6 text-muted">
              Nothing to review yet. This fills in once an application you were part of is accepted, or once a
              placement is reported as having happened.
            </p>
          ) : (
            <ul className="flex flex-col gap-5">
              {placements.map((placement) => {
                const counterpart = people.get(placement.counterpartId);
                const mine = (written.get(placement.applicationId) ?? []).find(
                  (review) => review.direction === placement.direction,
                );
                return (
                  <li key={placement.applicationId} className="border-b border-line pb-5 last:border-b-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[14.5px] text-ink">{counterpart?.displayName ?? "Someone"}</p>
                        <p className="mt-0.5 text-[12.5px] text-subtle">{placement.opportunityTitle}</p>
                      </div>
                      {mine ? <Badge tone="ok">You rated {mine.rating} of 5</Badge> : <Badge tone="warn">Not reviewed</Badge>}
                    </div>

                    <ReviewForm
                      applicationId={placement.applicationId}
                      direction={placement.direction}
                      counterpartName={counterpart?.displayName ?? "them"}
                      existing={mine ? { rating: mine.rating, comment: mine.comment } : null}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <SectionTitle>What people said about you</SectionTitle>
        </CardHeader>
        <CardBody>
          {received.length === 0 ? (
            <p className="text-[13.5px] text-muted">Nobody has reviewed you yet.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {received.map((entry) => (
                <li key={entry.review.id} className="border-b border-line pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13.5px] text-ink">{entry.opportunityTitle}</p>
                    <Badge tone="neutral">{entry.review.rating} of 5</Badge>
                  </div>
                  {entry.review.comment ? (
                    <p className="rb-measure mt-2 text-[14px] leading-7 text-muted">{entry.review.comment}</p>
                  ) : null}
                  <p className="mt-1.5 text-[12px] text-subtle">{formatShortDate(entry.review.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {placements.length === 0 && received.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            title="Reviews build up over the pilot."
            body="They exist so a researcher can see that somebody else already had a good experience with a student, and so a student can find out what a group is actually like to work in."
            actionHref="/opportunities"
            actionLabel="Explore opportunities"
          />
        </div>
      ) : null}
    </div>
  );
}
