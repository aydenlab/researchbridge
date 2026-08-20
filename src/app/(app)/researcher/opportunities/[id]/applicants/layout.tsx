import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ApplicantRail } from "./applicant-rail";
import { requireResearcher, canManageOpportunity } from "@/lib/auth/permissions";
import { deadlineNote } from "@/lib/format";
import { COMPENSATION_LABELS, OPPORTUNITY_STATUS_LABELS, labelOr } from "@/lib/labels";
import { listApplicantsForOpportunity } from "@/lib/queries/applications";
import { loadOpportunityDetail } from "@/lib/queries/opportunities";

export default async function ApplicantsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireResearcher();
  if (user.researcherVerification !== "verified") redirect("/researcher/pending");
  if (!(await canManageOpportunity(user, id))) notFound();

  const [detail, applicants] = await Promise.all([loadOpportunityDetail(id), listApplicantsForOpportunity(id)]);
  if (!detail) notFound();

  const reviewed = applicants.filter((applicant) => applicant.status !== "submitted").length;
  const deadline = deadlineNote(detail.opportunity.deadline);

  return (
    <div className="mx-auto max-w-[1560px] px-4 py-6 sm:px-6 sm:py-8">
      <nav aria-label="Breadcrumb" className="mb-4">
        <Link
          href="/researcher/opportunities"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          All opportunities
        </Link>
      </nav>

      <header className="mb-6 border-b border-line pb-5">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={detail.opportunity.status === "published" ? "forest" : "neutral"}>
                {labelOr(OPPORTUNITY_STATUS_LABELS, detail.opportunity.status)}
              </Badge>
              <Badge tone="outline">{labelOr(COMPENSATION_LABELS, detail.opportunity.compensationType)}</Badge>
              <Badge tone={deadline.urgent ? "warn" : "outline"}>{deadline.text}</Badge>
            </div>
            <h1 className="mt-2.5 font-display text-[26px] leading-tight text-ink sm:text-[30px]" style={{ letterSpacing: "-0.6px" }}>
              {detail.opportunity.title}
            </h1>
          </div>

          <dl className="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <dt className="text-[12px] text-subtle">Submitted</dt>
              <dd className="font-display text-[22px] leading-tight text-ink">{applicants.length}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-subtle">Reviewed</dt>
              <dd className="font-display text-[22px] leading-tight text-ink">{reviewed}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-subtle">Openings</dt>
              <dd className="font-display text-[22px] leading-tight text-ink">{detail.opportunity.numberOfOpenings}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr] xl:gap-8">
        <ApplicantRail opportunityId={id} applicants={applicants} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
