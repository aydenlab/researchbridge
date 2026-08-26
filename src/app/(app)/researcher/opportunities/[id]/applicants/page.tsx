import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { listApplicantsForOpportunity } from "@/lib/queries/applications";

export const metadata: Metadata = {
  title: "Applicants",
  robots: { index: false, follow: false },
};

export default async function ApplicantsIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ published?: string; queued?: string }>;
}) {
  const { id } = await params;
  const { published, queued } = await searchParams;
  const applicants = await listApplicantsForOpportunity(id);

  return (
    <div className="flex flex-col gap-5">
      {queued ? (
        <div className="flex items-start gap-3 rounded-[12px] border border-[#e6d7ae] bg-gold-soft px-5 py-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden="true" />
          <div>
            <p className="font-display text-[19px] text-ink">Submitted for review</p>
            <p className="mt-1 text-[14px] leading-6 text-muted">
              An administrator checks it before students see it, usually within a day. Nothing else is needed from you,
              and applicants will appear here once it goes live.
            </p>
          </div>
        </div>
      ) : null}

      {published ? (
        <div className="flex items-start gap-3 rounded-[12px] border border-[#c2dccc] bg-moss px-5 py-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden="true" />
          <div>
            <p className="font-display text-[19px] text-forest">Opportunity published</p>
            <p className="mt-1 text-[14px] leading-6 text-forest/85">
              Students at your institution can see this listing and start applications now. Applicants appear on the
              left as they submit.
            </p>
          </div>
        </div>
      ) : null}

      <div className="rounded-[12px] border border-line bg-white px-6 py-16 text-center">
        {applicants.length === 0 ? (
          <>
            <p className="font-display text-[20px] text-ink">No applications yet.</p>
            <p className="mx-auto mt-2 max-w-md text-[14px] leading-6 text-muted">
              Applicants appear here as soon as students submit. Each one arrives with their profile and their answers
              to the questions you wrote.
            </p>
            <p className="mx-auto mt-4 max-w-md text-[13px] leading-6 text-subtle">
              You can{" "}
              <Link href={`/researcher/opportunities/${id}/edit?step=1`} className="underline decoration-line-strong underline-offset-4">
                edit the listing
              </Link>{" "}
              at any time while it is open.
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-[20px] text-ink">Choose an applicant to review</p>
            <p className="mx-auto mt-2 max-w-md text-[14px] leading-6 text-muted">
              {applicants.length} {applicants.length === 1 ? "application" : "applications"} submitted. Open one from
              the list to see their profile, their answers, and the evidence for each criterion you set.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
