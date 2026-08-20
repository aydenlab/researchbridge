import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-pill";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireStudent } from "@/lib/auth/permissions";
import { STUDENT_STATUS_DESCRIPTION, isActive, type ApplicationStatus } from "@/lib/application-status";
import { formatShortDate, deadlineNote } from "@/lib/format";
import { COMPENSATION_LABELS, labelOr } from "@/lib/labels";
import { listStudentApplications } from "@/lib/queries/applications";

export const metadata: Metadata = {
  title: "Your applications",
  robots: { index: false, follow: false },
};

export default async function ApplicationsPage() {
  const user = await requireStudent();
  const rows = await listStudentApplications(user.id);

  const drafts = rows.filter((row) => row.status === "draft");
  const active = rows.filter((row) => isActive(row.status));
  const closed = rows.filter((row) => row.status !== "draft" && !isActive(row.status));

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-[1080px] px-4 py-8 sm:px-6 sm:py-10">
        <PageHeader title="Your applications" />
        <EmptyState
          title="You have not submitted any applications yet."
          body="Browse open research opportunities when you are ready. Your profile is already filled in, so an application only asks for what this particular researcher wants to know."
          actionHref="/opportunities"
          actionLabel="Explore opportunities"
        />
      </div>
    );
  }

  function Group({ title, items, note }: { title: string; items: typeof rows; note?: string }) {
    if (items.length === 0) return null;
    return (
      <section className="mt-8 first:mt-0">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[20px] text-ink" style={{ letterSpacing: "-0.4px" }}>
            {title}
          </h2>
          <p className="text-[13px] text-muted">
            {items.length} {items.length === 1 ? "application" : "applications"}
          </p>
        </div>
        {note ? <p className="mb-3 text-[13.5px] leading-6 text-muted">{note}</p> : null}

        <ul className="overflow-hidden rounded-[12px] border border-line bg-white">
          {items.map((row) => {
            const deadline = deadlineNote(row.opportunityDeadline);
            return (
              <li key={row.id} className="relative border-b border-line px-4 py-4 last:border-b-0 hover:bg-shell/70 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-[18px] leading-6 text-ink">
                      <Link
                        href={row.status === "draft" ? `/applications/${row.id}/edit` : `/applications/${row.id}`}
                        className="after:absolute after:inset-0 after:content-['']"
                      >
                        {row.opportunityTitle}
                      </Link>
                    </h3>
                    <p className="mt-1 text-[13px] text-muted">
                      {row.researcherTitle ? `${row.researcherTitle} ` : ""}
                      {row.researcherFirstName} {row.researcherLastName}
                      {row.department ? `, ${row.department}` : ""}
                    </p>
                  </div>
                  <StatusPill status={row.status as ApplicationStatus} />
                </div>

                <p className="mt-2 text-[13.5px] leading-6 text-muted">
                  {STUDENT_STATUS_DESCRIPTION[row.status as ApplicationStatus]}
                </p>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-muted">
                  <Badge tone="outline">{labelOr(COMPENSATION_LABELS, row.compensationType)}</Badge>
                  {row.submittedAt ? <span>Submitted {formatShortDate(row.submittedAt)}</span> : null}
                  <span>Updated {formatShortDate(row.updatedAt)}</span>
                  {row.status === "draft" ? <span className={deadline.urgent ? "text-warn" : ""}>{deadline.text}</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title="Your applications"
        lede="Every application is reviewed against the criteria set for that project. Nothing here carries over to another position."
        actions={
          <ButtonLink href="/opportunities" variant="outline">
            Explore opportunities
          </ButtonLink>
        }
      />

      <Group
        title="Drafts"
        items={drafts}
        note="Drafts are visible only to you. They are not sent until you submit them."
      />
      <Group title="Active" items={active} />
      <Group title="Closed" items={closed} />
    </div>
  );
}
