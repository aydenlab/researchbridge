import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, gte, isNull, ne, sql } from "drizzle-orm";
import { applications, db, notifications, opportunities, savedOpportunities } from "@/db";
import { EmptyState } from "@/components/app/empty-state";
import { OpportunityCard } from "@/components/app/opportunity-card";
import { PageHeader, StatGrid } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-pill";
import { ButtonLink } from "@/components/ui/button";
import { requireStudent } from "@/lib/auth/permissions";
import { isActive, STUDENT_STATUS_DESCRIPTION, type ApplicationStatus } from "@/lib/application-status";
import { deadlineNote, formatShortDate } from "@/lib/format";
import { listStudentApplications } from "@/lib/queries/applications";
import { searchOpportunities } from "@/lib/queries/opportunities";
import { recommendOpportunities } from "@/lib/queries/recommendations";
import { loadStudentProfile, missingProfileItems } from "@/lib/queries/student";

export const metadata: Metadata = {
  title: "Home",
  robots: { index: false, follow: false },
};

export default async function StudentDashboardPage() {
  const user = await requireStudent();
  const bundle = await loadStudentProfile(user.id);
  if (!bundle) return null;

  const [applicationRows, savedRows, unreadRows, recentlyPosted] = await Promise.all([
    listStudentApplications(user.id),
    db
      .select({
        id: savedOpportunities.opportunityId,
        title: opportunities.title,
        slug: opportunities.slug,
        deadline: opportunities.deadline,
        status: opportunities.status,
      })
      .from(savedOpportunities)
      .innerJoin(opportunities, eq(opportunities.id, savedOpportunities.opportunityId))
      .where(eq(savedOpportunities.studentId, user.id))
      .orderBy(desc(savedOpportunities.createdAt))
      .limit(5),
    db
      .select({ id: notifications.id, title: notifications.title, body: notifications.body, link: notifications.link, createdAt: notifications.createdAt })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)))
      .orderBy(desc(notifications.createdAt))
      .limit(4),
    searchOpportunities({ openOnly: true, sort: "recent", perPage: 3 }),
  ]);

  const appliedIds = new Set(applicationRows.map((row) => row.opportunityId));
  const recommendations = await recommendOpportunities(bundle, { limit: 4, excludeIds: appliedIds });

  const activeApplications = applicationRows.filter((row) => isActive(row.status));
  const drafts = applicationRows.filter((row) => row.status === "draft");
  const missing = missingProfileItems(bundle);

  const upcoming = [...savedRows, ...drafts.map((draft) => ({ id: draft.opportunityId, title: draft.opportunityTitle, slug: draft.opportunitySlug, deadline: draft.opportunityDeadline, status: draft.opportunityStatus }))]
    .filter((item) => item.deadline && deadlineNote(item.deadline).urgent)
    .slice(0, 4);

  const greeting = bundle.profile.preferredName || bundle.profile.firstName || "there";

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title={`Hello, ${greeting}`}
        lede="Positions that are open now, and where your applications stand."
        actions={<ButtonLink href="/opportunities">Explore opportunities</ButtonLink>}
      />

      <StatGrid
        stats={[
          { label: "Profile complete", value: `${bundle.profile.profileCompletion}%`, hint: missing.length > 0 ? `Missing: ${missing.slice(0, 2).join(", ")}` : "Nothing outstanding" },
          { label: "Active applications", value: String(activeApplications.length), hint: drafts.length > 0 ? `${drafts.length} draft not yet submitted` : "No drafts open" },
          { label: "Saved positions", value: String(savedRows.length) },
          { label: "Open positions", value: String(recentlyPosted.total), hint: "Across the pilot right now" },
        ]}
      />

      {unreadRows.length > 0 ? (
        <section className="mt-8 rounded-[12px] border border-line bg-white">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="font-display text-[18px] text-ink">Waiting for you</h2>
          </div>
          <ul className="divide-y divide-line">
            {unreadRows.map((item) => (
              <li key={item.id} className="px-5 py-3.5">
                <Link href={item.link ?? "/applications"} className="block">
                  <p className="text-[14px] font-medium text-ink">{item.title}</p>
                  {item.body ? <p className="mt-0.5 text-[13px] leading-6 text-muted">{item.body}</p> : null}
                  <p className="mt-1 text-[12px] text-subtle">{formatShortDate(item.createdAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px] lg:gap-10">
        <div className="min-w-0">
          <section>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-[21px] text-ink" style={{ letterSpacing: "-0.4px" }}>
                Relevant to your profile
              </h2>
              <Link href="/opportunities" className="text-[13px] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink">
                See all
              </Link>
            </div>

            {recommendations.length === 0 ? (
              <EmptyState
                title="Nothing matched your profile closely enough yet."
                body="Add a few more skills or research interests, or browse everything that is currently open. Overlap here is computed from your own profile, not from a model."
                actionHref="/opportunities"
                actionLabel="Explore opportunities"
                secondaryHref="/profile"
                secondaryLabel="Update profile"
              />
            ) : (
              <div className="overflow-hidden rounded-[12px] border border-line bg-white">
                {recommendations.map((recommendation) => (
                  <div key={recommendation.item.id} className="border-b border-line last:border-b-0">
                    <OpportunityCard item={recommendation.item} className="border-b-0" />
                    {recommendation.reasons.length > 0 ? (
                      <p className="px-4 pb-4 text-[12.5px] leading-5 text-muted sm:px-5">
                        Why this appears: {recommendation.reasons.join(". ")}.
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-9">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-[21px] text-ink" style={{ letterSpacing: "-0.4px" }}>
                Recently posted
              </h2>
            </div>
            {recentlyPosted.items.length === 0 ? (
              <EmptyState
                title="No positions are open right now."
                body="New positions appear here as researchers publish them."
              />
            ) : (
              <div className="overflow-hidden rounded-[12px] border border-line bg-white">
                {recentlyPosted.items.map((item) => (
                  <OpportunityCard key={item.id} item={item} applied={appliedIds.has(item.id)} className="last:border-b-0" />
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-5">
          <section className="rounded-[12px] border border-line bg-white">
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="font-display text-[17px] text-ink">Your applications</h2>
            </div>
            {applicationRows.length === 0 ? (
              <p className="px-5 py-5 text-[13.5px] leading-6 text-muted">
                You have not submitted any applications yet. Browse open research opportunities when you are ready.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {applicationRows.slice(0, 5).map((row) => (
                  <li key={row.id} className="px-5 py-3.5">
                    <Link href={row.status === "draft" ? `/applications/${row.id}/edit` : `/applications/${row.id}`} className="block">
                      <p className="text-[13.5px] font-medium leading-5 text-ink">{row.opportunityTitle}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <StatusPill status={row.status as ApplicationStatus} />
                      </div>
                      <p className="mt-1.5 text-[12px] leading-5 text-muted">
                        {STUDENT_STATUS_DESCRIPTION[row.status as ApplicationStatus]}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {upcoming.length > 0 ? (
            <section className="rounded-[12px] border border-line bg-white">
              <div className="border-b border-line px-5 py-3.5">
                <h2 className="font-display text-[17px] text-ink">Deadlines approaching</h2>
              </div>
              <ul className="divide-y divide-line">
                {upcoming.map((item) => (
                  <li key={item.id} className="px-5 py-3">
                    <Link href={`/opportunities/${item.slug}`} className="block">
                      <p className="text-[13.5px] leading-5 text-ink">{item.title}</p>
                      <p className="mt-0.5 text-[12px] text-warn">{deadlineNote(item.deadline).text}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {missing.length > 0 ? (
            <section className="rounded-[12px] border border-line bg-white p-5">
              <h2 className="font-display text-[17px] text-ink">Finish your profile</h2>
              <p className="mt-1.5 text-[13px] leading-6 text-muted">
                Your profile gives researchers context when they review your applications.
              </p>
              <ul className="mt-3 flex flex-col gap-1.5">
                {missing.map((item) => (
                  <li key={item} className="text-[13px] text-muted">
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <ButtonLink href="/profile" variant="outline" size="sm">
                  Complete profile
                </ButtonLink>
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
