import type { Metadata } from "next";
import Link from "next/link";
import { AdminPanel, DataTable, FilterTabs } from "@/components/app/admin-ui";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/permissions";
import { formatShortDate } from "@/lib/format";
import { COMPENSATION_LABELS, OPPORTUNITY_STATUS_LABELS, labelOr } from "@/lib/labels";
import { adminOpportunities } from "@/lib/queries/admin";
import { ModerationControls } from "./moderation-controls";

export const metadata: Metadata = {
  title: "Opportunities",
  robots: { index: false, follow: false },
};

const TONE = {
  published: "forest",
  draft: "outline",
  closed: "neutral",
  unpublished: "warn",
  archived: "neutral",
} as const;

export default async function AdminOpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireAdmin();
  const { filter } = await searchParams;
  const [rows, all] = await Promise.all([adminOpportunities(filter), adminOpportunities()]);

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Admin"
        title="Opportunities"
        lede="Every listing across the pilot. Unpublishing hides a listing without touching its applications."
        actions={
          <ButtonLink href="/api/admin/export?dataset=opportunities" variant="outline">
            Export CSV
          </ButtonLink>
        }
      />

      <div className="mb-4">
        <FilterTabs
          base="/admin/opportunities"
          current={filter ?? ""}
          tabs={[
            { value: "", label: "All", count: all.length },
            { value: "published", label: "Published", count: all.filter((row) => row.status === "published").length },
            { value: "draft", label: "Draft", count: all.filter((row) => row.status === "draft").length },
            { value: "closed", label: "Closed", count: all.filter((row) => row.status === "closed").length },
            { value: "unpublished", label: "Unpublished", count: all.filter((row) => row.status === "unpublished").length },
            { value: "archived", label: "Archived", count: all.filter((row) => row.status === "archived").length },
          ]}
        />
      </div>

      <AdminPanel title="Listings" description={`${rows.length} shown`}>
        <DataTable
          caption="Research opportunities"
          empty="No listings match this filter."
          columns={["Position", "Researcher", "Status", "Applications", "Dates", "Actions"]}
          rows={rows.map((row) => [
            <div key={`${row.id}-title`}>
              <Link
                href={`/opportunities/${row.slug}`}
                className="text-[13.5px] font-medium text-ink underline decoration-transparent underline-offset-4 hover:decoration-line-strong"
              >
                {row.title}
              </Link>
              <p className="mt-0.5 text-[12px] text-subtle">{row.department ?? "Department not set"}</p>
              <p className="mt-0.5 text-[12px] text-muted">{labelOr(COMPENSATION_LABELS, row.compensationType)}</p>
            </div>,
            <div key={`${row.id}-researcher`}>
              <p className="text-[13px] text-ink">
                {row.researcherFirst} {row.researcherLast}
              </p>
              <p className="mt-0.5 text-[12px] text-subtle">{row.institutionName}</p>
            </div>,
            <Badge key={`${row.id}-status`} tone={TONE[row.status]}>
              {labelOr(OPPORTUNITY_STATUS_LABELS, row.status)}
            </Badge>,
            <div key={`${row.id}-apps`} className="text-[13px]">
              <p className="text-ink">{row.applicationCount}</p>
              <p className="text-[12px] text-subtle">{row.viewCount} views</p>
            </div>,
            <div key={`${row.id}-dates`} className="text-[12px] leading-5">
              <p>Created {formatShortDate(row.createdAt)}</p>
              {row.publishedAt ? <p className="text-subtle">Published {formatShortDate(row.publishedAt)}</p> : null}
              <p className="text-subtle">Closes {formatShortDate(row.deadline)}</p>
            </div>,
            <ModerationControls key={`${row.id}-actions`} opportunityId={row.id} status={row.status} />,
          ])}
        />
      </AdminPanel>
    </div>
  );
}
