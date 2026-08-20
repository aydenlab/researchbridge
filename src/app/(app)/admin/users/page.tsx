import type { Metadata } from "next";
import { AdminPanel, DataTable, FilterTabs } from "@/components/app/admin-ui";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { requireAdmin } from "@/lib/auth/permissions";
import { formatShortDate } from "@/lib/format";
import { VERIFICATION_LABELS, labelOr } from "@/lib/labels";
import { adminUsers } from "@/lib/queries/admin";
import { AccountControls } from "./account-controls";

export const metadata: Metadata = {
  title: "Users",
  robots: { index: false, follow: false },
};

const STATUS_TONE = {
  active: "ok",
  pending: "warn",
  suspended: "warn",
  disabled: "bad",
} as const;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  await requireAdmin();
  const { filter, q } = await searchParams;

  const rows = await adminUsers(filter, q);
  const students = rows.filter((row) => row.role === "student").length;
  const researchers = rows.filter((row) => row.role === "researcher").length;

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Admin"
        title="Users"
        lede="Every account in the pilot. Disabling an account signs it out and blocks sign in."
        actions={<ButtonLink href="/api/admin/export?dataset=users" variant="outline">Export CSV</ButtonLink>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterTabs
          base="/admin/users"
          current={filter ?? ""}
          tabs={[
            { value: "", label: "All", count: rows.length },
            { value: "student", label: "Students", count: students },
            { value: "researcher", label: "Researchers", count: researchers },
            { value: "admin", label: "Admins" },
          ]}
        />
        <form action="/admin/users" method="get" className="ml-auto flex gap-2">
          {filter ? <input type="hidden" name="filter" value={filter} /> : null}
          <label htmlFor="user-search" className="sr-only">
            Search by email
          </label>
          <Input id="user-search" name="q" type="search" defaultValue={q ?? ""} placeholder="Search by email" className="w-56" />
          <button type="submit" className="inline-flex h-[38px] items-center rounded-full bg-ink px-4 text-[13px] font-medium text-white">
            Search
          </button>
        </form>
      </div>

      <AdminPanel title="Accounts" description={`${rows.length} shown`}>
        <DataTable
          caption="ResearchBridge accounts"
          empty="No accounts match this filter."
          columns={["Person", "Role", "Institution", "Status", "Activity", "Actions"]}
          rows={rows.map((row) => [
            <div key={`${row.id}-name`}>
              <p className="text-[13.5px] font-medium text-ink">
                {row.role === "researcher"
                  ? [row.researcherFirst, row.researcherLast].filter(Boolean).join(" ") || "Name not set"
                  : [row.studentFirst, row.studentLast].filter(Boolean).join(" ") || "Name not set"}
              </p>
              <p className="mt-0.5 text-[12px] text-subtle">{row.email}</p>
              {row.studentProgram ? <p className="mt-0.5 text-[12px] text-muted">{row.studentProgram}</p> : null}
            </div>,
            <div key={`${row.id}-role`} className="flex flex-col gap-1">
              <span className="text-[13px] capitalize text-ink">{row.role ?? "Not chosen"}</span>
              {row.role === "researcher" && row.researcherStatus ? (
                <Badge tone={row.researcherStatus === "verified" ? "ok" : row.researcherStatus === "rejected" ? "bad" : "warn"}>
                  {labelOr(VERIFICATION_LABELS, row.researcherStatus)}
                </Badge>
              ) : null}
              {row.role === "student" && row.studentCompletion !== null ? (
                <span className="text-[12px] text-subtle">{row.studentCompletion} percent complete</span>
              ) : null}
            </div>,
            row.institutionName ?? "Not linked",
            <Badge key={`${row.id}-status`} tone={STATUS_TONE[row.accountStatus]}>
              {row.accountStatus}
            </Badge>,
            <div key={`${row.id}-activity`} className="text-[12px] leading-5">
              <p>Joined {formatShortDate(row.createdAt)}</p>
              <p className="text-subtle">
                {row.lastLoginAt ? `Last seen ${formatShortDate(row.lastLoginAt)}` : "Never signed in"}
              </p>
              <p className="text-subtle">{row.onboardingCompletedAt ? "Onboarded" : "Onboarding incomplete"}</p>
            </div>,
            <AccountControls key={`${row.id}-actions`} userId={row.id} status={row.accountStatus} />,
          ])}
        />
      </AdminPanel>
    </div>
  );
}
