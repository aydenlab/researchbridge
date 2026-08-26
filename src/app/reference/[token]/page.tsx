import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { resolveReferenceToken } from "@/lib/queries/references";
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

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-subtle">{term}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </div>
  );
}

export default async function ReferencePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reference = await resolveReferenceToken(token);

  if (!reference) {
    return (
      <Shell>
        <h1 className="font-display text-[24px] text-ink">This link is not valid</h1>
        <p className="mt-3 text-[14px] leading-6 text-muted">
          It may have been mistyped, or the person may have removed the request. Ask them to send a new one.
        </p>
      </Shell>
    );
  }

  if (reference.status !== "pending") {
    const approved = reference.status === "approved";
    return (
      <Shell>
        <Badge tone={approved ? "ok" : "neutral"}>{approved ? "Confirmed" : "Declined"}</Badge>
        <h1 className="mt-3 font-display text-[24px] text-ink">You have already answered this</h1>
        <p className="mt-3 text-[14px] leading-6 text-muted">
          You {approved ? "confirmed" : "declined"} the request from {reference.subjectName}
          {reference.respondedAt ? ` on ${formatDate(reference.respondedAt)}` : ""}. Nothing further is needed, and
          this link cannot be used again.
        </p>
      </Shell>
    );
  }

  const isProfile = reference.kind === "profile";

  return (
    <Shell>
      <h1 className="font-display text-[24px] text-ink" style={{ letterSpacing: "-0.3px" }}>
        {reference.subjectName} listed you as a reference
      </h1>

      <dl className="mt-5 grid gap-2.5 rounded-[10px] border border-line bg-shell px-4 py-3.5 text-[13.5px]">
        <Row term={isProfile ? "Person" : "Applicant"}>
          {reference.subjectName}
          {reference.subjectDetail ? `, ${reference.subjectDetail}` : ""}
        </Row>
        {reference.kind === "application" ? <Row term="Position">{reference.projectTitle}</Row> : null}
        {reference.kind === "application" && reference.supervisorName ? (
          <Row term="Supervisor">{reference.supervisorName}</Row>
        ) : null}
        <Row term="Applies to">
          {isProfile ? "Their profile, not one application" : "This application only"}
        </Row>
        {reference.relationship ? <Row term="Stated relationship">{reference.relationship}</Row> : null}
      </dl>

      <p className="mt-5 text-[14px] leading-6 text-muted">
        {isProfile
          ? `Do you confirm that you know ${reference.subjectName} and are willing to be named as a reference on their profile? They are asking once rather than for every position, so this stays on their profile until they remove it.`
          : `Do you confirm that you know ${reference.subjectName} and are willing to be named as a reference on this application? If you do not know them, decline and we will record that.`}
      </p>

      <ReferenceForm token={token} />
    </Shell>
  );
}
