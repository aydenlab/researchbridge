import type { Metadata } from "next";
import { EmptyState } from "@/components/app/empty-state";
import { FollowButton } from "@/components/app/follow-button";
import { PageHeader } from "@/components/app/page-header";
import { PersonRow } from "@/components/app/person-row";
import { Card, CardBody, CardHeader, SectionTitle } from "@/components/ui/card";
import { requireOnboardedUser } from "@/lib/auth/permissions";
import {
  followCounts,
  listFollowerIds,
  listFollowingIds,
  loadVisiblePeople,
  suggestedPeopleIds,
} from "@/lib/queries/social";

export const metadata: Metadata = {
  title: "Connections",
  robots: { index: false, follow: false },
};

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireOnboardedUser();
  const { tab } = await searchParams;

  const [counts, followerIds, followingIds, suggestedIds] = await Promise.all([
    followCounts(user.id),
    listFollowerIds(user.id),
    listFollowingIds(user.id),
    suggestedPeopleIds(user),
  ]);

  const people = await loadVisiblePeople(user, [...new Set([...followerIds, ...followingIds, ...suggestedIds])]);
  const followingSet = new Set(followingIds);
  const showFollowers = tab === "followers";
  // Follows made before same-role browsing was closed off are dropped from the
  // list rather than rendered as rows that lead nowhere.
  const listedIds = (showFollowers ? followerIds : followingIds).filter((id) => people.has(id));

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title="Connections"
        lede="Following someone keeps their work in view. It is public, it does not grant access to anything private, and it is not an application."
      />

      <div className="mt-6 flex gap-2">
        <a
          href="/connections"
          aria-current={!showFollowers ? "page" : undefined}
          className={`rounded-full border px-4 py-1.5 text-[13px] ${
            !showFollowers ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-ink hover:bg-shell"
          }`}
        >
          Following ({counts.following})
        </a>
        <a
          href="/connections?tab=followers"
          aria-current={showFollowers ? "page" : undefined}
          className={`rounded-full border px-4 py-1.5 text-[13px] ${
            showFollowers ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-ink hover:bg-shell"
          }`}
        >
          Followers ({counts.followers})
        </a>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <SectionTitle>{showFollowers ? "People following you" : "People you follow"}</SectionTitle>
        </CardHeader>
        <CardBody>
          {listedIds.length === 0 ? (
            <p className="text-[13.5px] text-muted">
              {showFollowers
                ? "Nobody is following you yet."
                : "You are not following anyone yet. Follow a researcher whose work you want to keep an eye on."}
            </p>
          ) : (
            <ul>
              {listedIds.map((id) => {
                const person = people.get(id);
                if (!person) return null;
                return (
                  <PersonRow
                    key={id}
                    person={person}
                    action={<FollowButton userId={id} following={followingSet.has(id)} />}
                  />
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      {suggestedIds.length > 0 ? (
        <Card className="mt-5">
          <CardHeader>
            <SectionTitle>People you have not followed yet</SectionTitle>
          </CardHeader>
          <CardBody>
            <ul>
              {suggestedIds.map((id) => {
                const person = people.get(id);
                if (!person) return null;
                return <PersonRow key={id} person={person} action={<FollowButton userId={id} following={false} />} />;
              })}
            </ul>
          </CardBody>
        </Card>
      ) : (
        <div className="mt-5">
          <EmptyState
            title="No one else to suggest right now."
            body="As more people join, they will show up here."
            actionHref="/opportunities"
            actionLabel="Explore opportunities"
          />
        </div>
      )}
    </div>
  );
}
