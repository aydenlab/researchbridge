import type { Metadata } from "next";
import { AdminPanel } from "@/components/app/admin-ui";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/permissions";
import { formatShortDate } from "@/lib/format";
import { RESEARCHER_TYPE_LABELS, VERIFICATION_LABELS, labelOr } from "@/lib/labels";
import { pendingResearchers } from "@/lib/queries/admin";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = {
  title: "Researcher approvals",
  robots: { index: false, follow: false },
};

const TONE = {
  pending: "warn",
  needs_review: "warn",
  verified: "ok",
  rejected: "bad",
} as const;

export default async function AdminResearchersPage() {
  await requireAdmin();
  const rows = await pendingResearchers();

  const awaiting = rows.filter((row) => row.verificationStatus === "pending" || row.verificationStatus === "needs_review");
  const decided = rows.filter((row) => row.verificationStatus === "verified" || row.verificationStatus === "rejected");

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Admin"
        title="Researcher approvals"
        lede="Every researcher account is reviewed before positions can be published. This is what students are trusting."
      />

      <div className="flex flex-col gap-6">
        <AdminPanel
          title="Awaiting review"
          description={`${awaiting.length} ${awaiting.length === 1 ? "account" : "accounts"}`}
        >
          {awaiting.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13.5px] text-muted">
              Nothing waiting. New researcher accounts appear here as soon as they are submitted.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {awaiting.map((row) => (
                <li key={row.userId} className="px-5 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[16px] font-medium text-ink">
                          {row.firstName} {row.lastName}
                        </p>
                        <Badge tone={TONE[row.verificationStatus]}>{labelOr(VERIFICATION_LABELS, row.verificationStatus)}</Badge>
                      </div>
                      <p className="mt-1 text-[13.5px] text-muted">
                        {row.title ?? labelOr(RESEARCHER_TYPE_LABELS, row.researcherType)}
                        {row.department ? `, ${row.department}` : ""}
                        {row.labName ? ` (${row.labName})` : ""}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-subtle">
                        {row.email}, {row.institutionName ?? "no institution linked"}, submitted{" "}
                        {formatShortDate(row.createdAt)}
                      </p>
                      {row.personalWebsite ? (
                        <a
                          href={row.personalWebsite}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1.5 inline-block text-[13px] text-forest underline decoration-line-strong underline-offset-4"
                        >
                          {row.personalWebsite}
                        </a>
                      ) : null}
                      {row.biography ? (
                        <p className="rb-measure mt-2.5 text-[13.5px] leading-6 text-muted">{row.biography}</p>
                      ) : null}
                    </div>
                    <ButtonLink href={`/admin/researchers/${row.userId}`} variant="outline" size="sm">
                      Edit profile
                    </ButtonLink>
                  </div>

                  <div className="mt-4 border-t border-line pt-4">
                    <ReviewForm researcherId={row.userId} currentNotes={row.verificationNotes} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>

        <AdminPanel title="Decided" description={`${decided.length} accounts already reviewed`}>
          {decided.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13.5px] text-muted">No decisions recorded yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {decided.map((row) => (
                <li key={row.userId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-ink">
                      {row.firstName} {row.lastName}
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-muted">
                      {row.department ?? "Department not set"}, {row.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={TONE[row.verificationStatus]}>{labelOr(VERIFICATION_LABELS, row.verificationStatus)}</Badge>
                    <ButtonLink href={`/admin/researchers/${row.userId}`} variant="outline" size="sm">
                      Edit
                    </ButtonLink>
                    <details className="text-[12.5px]">
                      <summary className="cursor-pointer text-muted underline decoration-line-strong underline-offset-4 hover:text-ink">
                        Change
                      </summary>
                      <div className="mt-3 w-full min-w-[280px]">
                        <ReviewForm researcherId={row.userId} currentNotes={row.verificationNotes} />
                      </div>
                    </details>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
      </div>
    </div>
  );
}
