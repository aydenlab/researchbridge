import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { loadReferenceByToken } from "@/lib/queries/references";
import { ReferenceForm } from "./reference-form";

export const metadata: Metadata = {
  title: "Confirm a reference",
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-[620px] flex-col justify-center px-4 py-12 sm:px-6">
      <div className="rounded-[14px] border border-line bg-white px-6 py-7 sm:px-8 sm:py-9">{children}</div>
      <p className="mt-5 text-center text-[12px] text-subtle">ResearchBridge · hello@myresearchbridge.com</p>
    </main>
  );
}

export default async function ReferencePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = await loadReferenceByToken(token);

  if (!context) {
    return (
      <Shell>
        <h1 className="font-display text-[24px] text-ink">This link is not valid</h1>
        <p className="mt-3 text-[14px] leading-6 text-muted">
          It may have been mistyped, or the applicant may have removed the request. Ask them to send a new one.
        </p>
      </Shell>
    );
  }

  const studentName = `${context.studentFirstName} ${context.studentLastName}`.trim();
  const researcherName = context.researcherFirstName
    ? `${context.researcherFirstName} ${context.researcherLastName ?? ""}`.trim()
    : null;

  if (context.reference.status !== "pending") {
    const approved = context.reference.status === "approved";
    return (
      <Shell>
        <Badge tone={approved ? "ok" : "neutral"}>{approved ? "Confirmed" : "Declined"}</Badge>
        <h1 className="mt-3 font-display text-[24px] text-ink">You have already answered this</h1>
        <p className="mt-3 text-[14px] leading-6 text-muted">
          You {approved ? "confirmed" : "declined"} the request from {studentName}
          {context.reference.respondedAt ? ` on ${formatDate(context.reference.respondedAt)}` : ""}. Nothing further is
          needed, and this link cannot be used again.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="font-display text-[24px] text-ink" style={{ letterSpacing: "-0.3px" }}>
        {studentName} listed you as a reference
      </h1>

      <dl className="mt-5 grid gap-2.5 rounded-[10px] border border-line bg-shell px-4 py-3.5 text-[13.5px]">
        <div className="flex justify-between gap-4">
          <dt className="text-subtle">Applicant</dt>
          <dd className="text-right text-ink">
            {studentName}
            {context.studentProgram ? `, ${context.studentProgram}` : ""}
            {context.studentYearLevel ? ` (year ${context.studentYearLevel})` : ""}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-subtle">Position</dt>
          <dd className="text-right text-ink">{context.opportunityTitle}</dd>
        </div>
        {researcherName ? (
          <div className="flex justify-between gap-4">
            <dt className="text-subtle">Supervisor</dt>
            <dd className="text-right text-ink">{researcherName}</dd>
          </div>
        ) : null}
        {context.reference.relationship ? (
          <div className="flex justify-between gap-4">
            <dt className="text-subtle">Stated relationship</dt>
            <dd className="text-right text-ink">{context.reference.relationship}</dd>
          </div>
        ) : null}
      </dl>

      <p className="mt-5 text-[14px] leading-6 text-muted">
        Do you confirm that you know {studentName} and are willing to be named as a reference on this application? If
        you do not know them, decline and we will record that.
      </p>

      <ReferenceForm token={token} />
    </Shell>
  );
}
