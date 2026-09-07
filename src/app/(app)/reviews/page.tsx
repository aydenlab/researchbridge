import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { applications, db } from "@/db";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { ReviewCard } from "@/components/app/review-card";
import { ButtonLink } from "@/components/ui/button";
import { currentUser } from "@/lib/auth/permissions";
import { REVIEW_TASK_LABELS, REVIEW_TASK_ORDER } from "@/lib/labels";
import { searchOpportunities } from "@/lib/queries/opportunities";

export const metadata: Metadata = {
  title: "Open reviews",
  description:
    "Systematic, scoping, and general reviews looking for help with screening, extraction, appraisal, and writing. Short projects with a clear path to authorship.",
  alternates: { canonical: "/reviews" },
};

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await currentUser();

  const selectedTasks = toArray(params.task);
  const authorshipOnly = params.authorship === "1";

  const results = await searchOpportunities({
    kind: "review_project",
    q: typeof params.q === "string" ? params.q.trim() : undefined,
    reviewTasks: selectedTasks,
    authorshipOnly,
    perPage: 40,
    sort: "recent",
  });

  let appliedIds = new Set<string>();
  if (user?.role === "student" && results.items.length > 0) {
    const rows = await db
      .select({ opportunityId: applications.opportunityId })
      .from(applications)
      .where(
        and(
          eq(applications.studentId, user.id),
          inArray(applications.opportunityId, results.items.map((item) => item.id)),
        ),
      );
    appliedIds = new Set(rows.map((row) => row.opportunityId));
  }

  function chipHref(next: Record<string, string | null>) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key in next) continue;
      for (const item of toArray(value)) query.append(key, item);
    }
    for (const [key, value] of Object.entries(next)) {
      if (value !== null) query.append(key, value);
    }
    const string = query.toString();
    return string ? `/reviews?${string}` : "/reviews";
  }

  function toggleTaskHref(task: string) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "task") continue;
      for (const item of toArray(value)) query.append(key, item);
    }
    for (const existing of selectedTasks) {
      if (existing !== task) query.append("task", existing);
    }
    if (!selectedTasks.includes(task)) query.append("task", task);
    const string = query.toString();
    return string ? `/reviews?${string}` : "/reviews";
  }

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Reviews"
        title="Open reviews"
        lede="Systematic, scoping, and general reviews looking for hands. These are short, they move fast, and they are the clearest route to being named on a paper."
        actions={
          user?.role === "researcher" ? (
            <ButtonLink href="/researcher/reviews/new">Post a review</ButtonLink>
          ) : null
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        <Link
          href={chipHref({ authorship: authorshipOnly ? null : "1" })}
          aria-pressed={authorshipOnly}
          className={`rounded-full border px-3.5 py-1 text-[12.5px] transition-colors ${
            authorshipOnly ? "border-forest bg-moss text-forest" : "border-line-strong bg-white text-ink hover:bg-shell"
          }`}
        >
          Authorship offered
        </Link>
        {REVIEW_TASK_ORDER.map((task) => {
          const active = selectedTasks.includes(task);
          return (
            <Link
              key={task}
              href={toggleTaskHref(task)}
              aria-pressed={active}
              className={`rounded-full border px-3.5 py-1 text-[12.5px] transition-colors ${
                active ? "border-forest bg-moss text-forest" : "border-line-strong bg-white text-ink hover:bg-shell"
              }`}
            >
              {REVIEW_TASK_LABELS[task]}
            </Link>
          );
        })}
        {selectedTasks.length > 0 || authorshipOnly ? (
          <Link href="/reviews" className="px-2 text-[12.5px] text-muted underline decoration-line-strong underline-offset-4">
            Clear
          </Link>
        ) : null}
      </div>

      {results.items.length === 0 ? (
        <EmptyState
          title={
            selectedTasks.length > 0 || authorshipOnly
              ? "No open reviews match those filters."
              : "No reviews are open right now."
          }
          body={
            user?.role === "researcher"
              ? "Posting one takes under two minutes: a title, a few sentences, whether there is authorship, and what you need help with."
              : "Reviews appear here as researchers post them. They tend to arrive in bursts around grant and manuscript deadlines."
          }
          actionHref={user?.role === "researcher" ? "/researcher/reviews/new" : "/opportunities"}
          actionLabel={user?.role === "researcher" ? "Post a review" : "Browse research positions"}
        />
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-line bg-white">
          {results.items.map((item) => (
            <ReviewCard key={item.id} item={item} applied={appliedIds.has(item.id)} className="last:border-b-0" />
          ))}
        </div>
      )}
    </div>
  );
}
