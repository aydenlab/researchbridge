import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-pill";
import { Badge } from "@/components/ui/badge";
import { requireResearcher } from "@/lib/auth/permissions";
import { type ApplicationStatus } from "@/lib/application-status";
import { formatShortDate } from "@/lib/format";
import {
  COURSE_TYPE_LABELS,
  COURSE_TYPE_ORDER,
  LOCATION_LABELS,
  PROGRAM_CATEGORY_LABELS,
  PROGRAM_CATEGORY_ORDER,
  labelOr,
} from "@/lib/labels";
import { applicantStatusCounts, listAllApplicants } from "@/lib/queries/researcher";

export const metadata: Metadata = {
  title: "All applicants",
  robots: { index: false, follow: false },
};

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function AllApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireResearcher();
  if (user.researcherVerification !== "verified") redirect("/researcher/pending");

  const params = await searchParams;
  const filter = typeof params.filter === "string" ? params.filter : "";
  const courseTypes = toArray(params.courseType);
  const programCategories = toArray(params.program);
  const page = params.page ? Math.max(Number(params.page) || 1, 1) : 1;

  const structural = { courseTypes, programCategories };

  const [results, counts] = await Promise.all([
    listAllApplicants(user.id, { ...structural, filter, page }),
    applicantStatusCounts(user.id, structural),
  ]);

  const structuralCount = courseTypes.length + programCategories.length;

  /** Rebuilds the query string with one value toggled, always resetting paging. */
  function hrefWith(changes: { filter?: string; courseType?: string[]; program?: string[]; page?: number }) {
    const next = new URLSearchParams();
    const nextFilter = changes.filter ?? filter;
    if (nextFilter) next.set("filter", nextFilter);
    for (const value of changes.courseType ?? courseTypes) next.append("courseType", value);
    for (const value of changes.program ?? programCategories) next.append("program", value);
    if (changes.page && changes.page > 1) next.set("page", String(changes.page));
    const query = next.toString();
    return query ? `/researcher/applicants?${query}` : "/researcher/applicants";
  }

  function toggled(list: string[], value: string) {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  const tabs = [
    { value: "", label: "All", count: counts.all },
    { value: "awaiting", label: "Awaiting review", count: counts.awaiting },
    { value: "active", label: "Active", count: counts.active },
  ];

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title="Applicants"
        lede="Everyone who has applied to a position you control, newest first. Narrow by what they are applying as, or by the program they are in."
      />

      <div className="mb-3 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={hrefWith({ filter: tab.value })}
            aria-current={filter === tab.value ? "page" : undefined}
            className={
              filter === tab.value
                ? "inline-flex h-8 items-center gap-2 rounded-full bg-moss px-3.5 text-[13px] font-medium text-forest"
                : "inline-flex h-8 items-center gap-2 rounded-full border border-line bg-white px-3.5 text-[13px] text-muted hover:text-ink"
            }
          >
            {tab.label}
            <span className="text-[11.5px] text-subtle">{tab.count}</span>
          </Link>
        ))}
      </div>

      <div className="mb-5 rounded-[12px] border border-line bg-white px-4 py-3.5">
        <fieldset className="mb-3">
          <legend className="mb-1.5 text-[11.5px] font-medium text-subtle">Applying as</legend>
          <div className="flex flex-wrap gap-1.5">
            {COURSE_TYPE_ORDER.map((value) => {
              const active = courseTypes.includes(value);
              return (
                <Link
                  key={value}
                  href={hrefWith({ courseType: toggled(courseTypes, value) })}
                  aria-pressed={active}
                  className={
                    active
                      ? "inline-flex h-7 items-center rounded-full bg-forest px-3 text-[12.5px] text-white"
                      : "inline-flex h-7 items-center rounded-full border border-line px-3 text-[12.5px] text-muted hover:border-ink/30 hover:text-ink"
                  }
                >
                  {COURSE_TYPE_LABELS[value]}
                </Link>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-[11.5px] font-medium text-subtle">Program</legend>
          <div className="flex flex-wrap gap-1.5">
            {PROGRAM_CATEGORY_ORDER.map((value) => {
              const active = programCategories.includes(value);
              return (
                <Link
                  key={value}
                  href={hrefWith({ program: toggled(programCategories, value) })}
                  aria-pressed={active}
                  className={
                    active
                      ? "inline-flex h-7 items-center rounded-full bg-forest px-3 text-[12.5px] text-white"
                      : "inline-flex h-7 items-center rounded-full border border-line px-3 text-[12.5px] text-muted hover:border-ink/30 hover:text-ink"
                  }
                >
                  {PROGRAM_CATEGORY_LABELS[value]}
                </Link>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <p className="text-[12.5px] text-subtle">
            {results.total} {results.total === 1 ? "applicant" : "applicants"}
            {structuralCount > 0 ? " matching these filters" : ""}
          </p>
          {structuralCount > 0 ? (
            <Link
              href={hrefWith({ courseType: [], program: [] })}
              className="text-[12.5px] text-forest underline decoration-line-strong underline-offset-4 hover:text-ink"
            >
              Clear {structuralCount}
            </Link>
          ) : null}
        </div>
      </div>

      {results.items.length === 0 ? (
        <EmptyState
          title={counts.all === 0 ? "No applications yet." : "No applicants match these filters."}
          body={
            counts.all === 0
              ? "Applicants appear here as soon as students submit. Each one arrives with their profile and their answers to the questions you wrote."
              : "Course type and program narrow the pool fastest. Clear one of them to widen it again."
          }
          actionHref={counts.all === 0 ? "/researcher/opportunities/new" : "/researcher/applicants"}
          actionLabel={counts.all === 0 ? "Post opportunity" : "Clear filters"}
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[12px] border border-line bg-white md:block">
            <table className="w-full text-left">
              <caption className="sr-only">Applicants to your positions</caption>
              <thead>
                <tr className="border-b border-line bg-shell/60">
                  <th scope="col" className="px-4 py-2.5 text-[12px] font-medium text-subtle">Student</th>
                  <th scope="col" className="px-4 py-2.5 text-[12px] font-medium text-subtle">Position</th>
                  <th scope="col" className="px-4 py-2.5 text-[12px] font-medium text-subtle">Applying as</th>
                  <th scope="col" className="px-4 py-2.5 text-[12px] font-medium text-subtle">Availability</th>
                  <th scope="col" className="px-4 py-2.5 text-[12px] font-medium text-subtle">Submitted</th>
                  <th scope="col" className="px-4 py-2.5 text-[12px] font-medium text-subtle">Status</th>
                </tr>
              </thead>
              <tbody>
                {results.items.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-b-0 hover:bg-shell/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/researcher/opportunities/${row.opportunityId}/applicants/${row.id}`}
                        className="text-[14px] font-medium text-ink underline decoration-transparent underline-offset-4 hover:decoration-line-strong"
                      >
                        {row.displayName}
                      </Link>
                      <p className="mt-0.5 text-[12.5px] text-muted">
                        {row.program ?? "Program not set"}
                        {row.yearLevel ? `, year ${row.yearLevel}` : ""}
                      </p>
                      {row.programCategory ? (
                        <p className="mt-0.5 text-[12px] text-subtle">
                          {labelOr(PROGRAM_CATEGORY_LABELS, row.programCategory)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted">{row.opportunityTitle}</td>
                    <td className="px-4 py-3">
                      {row.courseTypes.length === 0 ? (
                        <span className="text-[12.5px] text-subtle">Not stated</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {row.courseTypes.map((value) => (
                            <Badge key={value} tone="neutral">
                              {labelOr(COURSE_TYPE_LABELS, value)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted">
                      {row.weeklyHours !== null ? `${row.weeklyHours} hours per week` : "Not stated"}
                      <span className="block text-[12px] text-subtle">
                        {labelOr(LOCATION_LABELS, row.locationPreference)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted">{formatShortDate(row.submittedAt)}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={row.status as ApplicationStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-3 md:hidden">
            {results.items.map((row) => (
              <li key={row.id} className="relative rounded-[12px] border border-line bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-ink">
                      <Link
                        href={`/researcher/opportunities/${row.opportunityId}/applicants/${row.id}`}
                        className="after:absolute after:inset-0 after:content-['']"
                      >
                        {row.displayName}
                      </Link>
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-muted">
                      {row.program ?? "Program not set"}
                      {row.yearLevel ? `, year ${row.yearLevel}` : ""}
                    </p>
                  </div>
                  <StatusPill status={row.status as ApplicationStatus} />
                </div>
                <p className="mt-2 text-[13px] text-muted">{row.opportunityTitle}</p>
                {row.courseTypes.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {row.courseTypes.map((value) => (
                      <Badge key={value} tone="neutral">
                        {labelOr(COURSE_TYPE_LABELS, value)}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <p className="mt-1.5 text-[12px] text-subtle">
                  {row.weeklyHours !== null ? `${row.weeklyHours} hours per week` : "Availability not stated"}
                  {`, submitted ${formatShortDate(row.submittedAt)}`}
                </p>
              </li>
            ))}
          </ul>

          {results.pageCount > 1 ? (
            <nav aria-label="Pagination" className="mt-6 flex items-center justify-between">
              {results.page > 1 ? (
                <Link
                  href={hrefWith({ page: results.page - 1 })}
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
                  href={hrefWith({ page: results.page + 1 })}
                  className="inline-flex h-9 items-center rounded-full border border-line-strong bg-white px-4 text-[13px] text-ink hover:bg-shell"
                >
                  Next
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
