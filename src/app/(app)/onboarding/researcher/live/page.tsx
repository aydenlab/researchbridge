import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { requireResearcher } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "Your profile is live",
  robots: { index: false, follow: false },
};

/**
 * Where a researcher lands after finishing their profile. Posting is the
 * obvious next step, but it is a link rather than a redirect, so somebody
 * without a position ready yet is not dropped into a form they cannot finish.
 */
export default async function ResearcherProfileLivePage() {
  await requireResearcher();

  return (
    <div className="mx-auto max-w-[640px] px-4 py-12 sm:px-6 sm:py-16">
      <div className="rounded-[14px] border border-line bg-white px-6 py-8 sm:px-8 sm:py-10">
        <CheckCircle2 className="size-8 text-forest" aria-hidden="true" />
        <h1 className="mt-4 font-display text-[28px] text-ink sm:text-[32px]" style={{ letterSpacing: "-0.6px" }}>
          Your researcher profile is live!
        </h1>

        <div className="mt-6 border-t border-line pt-6">
          <p className="text-[12px] font-medium text-subtle">Next step</p>
          <h2 className="mt-1 font-display text-[20px] text-ink">Post a research opportunity</h2>
          <p className="mt-2 text-[15px] leading-7 text-muted">
            To participate in the Research Bridge pilot and begin connecting with students, you’ll need to post at least
            one research opportunity.
          </p>

          <ButtonLink href="/researcher/opportunities/new" size="lg" className="mt-6">
            Post an Opportunity
          </ButtonLink>
        </div>

        <p className="mt-8 text-[13.5px] leading-6 text-muted">
          Not ready yet? You can{" "}
          <Link href="/researcher" className="text-forest underline decoration-line-strong underline-offset-4 hover:text-ink">
            return to your dashboard
          </Link>{" "}
          and post an opportunity at any time.
        </p>
      </div>
    </div>
  );
}
