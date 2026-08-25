import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, researchFields, researcherFields, studentResearchInterests } from "@/db";
import { FollowButton } from "@/components/app/follow-button";
import { PersonRow } from "@/components/app/person-row";
import { Badge, Tag } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, SectionTitle } from "@/components/ui/card";
import { requireOnboardedUser } from "@/lib/auth/permissions";
import {
  followCounts,
  isFollowing,
  listFollowerIds,
  listFollowingIds,
  loadPeople,
  sharedConnectionIds,
} from "@/lib/queries/social";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

async function fieldsFor(userId: string, role: string | null): Promise<string[]> {
  if (role === "researcher") {
    const rows = await db
      .select({ name: researchFields.name })
      .from(researcherFields)
      .innerJoin(researchFields, eq(researchFields.id, researcherFields.researchFieldId))
      .where(eq(researcherFields.researcherId, userId))
      .orderBy(asc(researchFields.name));
    return rows.map((row) => row.name);
  }
  const rows = await db
    .select({ name: researchFields.name })
    .from(studentResearchInterests)
    .innerJoin(researchFields, eq(researchFields.id, studentResearchInterests.researchFieldId))
    .where(eq(studentResearchInterests.studentId, userId))
    .orderBy(asc(researchFields.name));
  return rows.map((row) => row.name);
}

export default async function PersonPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const viewer = await requireOnboardedUser();

  const people = await loadPeople([userId]);
  const person = people.get(userId);
  if (!person || !person.role) notFound();

  const isSelf = viewer.id === userId;
  const [counts, following, sharedIds, fields] = await Promise.all([
    followCounts(userId),
    isSelf ? Promise.resolve(false) : isFollowing(viewer.id, userId),
    isSelf ? Promise.resolve([]) : sharedConnectionIds(viewer.id, userId),
    fieldsFor(userId, person.role),
  ]);

  const [followerIds, followingIds] = await Promise.all([listFollowerIds(userId), listFollowingIds(userId)]);
  const connectionIds = [...new Set([...followerIds, ...followingIds])].slice(0, 12);
  const connectionPeople = await loadPeople([...new Set([...connectionIds, ...sharedIds])]);
  const viewerFollowing = new Set(await listFollowingIds(viewer.id));

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-5">
        <Link
          href="/connections"
          className="text-[13px] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink"
        >
          Back to connections
        </Link>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] text-ink" style={{ letterSpacing: "-0.4px" }}>
            {person.displayName}
          </h1>
          <p className="mt-1 text-[14px] text-muted">
            {[person.headline, person.institutionName].filter(Boolean).join(" · ") || "Profile not filled in yet"}
          </p>
          <p className="mt-2 text-[13px] text-subtle">
            {counts.followers} {counts.followers === 1 ? "follower" : "followers"} · {counts.following} following
          </p>
        </div>
        {isSelf ? (
          <Badge tone="neutral">This is you</Badge>
        ) : (
          <FollowButton userId={userId} following={following} />
        )}
      </div>

      {fields.length > 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <SectionTitle>{person.role === "researcher" ? "Research areas" : "Research interests"}</SectionTitle>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-1.5">
              {fields.map((name) => (
                <Tag key={name}>{name}</Tag>
              ))}
            </div>
          </CardBody>
        </Card>
      ) : null}

      {sharedIds.length > 0 ? (
        <Card className="mt-5">
          <CardHeader>
            <SectionTitle>People you both know</SectionTitle>
          </CardHeader>
          <CardBody>
            <ul>
              {sharedIds.map((id) => {
                const shared = connectionPeople.get(id);
                if (!shared) return null;
                return (
                  <PersonRow
                    key={id}
                    person={shared}
                    action={<FollowButton userId={id} following={viewerFollowing.has(id)} />}
                  />
                );
              })}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Card className="mt-5">
        <CardHeader>
          <SectionTitle>Connections</SectionTitle>
        </CardHeader>
        <CardBody>
          {connectionIds.length === 0 ? (
            <p className="text-[13.5px] text-muted">No connections yet.</p>
          ) : (
            <ul>
              {connectionIds.map((id) => {
                const connection = connectionPeople.get(id);
                if (!connection || id === viewer.id) return null;
                return (
                  <PersonRow
                    key={id}
                    person={connection}
                    action={<FollowButton userId={id} following={viewerFollowing.has(id)} />}
                  />
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
