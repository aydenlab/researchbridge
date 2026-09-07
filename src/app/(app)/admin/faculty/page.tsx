import type { Metadata } from "next";
import { AdminPanel } from "@/components/app/admin-ui";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/permissions";
import { formatShortDate } from "@/lib/format";
import { facultyImportSummary, listUnclaimedFaculty } from "@/lib/faculty/import";
import { FacultyImportForm } from "./import-form";

export const metadata: Metadata = {
  title: "Faculty list",
  robots: { index: false, follow: false },
};

export default async function AdminFacultyPage() {
  await requireAdmin();

  const [summary, unclaimed] = await Promise.all([facultyImportSummary(), listUnclaimedFaculty()]);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="ResearchBridge admin"
        title="Faculty list"
        lede="Import a faculty list so a professor arrives at a profile that is already written. They sign in, correct anything wrong, say what they need, and that is the whole of it."
        actions={
          <>
            <Badge tone="neutral">{summary.prefilled} imported</Badge>
            <Badge tone="forest">{summary.claimed} confirmed</Badge>
          </>
        }
      />

      <div className="flex flex-col gap-5">
        <AdminPanel
          title="Import"
          description="Re-running this is safe. A profile the person has already confirmed is never overwritten."
        >
          <FacultyImportForm />
        </AdminPanel>

        <AdminPanel
          title="Waiting to be claimed"
          description="Imported profiles nobody has signed in to yet. These accounts are pending and are not counted as active users."
        >
          {unclaimed.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13.5px] text-muted">
              Nothing waiting. Either no list has been imported, or everybody on it has signed in.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <caption className="sr-only">Imported faculty profiles that have not been claimed</caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="px-5 py-2.5 text-[12px] font-medium text-subtle">Name</th>
                    <th scope="col" className="px-5 py-2.5 text-[12px] font-medium text-subtle">Email</th>
                    <th scope="col" className="px-5 py-2.5 text-[12px] font-medium text-subtle">Department</th>
                    <th scope="col" className="px-5 py-2.5 text-[12px] font-medium text-subtle">Source</th>
                    <th scope="col" className="px-5 py-2.5 text-[12px] font-medium text-subtle">Imported</th>
                  </tr>
                </thead>
                <tbody>
                  {unclaimed.map((row) => (
                    <tr key={row.userId} className="border-b border-line last:border-b-0">
                      <td className="px-5 py-2.5 text-ink">
                        {row.firstName} {row.lastName}
                        {row.title ? <span className="block text-[12px] text-subtle">{row.title}</span> : null}
                      </td>
                      <td className="px-5 py-2.5 text-muted">{row.email}</td>
                      <td className="px-5 py-2.5 text-muted">{row.department ?? "Not given"}</td>
                      <td className="px-5 py-2.5 text-subtle">{row.prefilledSource}</td>
                      <td className="px-5 py-2.5 text-subtle">
                        {row.prefilledAt ? formatShortDate(row.prefilledAt) : "Unknown"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminPanel>
      </div>
    </div>
  );
}
