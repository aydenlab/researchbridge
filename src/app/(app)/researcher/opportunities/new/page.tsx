import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { requireApprovedResearcher } from "@/lib/auth/permissions";
import { CreateDraftButton } from "./create-draft-button";

export const metadata: Metadata = {
  title: "Post a research position",
  robots: { index: false, follow: false },
};

const STEPS = [
  "The research project, in language a second-year student can follow.",
  "What the student would actually spend their time doing.",
  "Openings, hours, dates, location, and compensation category.",
  "The criteria that matter for this project, and how much each counts.",
  "Questions written for this project rather than a generic form.",
  "Optionally attach a paper and ask applicants to respond to it.",
  "Optionally request a short video response. Off by default.",
  "A preview of exactly what students see.",
  "Confirm and publish.",
];

export default async function NewOpportunityPage() {
  await requireApprovedResearcher();

  return (
    <div className="mx-auto max-w-[760px] px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="New position"
        title="Post a research opportunity"
        lede="Nine short steps. Everything saves as a draft, so you can stop and come back."
      />

      <ol className="overflow-hidden rounded-[12px] border border-line bg-white">
        {STEPS.map((description, index) => (
          <li key={description} className="grid grid-cols-[52px_1fr] gap-3 border-b border-line px-5 py-3.5 last:border-b-0">
            <span className="font-mono text-[13px] text-subtle">{String(index + 1).padStart(2, "0")}</span>
            <span className="text-[14px] leading-6 text-muted">{description}</span>
          </li>
        ))}
      </ol>

      <div className="mt-7">
        <CreateDraftButton />
      </div>
    </div>
  );
}
