import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { FollowButton } from "@/components/app/follow-button";
import { OpportunityFilters, type FilterGroup } from "@/components/app/opportunity-filters";
import { PageHeader } from "@/components/app/page-header";
import { Badge, Tag } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
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

  const [results, fields, followingIds] = await Promise.all([
    searchStudents(filters),
    listResearchFields(),
    listFollowingIds(user.id),
  ]);
  const following = new Set(followingIds);

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
              {results.items.map((student) => (
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
                        {student.institutionName ? ` · ${student.institutionName}` : ""}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-subtle">
                        {labelOr(DEGREE_LABELS, student.degreeLevel)}
                        {student.weeklyHours !== null ? ` · ${student.weeklyHours} hours per week` : ""}
                        {student.programCategory
                          ? ` · ${labelOr(PROGRAM_CATEGORY_LABELS, student.programCategory)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
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
