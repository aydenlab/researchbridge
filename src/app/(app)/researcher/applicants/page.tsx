import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { applications, db, opportunities, studentProfiles } from "@/db";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-pill";
import { requireResearcher } from "@/lib/auth/permissions";
import { isActive, type ApplicationStatus } from "@/lib/application-status";
import { formatShortDate } from "@/lib/format";
import { LOCATION_LABELS, labelOr } from "@/lib/labels";

export const metadata: Metadata = {
  title: "All applicants",
  robots: { index: false, follow: false },
};

export default async function AllApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requireResearcher();
  if (user.researcherVerification !== "verified") redirect("/researcher/pending");

  const { filter } = await searchParams;

  const rows = await db
    .select({
      id: applications.id,
      status: applications.status,
      submittedAt: applications.submittedAt,
      opportunityId: opportunities.id,
      opportunityTitle: opportunities.title,
      firstName: studentProfiles.firstName,
      lastName: studentProfiles.lastName,
      preferredName: studentProfiles.preferredName,
      program: studentProfiles.program,
      yearLevel: studentProfiles.yearLevel,
      weeklyHours: studentProfiles.weeklyHours,
      locationPreference: studentProfiles.locationPreference,
    })
    .from(applications)
    .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
    .innerJoin(studentProfiles, eq(studentProfiles.userId, applications.studentId))
    .where(and(eq(opportunities.researcherId, user.id), ne(applications.status, "draft")))
    .orderBy(desc(applications.submittedAt))
    .limit(200);

  const filtered =
    filter === "awaiting"
      ? rows.filter((row) => row.status === "submitted")
      : filter === "active"
        ? rows.filter((row) => isActive(row.status))
        : rows;

  const tabs = [
    { value: "", label: "All", count: rows.length },
    { value: "awaiting", label: "Awaiting review", count: rows.filter((row) => row.status === "submitted").length },
    { value: "active", label: "Active", count: rows.filter((row) => isActive(row.status)).length },
  ];

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title="Applicants"
        lede="Everyone who has applied to a position you control, newest first."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.value ? `/researcher/applicants?filter=${tab.value}` : "/researcher/applicants"}
            aria-current={(filter ?? "") === tab.value ? "page" : undefined}
            className={
              (filter ?? "") === tab.value
                ? "inline-flex h-8 items-center gap-2 rounded-full bg-moss px-3.5 text-[13px] font-medium text-forest"
                : "inline-flex h-8 items-center gap-2 rounded-full border border-line bg-white px-3.5 text-[13px] text-muted hover:text-ink"
            }
          >
            {tab.label}
            <span className="text-[11.5px] text-subtle">{tab.count}</span>
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? "No applications yet." : "No applicants match this filter."}
          body={
            rows.length === 0
              ? "Applicants appear here as soon as students submit. Each one arrives with their profile and their answers to the questions you wrote."
              : "Try the All tab to see everyone who has applied."
          }
          actionHref={rows.length === 0 ? "/researcher/opportunities/new" : "/researcher/applicants"}
          actionLabel={rows.length === 0 ? "Post opportunity" : "Show all"}
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
                  <th scope="col" className="px-4 py-2.5 text-[12px] font-medium text-subtle">Availability</th>
                  <th scope="col" className="px-4 py-2.5 text-[12px] font-medium text-subtle">Submitted</th>
                  <th scope="col" className="px-4 py-2.5 text-[12px] font-medium text-subtle">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-b-0 hover:bg-shell/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/researcher/opportunities/${row.opportunityId}/applicants/${row.id}`}
                        className="text-[14px] font-medium text-ink underline decoration-transparent underline-offset-4 hover:decoration-line-strong"
                      >
                        {row.preferredName ?? row.firstName} {row.lastName}
                      </Link>
                      <p className="mt-0.5 text-[12.5px] text-muted">
                        {row.program ?? "Program not set"}
                        {row.yearLevel ? `, year ${row.yearLevel}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted">{row.opportunityTitle}</td>
                    <td className="px-4 py-3 text-[13px] text-muted">
                      {row.weeklyHours !== null ? `${row.weeklyHours} hours per week` : "Not stated"}
                      <span className="block text-[12px] text-subtle">{labelOr(LOCATION_LABELS, row.locationPreference)}</span>
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
            {filtered.map((row) => (
              <li key={row.id} className="relative rounded-[12px] border border-line bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-ink">
                      <Link
                        href={`/researcher/opportunities/${row.opportunityId}/applicants/${row.id}`}
                        className="after:absolute after:inset-0 after:content-['']"
                      >
                        {row.preferredName ?? row.firstName} {row.lastName}
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
                <p className="mt-1.5 text-[12px] text-subtle">
                  {row.weeklyHours !== null ? `${row.weeklyHours} hours per week` : "Availability not stated"}
                  {`, submitted ${formatShortDate(row.submittedAt)}`}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
