import type { Metadata } from "next";
import { AdminPanel, DataTable } from "@/components/app/admin-ui";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-pill";
import { ButtonLink } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/permissions";
import type { ApplicationStatus } from "@/lib/application-status";
import { formatShortDate } from "@/lib/format";
import { adminApplications } from "@/lib/queries/admin";

export const metadata: Metadata = {
  title: "Applications",
  robots: { index: false, follow: false },
};

export default async function AdminApplicationsPage() {
  await requireAdmin();
  const rows = await adminApplications();

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Admin"
        title="Applications"
        lede="Aggregate visibility for pilot operations. Written responses and private researcher notes are not shown here."
        actions={
          <ButtonLink href="/api/admin/export?dataset=applications" variant="outline">
            Export CSV
          </ButtonLink>
        }
      />

      <AdminPanel title="Submitted applications" description={`${rows.length} shown, newest first`}>
        <DataTable
          caption="Applications across the pilot"
          empty="No applications have been submitted yet."
          columns={["Student", "Position", "Researcher", "Institution", "Submitted", "Status"]}
          rows={rows.map((row) => [
            <div key={`${row.id}-student`}>
              <p className="text-[13.5px] font-medium text-ink">
                {row.studentFirst} {row.studentLast}
              </p>
              <p className="mt-0.5 text-[12px] text-subtle">{row.studentProgram ?? "Program not set"}</p>
            </div>,
            row.opportunityTitle,
            `${row.researcherFirst} ${row.researcherLast}`,
            row.institutionName,
            formatShortDate(row.submittedAt),
            <StatusPill key={`${row.id}-status`} status={row.status as ApplicationStatus} />,
          ])}
        />
      </AdminPanel>

      <p className="mt-5 text-[12.5px] leading-6 text-subtle">
        Application text, uploaded files, and researcher notes are deliberately excluded from this view and from broad
        exports. Access them only through the researcher review flow where the access is scoped to a single position.
      </p>
    </div>
  );
}
