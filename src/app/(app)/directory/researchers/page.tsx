import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { FollowButton } from "@/components/app/follow-button";
import { OpportunityFilters, type FilterGroup } from "@/components/app/opportunity-filters";
import { PageHeader } from "@/components/app/page-header";
import { Badge, Tag } from "@/components/ui/badge";
import { requireRoleOrAdmin } from "@/lib/auth/permissions";
import { RESEARCHER_TYPE_LABELS } from "@/lib/labels";
import { searchResearchers } from "@/lib/queries/directory";
import { listFollowingIds } from "@/lib/queries/social";
import { listResearchFields } from "@/lib/queries/taxonomy";

export const metadata: Metadata = {
  title: "Browse researchers and labs",
  robots: { index: false, follow: false },
};

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function ResearcherDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRoleOrAdmin("student");
  const params = await searchParams;

  const filters = {
    q: typeof params.q === "string" ? params.q.trim() : undefined,
    researcherTypes: toArray(params.researcherType),
    fields: toArray(params.field),
    recruitingOnly: toArray(params.flag).includes("recruiting"),
    page: params.page ? Number(params.page) : 1,
  };

  const [results, fields, followingIds] = await Promise.all([
    searchResearchers(filters),
    listResearchFields(),
    listFollowingIds(user.id),
  ]);
  const following = new Set(followingIds);

  const groups: FilterGroup[] = [
    {
      key: "field",
      label: "Research area",
      options: fields.slice(0, 16).map((field) => ({ value: field.slug, label: field.name })),
    },
    {
      key: "researcherType",
      label: "Role",
      options: Object.entries(RESEARCHER_TYPE_LABELS)
        .slice(0, 7)
        .map(([value, label]) => ({ value, label })),
    },
    {
      key: "flag",
      label: "Recruiting",
      options: [{ value: "recruiting", label: "Has an open position right now" }],
    },
  ];

  const activeCount = filters.researcherTypes.length + filters.fields.length + (filters.recruitingOnly ? 1 : 0);

  function pageHref(page: number) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "page") continue;
      for (const item of toArray(value)) next.append(key, item);
    }
    next.set("page", String(page));
    return `/directory/researchers?${next.toString()}`;
  }

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Researchers and labs"
        title="Browse researchers"
        lede="Everyone here, whether or not they have a position posted. Follow a lab to keep it in view, and once they follow you back you can write to them directly."
      />

      <div className="grid gap-8 lg:grid-cols-[268px_1fr] lg:gap-10">
        <aside>
          <OpportunityFilters
            groups={groups}
            total={results.total}
            activeCount={activeCount}
            basePath="/directory/researchers"
            sortOptions={[]}
            showMaxHours={false}
            itemNoun="researchers"
          />
        </aside>

        <div className="min-w-0">
          <p className="mb-3 text-[13.5px] text-muted">
            {results.total} {results.total === 1 ? "researcher" : "researchers"}
            {filters.q ? ` matching "${filters.q}"` : ""}
          </p>

          {results.items.length === 0 ? (
            <EmptyState
              title="No researchers match this search."
              body="Try a broader research area, or clear the recruiting filter. Plenty of labs take students without a posting up."
              actionHref="/directory/researchers"
              actionLabel="Clear filters"
            />
          ) : (
            <ul className="overflow-hidden rounded-[12px] border border-line bg-white">
              {results.items.map((researcher) => (
                <li key={researcher.id} className="border-b border-line px-5 py-4 last:border-b-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/people/${researcher.id}`}
                        className="font-display text-[18px] text-ink underline decoration-line-strong underline-offset-4 hover:text-forest"
                      >
                        {researcher.displayName}
                      </Link>
                      <p className="mt-0.5 text-[13px] text-muted">
                        {[researcher.title, researcher.department].filter(Boolean).join(", ") || "Role not set"}
                        {researcher.labName ? `, ${researcher.labName}` : ""}
                      </p>
                      {researcher.institutionName ? (
                        <p className="mt-0.5 text-[12.5px] text-subtle">{researcher.institutionName}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {researcher.openPositions > 0 ? (
                        <Badge tone="forest">
                          {researcher.openPositions} open{" "}
                          {researcher.openPositions === 1 ? "posting" : "postings"}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">No open postings</Badge>
                      )}
                      <FollowButton userId={researcher.id} following={following.has(researcher.id)} />
                    </div>
                  </div>

                  {researcher.fieldNames.length > 0 ? (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {researcher.fieldNames.slice(0, 6).map((name) => (
                        <Tag key={name}>{name}</Tag>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {results.pageCount > 1 ? (
            <nav aria-label="Pagination" className="mt-6 flex items-center justify-between">
              {results.page > 1 ? (
                <Link
                  href={pageHref(results.page - 1)}
                  className="inline-flex h-9 items-center rounded-full border border-line-strong bg-white px-4 text-[13px] text-ink hover:bg-shell"
                >
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <p className="text-[13px] text-muted">
                Page {results.page} of {results.pageCount}
              </p>
              {results.page < results.pageCount ? (
                <Link
                  href={pageHref(results.page + 1)}
                  className="inline-flex h-9 items-center rounded-full border border-line-strong bg-white px-4 text-[13px] text-ink hover:bg-shell"
                >
                  Next
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}
