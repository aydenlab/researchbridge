import type { Metadata } from "next";
import { and, desc, eq, inArray } from "drizzle-orm";
import { applications, db, savedOpportunities } from "@/db";
import { EmptyState } from "@/components/app/empty-state";
import { OpportunityCard } from "@/components/app/opportunity-card";
import { PageHeader } from "@/components/app/page-header";
import { requireStudent } from "@/lib/auth/permissions";
import { searchOpportunities } from "@/lib/queries/opportunities";

export const metadata: Metadata = {
  title: "Saved opportunities",
  robots: { index: false, follow: false },
};

export default async function SavedPage() {
  const user = await requireStudent();

  const savedRows = await db
    .select({ opportunityId: savedOpportunities.opportunityId, createdAt: savedOpportunities.createdAt })
    .from(savedOpportunities)
    .where(eq(savedOpportunities.studentId, user.id))
    .orderBy(desc(savedOpportunities.createdAt));

  if (savedRows.length === 0) {
    return (
      <div className="mx-auto max-w-[1080px] px-4 py-8 sm:px-6 sm:py-10">
        <PageHeader title="Saved opportunities" />
        <EmptyState
          title="You have not saved anything yet."
          body="Saving a position keeps it here while you decide. It does not notify the researcher and it is not an application."
          actionHref="/opportunities"
          actionLabel="Explore opportunities"
        />
      </div>
    );
  }

  const ids = savedRows.map((row) => row.opportunityId);
  const { items } = await searchOpportunities({ openOnly: false, perPage: 100 });
  const order = new Map(ids.map((id, index) => [id, index]));
  const saved = items.filter((item) => order.has(item.id)).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  const applicationRows = await db
    .select({ opportunityId: applications.opportunityId })
    .from(applications)
    .where(and(eq(applications.studentId, user.id), inArray(applications.opportunityId, ids)));
  const appliedIds = new Set(applicationRows.map((row) => row.opportunityId));

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title="Saved opportunities"
        lede="Positions you kept for later. Saving is private and does not notify the researcher."
      />

      {saved.length === 0 ? (
        <EmptyState
          title="Your saved positions are no longer published."
          body="Researchers close positions once they are filled. Browse what is open now."
          actionHref="/opportunities"
          actionLabel="Explore opportunities"
        />
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-line bg-white">
          {saved.map((item) => (
            <OpportunityCard key={item.id} item={item} saved applied={appliedIds.has(item.id)} className="last:border-b-0" />
          ))}
        </div>
      )}
    </div>
  );
}
