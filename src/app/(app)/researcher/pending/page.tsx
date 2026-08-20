import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, researcherProfiles } from "@/db";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireResearcher } from "@/lib/auth/permissions";
import { VERIFICATION_LABELS, labelOr } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Account under review",
  robots: { index: false, follow: false },
};

export default async function ResearcherPendingPage() {
  const user = await requireResearcher();
  if (user.researcherVerification === "verified") redirect("/researcher");

  const rows = await db.select().from(researcherProfiles).where(eq(researcherProfiles.userId, user.id)).limit(1);
  const profile = rows[0];

  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Researcher account"
        title="Your account is with a ResearchBridge administrator"
        actions={<Badge tone={profile?.verificationStatus === "rejected" ? "bad" : "warn"}>{labelOr(VERIFICATION_LABELS, profile?.verificationStatus)}</Badge>}
      />

      <div className="rounded-[12px] border border-line bg-white p-6">
        {profile?.verificationStatus === "rejected" ? (
          <>
            <p className="text-[15px] leading-7 text-muted">
              This account was not approved for the pilot. If you believe that is a mistake, write to
              hello@myresearchbridge.com from your institutional address and we will look at it again.
            </p>
            {profile.verificationNotes ? (
              <p className="mt-4 rounded-[8px] border border-line bg-shell px-4 py-3 text-[14px] leading-6 text-muted">
                Note from the reviewer: {profile.verificationNotes}
              </p>
            ) : null}
          </>
        ) : profile?.verificationStatus === "needs_review" ? (
          <>
            <p className="text-[15px] leading-7 text-muted">
              A reviewer has asked for clarification before approving this account.
            </p>
            {profile.verificationNotes ? (
              <p className="mt-4 rounded-[8px] border border-line bg-shell px-4 py-3 text-[14px] leading-6 text-muted">
                What they asked: {profile.verificationNotes}
              </p>
            ) : null}
            <p className="mt-4 text-[14px] leading-7 text-muted">
              Reply to hello@myresearchbridge.com from your institutional address and the account will be re-reviewed.
            </p>
          </>
        ) : (
          <>
            <p className="text-[15px] leading-7 text-muted">
              Researcher accounts are reviewed before positions can be published. This exists so that students can
              trust that every listing comes from a real research group. During the pilot it usually takes under a day.
            </p>
            <p className="mt-4 text-[15px] leading-7 text-muted">
              You will receive an email at {user.email} once it is done. Nothing else is needed from you right now.
            </p>
          </>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/profile" variant="outline">
            Review your profile
          </ButtonLink>
          <ButtonLink href="/opportunities" variant="outline">
            See what students see
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
