import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { requireResearcher, canManageOpportunity } from "@/lib/auth/permissions";
import { loadOpportunityDetail } from "@/lib/queries/opportunities";
import { ReviewPostingForm } from "../../new/review-posting-form";

export const metadata: Metadata = {
  title: "Edit review",
  robots: { index: false, follow: false },
};

export default async function EditReviewPostingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireResearcher();
  if (!(await canManageOpportunity(user, id))) notFound();

  const detail = await loadOpportunityDetail(id);
  if (!detail || detail.opportunity.kind !== "review_project") notFound();

  return (
    <div className="mx-auto max-w-[720px] px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-5">
        <Link
          href="/researcher/opportunities"
          className="text-[13px] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink"
        >
          Back to your postings
        </Link>
      </nav>

      <PageHeader eyebrow="Review" title="Edit review" lede="Changes are visible to students as soon as you save." />

      <Card>
        <CardBody className="py-6">
          <ReviewPostingForm
            opportunityId={id}
            draft={{
              title: detail.opportunity.title,
              summary: detail.opportunity.summary,
              authorshipOffered: detail.opportunity.authorshipOffered,
              reviewTasks: detail.reviewTasks,
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
