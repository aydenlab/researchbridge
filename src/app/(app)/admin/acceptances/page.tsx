import type { Metadata } from "next";
import Link from "next/link";
import { AdminPanel, DataTable } from "@/components/app/admin-ui";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-pill";
import { ButtonLink } from "@/components/ui/button";
import { canReadAllApplications, requireAdmin } from "@/lib/auth/permissions";
import type { ApplicationStatus } from "@/lib/application-status";
import { formatShortDate } from "@/lib/format";
import { adminAcceptances } from "@/lib/queries/admin";

export const metadata: Metadata = {
  title: "Acceptances",
  robots: { index: false, follow: false },
};

export default async function AdminAcceptancesPage() {
  const user = await requireAdmin();
  const rows = await adminAcceptances();
  const standing = rows.filter((row) => row.status === "accepted").length;
  const canRead = canReadAllApplications(user);

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Admin"
        title="Acceptances"
        lede="Every student a researcher has accepted through ResearchBridge, and how to reach both of them. One that was later turned down or withdrawn stays listed, under its current status."
        actions={
          <ButtonLink href="/api/admin/export?dataset=acceptances" variant="outline">
            Export CSV
          </ButtonLink>
        }
      />

      <AdminPanel title="Accepted students" description={`${standing} standing, ${rows.length} in total, newest first`}>
        <DataTable
          caption="Students accepted by researchers"
          empty="No student has been accepted yet."
          columns={["Student", "Position", "Researcher", "Institution", "Accepted", "Status now"]}
          rows={rows.map((row) => {
            const name = `${row.studentPreferred ?? row.studentFirst} ${row.studentLast}`;
            return [
              <div key={`${row.id}-student`}>
                {canRead ? (
                  <Link
                    href={`/admin/applications/${row.id}`}
                    className="text-[13.5px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:text-forest"
                  >
                    {name}
                  </Link>
                ) : (
                  <p className="text-[13.5px] font-medium text-ink">{name}</p>
                )}
                <a href={`mailto:${row.studentEmail}`} className="mt-0.5 block text-[12px] text-muted underline decoration-line-strong underline-offset-4">
                  {row.studentEmail}
                </a>
                <p className="mt-0.5 text-[12px] text-subtle">{row.studentProgram ?? "Program not set"}</p>
              </div>,
              row.opportunityTitle,
              <div key={`${row.id}-researcher`}>
                <p className="text-[13.5px] text-ink">
                  {row.researcherFirst} {row.researcherLast}
                </p>
                <a href={`mailto:${row.researcherEmail}`} className="mt-0.5 block text-[12px] text-muted underline decoration-line-strong underline-offset-4">
                  {row.researcherEmail}
                </a>
              </div>,
              row.institutionName,
              formatShortDate(row.acceptedAt),
              <StatusPill key={`${row.id}-status`} status={row.status as ApplicationStatus} />,
            ];
          })}
        />
      </AdminPanel>
    </div>
  );
}
