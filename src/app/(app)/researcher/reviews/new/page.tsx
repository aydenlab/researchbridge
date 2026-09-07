import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { requireResearcher } from "@/lib/auth/permissions";
import { ReviewPostingForm } from "./review-posting-form";

export const metadata: Metadata = {
  title: "Post a review",
  robots: { index: false, follow: false },
};

export default async function NewReviewPostingPage() {
  const user = await requireResearcher();
  if (user.researcherVerification !== "verified") redirect("/researcher/pending");

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

      <PageHeader
        eyebrow="Review"
        title="Post a review"
        lede="Systematic, scoping, or general. Four questions, no draft steps, live as soon as you submit."
      />

      <Card>
        <CardBody className="py-6">
          <ReviewPostingForm />
        </CardBody>
      </Card>

      <p className="mt-4 text-[13px] leading-6 text-muted">
        Review postings are separate from research positions on purpose. They are short, they turn around quickly, and
        they are the clearest route a student has to being named on a paper. If what you have is a longer placement,
        post a{" "}
        <Link href="/researcher/opportunities/new" className="underline decoration-line-strong underline-offset-4">
          research position
        </Link>{" "}
        instead.
      </p>
    </div>
  );
}
