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
  title: "Account verification",
  robots: { index: false, follow: false },
};

export default async function ResearcherPendingPage() {
  const user = await requireResearcher();
  if (user.researcherVerification === "verified") redirect("/researcher");

  const rows = await db.select().from(researcherProfiles).where(eq(researcherProfiles.userId, user.id)).limit(1);
  const profile = rows[0];
  const rejected = profile?.verificationStatus === "rejected";

  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Researcher account"
        title={rejected ? "This account was not verified" : "Verification is running in the background"}
        lede={
          rejected
            ? undefined
            : "You do not have to wait for it. You can write and submit a position right now."
        }
        actions={
          <Badge tone={rejected ? "bad" : "warn"}>{labelOr(VERIFICATION_LABELS, profile?.verificationStatus)}</Badge>
        }
      />

      <div className="rounded-[12px] border border-line bg-white p-6">
        {rejected ? (
          <>
            <p className="text-[15px] leading-7 text-muted">
              This account was not approved for the pilot. If you believe that is a mistake, write to
              hello@myresearchbridge.com and we will look at it again.
            </p>
            {profile?.verificationNotes ? (
              <p className="mt-4 rounded-[8px] border border-line bg-shell px-4 py-3 text-[14px] leading-6 text-muted">
                Note from the reviewer: {profile.verificationNotes}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-[15px] leading-7 text-muted">
              Verification is how students know a listing comes from a real research group. It no longer blocks you:
              create your position now, and a reviewer looks at it before it goes in front of students.
            </p>
            {profile?.verificationStatus === "needs_review" && profile.verificationNotes ? (
              <p className="mt-4 rounded-[8px] border border-line bg-shell px-4 py-3 text-[14px] leading-6 text-muted">
                A reviewer asked: {profile.verificationNotes}
              </p>
            ) : null}
            <p className="mt-4 text-[15px] leading-7 text-muted">
              You will hear from us at {user.email} when verification is done. Nothing else is needed from you.
            </p>
          </>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {rejected ? null : <ButtonLink href="/researcher/opportunities/new">Post a position</ButtonLink>}
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
