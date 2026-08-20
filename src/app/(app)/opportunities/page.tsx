import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { applications, db, savedOpportunities } from "@/db";
import { OpportunityCard } from "@/components/app/opportunity-card";
import { OpportunityFilters, type FilterGroup } from "@/components/app/opportunity-filters";
import { ButtonLink } from "@/components/ui/button";
import { currentUser } from "@/lib/auth/permissions";
import { COMPENSATION_LABELS, COMPENSATION_ORDER, LOCATION_LABELS, RESEARCHER_TYPE_LABELS } from "@/lib/labels";
import { searchOpportunities, type OpportunityFilters as Filters } from "@/lib/queries/opportunities";
import { listResearchFields, listSkills } from "@/lib/queries/taxonomy";

export const metadata: Metadata = {
  title: "Find research",
  description:
    "Browse open research positions that are actively recruiting, filtered by field, department, compensation, hours, and location.",
  alternates: { canonical: "/opportunities" },
};

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await currentUser();

  const filters: Filters = {
    q: typeof params.q === "string" ? params.q.trim() : undefined,
    fields: toArray(params.field),
    compensation: toArray(params.compensation),
    location: toArray(params.location),
    skills: toArray(params.skill),
    researcherTypes: toArray(params.researcherType),
    maxHours: params.maxHours ? Number(params.maxHours) : undefined,
    beginnerOnly: toArray(params.flag).includes("beginner"),
    noPriorResearch: toArray(params.flag).includes("noPrior"),
    openOnly: !toArray(params.flag).includes("includeClosed"),
    sort: (params.sort as Filters["sort"]) ?? "recent",
    page: params.page ? Number(params.page) : 1,
  };

  const [results, fields, allSkills] = await Promise.all([
    searchOpportunities(filters),
    listResearchFields(),
    listSkills(),
  ]);

  let savedIds = new Set<string>();
  let appliedIds = new Set<string>();

  if (user?.role === "student" && results.items.length > 0) {
    const ids = results.items.map((item) => item.id);
    const [savedRows, applicationRows] = await Promise.all([
      db
        .select({ opportunityId: savedOpportunities.opportunityId })
        .from(savedOpportunities)
        .where(and(eq(savedOpportunities.studentId, user.id), inArray(savedOpportunities.opportunityId, ids))),
      db
        .select({ opportunityId: applications.opportunityId })
        .from(applications)
        .where(and(eq(applications.studentId, user.id), inArray(applications.opportunityId, ids))),
    ]);
    savedIds = new Set(savedRows.map((row) => row.opportunityId));
    appliedIds = new Set(applicationRows.map((row) => row.opportunityId));
  }

  const groups: FilterGroup[] = [
    {
      key: "field",
      label: "Research field",
      options: fields.slice(0, 16).map((field) => ({ value: field.slug, label: field.name })),
    },
    {
      key: "compensation",
      label: "Compensation",
      options: COMPENSATION_ORDER.map((value) => ({ value, label: COMPENSATION_LABELS[value] })),
    },
    {
      key: "location",
      label: "Location",
      options: Object.entries(LOCATION_LABELS).map(([value, label]) => ({ value, label })),
    },
    {
      key: "flag",
      label: "Suitability",
      options: [
        { value: "beginner", label: "Accepting beginners" },
        { value: "noPrior", label: "No prior research required" },
        { value: "includeClosed", label: "Include past deadlines" },
      ],
    },
    {
      key: "skill",
      label: "Requested skills",
      options: allSkills.slice(0, 14).map((skill) => ({ value: skill.slug, label: skill.name })),
    },
    {
      key: "researcherType",
      label: "Researcher type",
      options: Object.entries(RESEARCHER_TYPE_LABELS)
        .slice(0, 7)
        .map(([value, label]) => ({ value, label })),
    },
  ];

  const activeCount =
    (filters.fields?.length ?? 0) +
    (filters.compensation?.length ?? 0) +
    (filters.location?.length ?? 0) +
    (filters.skills?.length ?? 0) +
    (filters.researcherTypes?.length ?? 0) +
    (filters.maxHours ? 1 : 0) +
    (filters.beginnerOnly ? 1 : 0) +
    (filters.noPriorResearch ? 1 : 0);

  function pageHref(page: number) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "page") continue;
      for (const item of toArray(value)) next.append(key, item);
    }
    next.set("page", String(page));
    return `/opportunities?${next.toString()}`;
  }

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-7">
        <h1 className="font-display text-[30px] text-ink sm:text-[34px]" style={{ letterSpacing: "-0.6px" }}>
          Open research positions
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-7 text-muted">
          Every position here was opened by a researcher who is recruiting now. Requirements, time commitment, and
          compensation are stated before you apply.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[268px_1fr] lg:gap-10">
        <aside>
          <OpportunityFilters groups={groups} total={results.total} activeCount={activeCount} />
        </aside>

        <div className="min-w-0">
          <div className="mb-3 hidden items-center justify-between lg:flex">
            <p className="text-[13.5px] text-muted">
              {results.total} {results.total === 1 ? "position" : "positions"}
              {filters.q ? ` matching "${filters.q}"` : ""}
            </p>
            {user?.role === "researcher" ? (
              <ButtonLink href="/researcher/opportunities/new" size="sm" variant="outline">
                Post opportunity
              </ButtonLink>
            ) : null}
          </div>

          {results.items.length === 0 ? (
            <div className="rounded-[12px] border border-line bg-white px-6 py-14 text-center">
              <p className="font-display text-[20px] text-ink">
                {activeCount > 0 || filters.q
                  ? "No opportunities match every selected filter."
                  : "No positions are open right now."}
              </p>
              <p className="mx-auto mt-2 max-w-md text-[14px] leading-6 text-muted">
                {activeCount > 0 || filters.q
                  ? "Try removing one or two filters. Broadening the research field or the compensation type usually surfaces the most."
                  : "New positions appear here as researchers publish them. The Example University pilot opens in September 2026."}
              </p>
              {activeCount > 0 || filters.q ? (
                <div className="mt-6">
                  <ButtonLink href="/opportunities" variant="outline">
                    Clear all filters
                  </ButtonLink>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="overflow-hidden rounded-[12px] border border-line bg-white">
              {results.items.map((item) => (
                <OpportunityCard
                  key={item.id}
                  item={item}
                  saved={savedIds.has(item.id)}
                  applied={appliedIds.has(item.id)}
                  className="last:border-b-0"
                />
              ))}
            </div>
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
