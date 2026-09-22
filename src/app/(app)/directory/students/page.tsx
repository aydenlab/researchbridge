import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { FollowButton } from "@/components/app/follow-button";
import { OpportunityFilters, type FilterGroup } from "@/components/app/opportunity-filters";
import { PageHeader } from "@/components/app/page-header";
import { Badge, Tag } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { requireRoleOrAdmin } from "@/lib/auth/permissions";
import {
  COMPENSATION_PREFERENCE_LABELS,
  COMPENSATION_PREFERENCE_ORDER,
  COURSE_TYPE_LABELS,
  COURSE_TYPE_ORDER,
  DEGREE_LABELS,
  DURATION_LABELS,
  DURATION_ORDER,
  PROGRAM_CATEGORY_LABELS,
  PROGRAM_CATEGORY_ORDER,
  labelOr,
} from "@/lib/labels";
import { searchStudents } from "@/lib/queries/directory";
import type { MatchResult } from "@/lib/matching";
import { scoreCandidatesAgainst } from "@/lib/queries/recommendations";
import { researcherOpportunities } from "@/lib/queries/researcher";
import { listFollowingIds } from "@/lib/queries/social";
import { listResearchFields } from "@/lib/queries/taxonomy";

export const metadata: Metadata = {
  title: "Browse students",
  robots: { index: false, follow: false },
};

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function StudentDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRoleOrAdmin("researcher");
  const params = await searchParams;

  const filters = {
    q: typeof params.q === "string" ? params.q.trim() : undefined,
    programCategories: toArray(params.program),
    courseTypes: toArray(params.courseType),
    durations: toArray(params.duration),
    degreeLevels: toArray(params.degree),
    compensationPreferences: toArray(params.pay),
    fields: toArray(params.field),
    page: params.page ? Number(params.page) : 1,
  };

  const matchAgainst = typeof params.match === "string" ? params.match : "";

  const [results, fields, followingIds, myPostings] = await Promise.all([
    searchStudents(filters),
    listResearchFields(),
    listFollowingIds(user.id),
    researcherOpportunities(user.id),
  ]);
  const following = new Set(followingIds);

  // Only the researcher's own listings can be scored against, and only ones
  // that are actually built out: an empty draft would score everybody the same.
  const scorablePostings = myPostings.filter(
    (posting) => posting.kind === "research_position" && posting.status !== "archived",
  );
  const selectedPosting = scorablePostings.find((posting) => posting.id === matchAgainst) ?? null;
  const matchScores = selectedPosting
    ? await scoreCandidatesAgainst(selectedPosting.id, results.items.map((item) => item.id))
    : new Map<string, MatchResult>();

  // Ranking reorders the page in front of the researcher. It deliberately does
  // not reorder across pages: the filters decide who is in the pool, and the
  // score only decides who to read first.
  const visibleStudents = selectedPosting
    ? [...results.items].sort((a, b) => (matchScores.get(b.id)?.percent ?? -1) - (matchScores.get(a.id)?.percent ?? -1))
    : results.items;

  const groups: FilterGroup[] = [
    {
      key: "program",
      label: "Program area",
      options: PROGRAM_CATEGORY_ORDER.map((value) => ({ value, label: PROGRAM_CATEGORY_LABELS[value] })),
    },
    {
      key: "courseType",
      label: "Course type",
      options: COURSE_TYPE_ORDER.map((value) => ({ value, label: COURSE_TYPE_LABELS[value] })),
    },
    {
      key: "duration",
      label: "Length they want",
      options: DURATION_ORDER.map((value) => ({ value, label: DURATION_LABELS[value] })),
    },
    {
      key: "pay",
      label: "Paid or volunteer",
      options: COMPENSATION_PREFERENCE_ORDER.map((value) => ({
        value,
        label: COMPENSATION_PREFERENCE_LABELS[value],
      })),
    },
    {
      key: "degree",
      label: "Degree level",
      options: Object.entries(DEGREE_LABELS).map(([value, label]) => ({ value, label })),
    },
    {
      key: "field",
      label: "Research interest",
      options: fields.slice(0, 16).map((field) => ({ value: field.slug, label: field.name })),
    },
  ];

  const activeCount =
    filters.programCategories.length +
    filters.courseTypes.length +
    filters.durations.length +
    filters.degreeLevels.length +
    filters.compensationPreferences.length +
    filters.fields.length;

  function pageHref(page: number) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "page") continue;
      for (const item of toArray(value)) next.append(key, item);
    }
    next.set("page", String(page));
    return `/directory/students?${next.toString()}`;
  }

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Students"
        title="Browse students"
        lede="You do not need an open posting to find somebody. Search on what they are studying, how long they want to work for, whether they need the position paid, and what they want it to count as."
      />

      {scorablePostings.length > 0 ? (
        <form method="get" action="/directory/students" className="mb-6 rounded-[12px] border border-line bg-white px-4 py-3.5">
          {Object.entries(params).flatMap(([key, value]) =>
            key === "match" || key === "page"
              ? []
              : toArray(value).map((item, index) => (
                  <input key={`${key}-${item}-${index}`} type="hidden" name={key} value={item} />
                )),
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <label htmlFor="match-posting" className="mb-1 block text-[12.5px] font-medium text-ink">
                Rank these students against one of your positions
              </label>
              <p className="mb-2 text-[12px] leading-5 text-muted">
                Scored on the same dimensions students see: research interest, how long the position runs, whether it
                is paid, skills, and hours.
              </p>
              <select
                id="match-posting"
                name="match"
                defaultValue={selectedPosting?.id ?? ""}
                className="h-9 w-full max-w-[420px] rounded-[8px] border border-line-strong bg-white px-3 text-[13.5px] text-ink"
              >
                <option value="">No position selected</option>
                {scorablePostings.map((posting) => (
                  <option key={posting.id} value={posting.id}>
                    {posting.title}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="md">
              {selectedPosting ? "Update ranking" : "Rank"}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[268px_1fr] lg:gap-10">
        <aside>
          <OpportunityFilters
            groups={groups}
            total={results.total}
            activeCount={activeCount}
            basePath="/directory/students"
            sortOptions={[]}
            showMaxHours={false}
            itemNoun="students"
          />
        </aside>

        <div className="min-w-0">
          <p className="mb-3 text-[13.5px] text-muted">
            {results.total} {results.total === 1 ? "student" : "students"}
            {filters.q ? ` matching "${filters.q}"` : ""}
          </p>

          {results.items.length === 0 ? (
            <EmptyState
              title="No students match this search."
              body="Try removing a filter. Program area and course type are the two that narrow the pool fastest."
              actionHref="/directory/students"
              actionLabel="Clear filters"
            />
          ) : (
            <ul className="overflow-hidden rounded-[12px] border border-line bg-white">
              {visibleStudents.map((student) => (
                <li key={student.id} className="border-b border-line px-5 py-4 last:border-b-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/people/${student.id}`}
                        className="font-display text-[18px] text-ink underline decoration-line-strong underline-offset-4 hover:text-forest"
                      >
                        {student.displayName}
                      </Link>
                      <p className="mt-0.5 text-[13px] text-muted">
                        {student.program ?? "Program not set"}
                        {student.yearLevel ? `, year ${student.yearLevel}` : ""}
                        {student.institutionName ? `, ${student.institutionName}` : ""}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-subtle">
                        {labelOr(DEGREE_LABELS, student.degreeLevel)}
                        {student.weeklyHours !== null ? `, ${student.weeklyHours} hours per week` : ""}
                        {student.programCategory
                          ? `, ${labelOr(PROGRAM_CATEGORY_LABELS, student.programCategory)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {selectedPosting ? (
                        <Badge tone={(matchScores.get(student.id)?.percent ?? 0) >= 60 ? "forest" : "neutral"}>
                          {matchScores.get(student.id)?.percent === null ||
                          matchScores.get(student.id)?.percent === undefined
                            ? "Not enough profile to score"
                            : `${matchScores.get(student.id)?.percent}% match`}
                        </Badge>
                      ) : null}
                      <FollowButton userId={student.id} following={following.has(student.id)} />
                      <ButtonLink href={`/messages/${student.id}`} size="sm" variant="outline">
                        Message
                      </ButtonLink>
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {student.durations.map((value) => (
                      <Badge key={value} tone="outline">
                        {labelOr(DURATION_LABELS, value)}
                      </Badge>
                    ))}
                    {student.compensationPreferences.map((value) => (
                      <Badge key={value} tone="forest">
                        {labelOr(COMPENSATION_PREFERENCE_LABELS, value)}
                      </Badge>
                    ))}
                    {student.courseTypes.map((value) => (
                      <Badge key={value} tone="neutral">
                        {labelOr(COURSE_TYPE_LABELS, value)}
                      </Badge>
                    ))}
                    {student.fieldNames.slice(0, 4).map((name) => (
                      <Tag key={name}>{name}</Tag>
                    ))}
                  </div>

                  {selectedPosting && (matchScores.get(student.id)?.reasons.length ?? 0) > 0 ? (
                    <p className="mt-2 text-[12.5px] leading-5 text-subtle">
                      {matchScores.get(student.id)?.reasons.slice(0, 3).join(", ")}
                    </p>
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
