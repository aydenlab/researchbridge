import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { FileText } from "lucide-react";
import { db, researchFields, researcherFields, studentResearchInterests } from "@/db";
import { FollowButton } from "@/components/app/follow-button";
import { PersonRow } from "@/components/app/person-row";
import { Badge, Tag } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, SectionTitle } from "@/components/ui/card";
import { requireOnboardedUser } from "@/lib/auth/permissions";
import { listConfirmedProfileReferences } from "@/lib/queries/references";
import { listReferralsFor, referralByReferrer } from "@/lib/queries/referrals";
import { canMessage } from "@/lib/queries/messages";
import { formatShortDate } from "@/lib/format";
import {
  followCounts,
  isFollowing,
  listFollowerIds,
  listFollowingIds,
  loadPeople,
  sharedConnectionIds,
} from "@/lib/queries/social";
import { ReferralControls } from "./referral-controls";

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

  const [confirmedReferences, referrals, myReferral, messaging] = await Promise.all([
    listConfirmedProfileReferences(userId),
    listReferralsFor(userId),
    isSelf ? Promise.resolve(null) : referralByReferrer(userId, viewer.id),
    isSelf ? Promise.resolve({ allowed: false as const, reason: "" }) : canMessage(viewer, userId),
  ]);

  const [followerIds, followingIds] = await Promise.all([listFollowerIds(userId), listFollowingIds(userId)]);
  const connectionIds = [...new Set([...followerIds, ...followingIds])].slice(0, 12);
  const connectionPeople = await loadPeople([...new Set([...connectionIds, ...sharedIds])]);
  const viewerFollowing = new Set(await listFollowingIds(viewer.id));

  // Reference letters are for whoever is assessing this person, and for the
  // person themselves. Other students never see the link at all.
  const canReadLetters = isSelf || viewer.role === "researcher" || viewer.role === "admin";

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
            {referrals.length > 0 ? ` · ${referrals.length} ${referrals.length === 1 ? "referral" : "referrals"}` : ""}
          </p>
        </div>
        {isSelf ? (
          <Badge tone="neutral">This is you</Badge>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <FollowButton userId={userId} following={following} />
            {messaging.allowed ? (
              <ButtonLink href={`/messages/${userId}`} size="sm" variant="outline">
                Message
              </ButtonLink>
            ) : null}
          </div>
        )}
      </div>

      {!isSelf && !messaging.allowed ? (
        <p className="mt-4 rounded-[10px] border border-line bg-shell px-4 py-3 text-[13px] leading-6 text-muted">
          {messaging.reason}
        </p>
      ) : null}

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

      <Card className="mt-5">
        <CardHeader>
          <SectionTitle>Referrals</SectionTitle>
        </CardHeader>
        <CardBody>
          {referrals.length === 0 ? (
            <p className="text-[13.5px] leading-6 text-muted">
              Nobody has referred {isSelf ? "you" : person.displayName} yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {referrals.map((referral) => (
                <li key={referral.id} className="border-b border-line pb-4 last:border-b-0 last:pb-0">
                  <p className="text-[14.5px] text-ink">
                    This student has been referred by{" "}
                    <Link
                      href={`/people/${referral.referrerId}`}
                      className="font-medium underline decoration-line-strong underline-offset-4 hover:text-forest"
                    >
                      {referral.referrerName}
                    </Link>
                  </p>
                  {referral.referrerHeadline ? (
                    <p className="mt-0.5 text-[12.5px] text-subtle">{referral.referrerHeadline}</p>
                  ) : null}
                  {referral.note ? (
                    <p className="rb-measure mt-2 text-[14px] leading-7 text-muted">{referral.note}</p>
                  ) : null}
                  {referral.letterFileId && canReadLetters ? (
                    <a
                      href={`/api/files/by-id/${referral.letterFileId}`}
                      className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-forest underline decoration-line-strong underline-offset-4"
                    >
                      <FileText className="size-3.5" aria-hidden="true" />
                      {referral.letterFileName}
                    </a>
                  ) : null}
                  <p className="mt-1.5 text-[12px] text-subtle">{formatShortDate(referral.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}

          {!isSelf ? (
            <div className="mt-4 border-t border-line pt-4">
              <ReferralControls
                subjectId={userId}
                subjectName={person.displayName}
                existing={myReferral ? { note: myReferral.note, hasLetter: Boolean(myReferral.letterFileId) } : null}
              />
            </div>
          ) : null}
        </CardBody>
      </Card>

      {confirmedReferences.length > 0 ? (
        <Card className="mt-5">
          <CardHeader>
            <SectionTitle>Confirmed references</SectionTitle>
          </CardHeader>
          <CardBody>
            <ul className="flex flex-col gap-3">
              {confirmedReferences.map((reference) => (
                <li key={reference.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] text-ink">{reference.refereeName || reference.refereeEmail}</p>
                    <p className="mt-0.5 text-[12.5px] text-subtle">
                      {reference.relationship || "Relationship not given"}
                    </p>
                  </div>
                  <Badge tone="ok">Confirmed</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-line pt-3 text-[12px] leading-5 text-subtle">
              Each of these people was emailed and confirmed it themselves. Requests that are still waiting are not shown here.
            </p>
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
