import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db, placementOutcomes } from "@/db";
import { ApplicationDetail } from "@/components/app/application-detail";
import { CriteriaEvidence, type AiState } from "@/components/app/criteria-evidence";
import { StatusPill } from "@/components/app/status-pill";
import { Badge } from "@/components/ui/badge";
import { canManageOpportunity, requireResearcher } from "@/lib/auth/permissions";
import { loadStoredAnalysis, analysisToCriterionResults, type AnalysisState } from "@/lib/ai/application-analysis";
import { allowedTransitions, STATUS_LABELS, type ApplicationStatus } from "@/lib/application-status";
import { applicantFit, FIT_BAND_LABEL } from "@/lib/criteria/fit";
import type { CriterionResult } from "@/lib/criteria/types";
import { scoreMatch } from "@/lib/matching";
import { formatDate, formatShortDate } from "@/lib/format";
import { markApplicationOpenedAction } from "@/app/(app)/applications/actions";
import { COURSE_TYPE_LABELS, DEGREE_LABELS, PAID_COMPENSATION, labelOr } from "@/lib/labels";
import { listApplicantsForOpportunity, loadApplication, loadCriteria, loadCriterionResults, listResearcherNotes } from "@/lib/queries/applications";
import { loadOpportunityMatchInput } from "@/lib/queries/fit";
import { studentMatchInput } from "@/lib/queries/recommendations";
import { loadStudentProfile } from "@/lib/queries/student";
import { listConfirmedProfileReferences, listReferences } from "@/lib/queries/references";
import { ContactControl, NotesPanel, PlacementForm, RefreshEvidence, StatusActions } from "./review-controls";

export const metadata: Metadata = {
  title: "Candidate review",
  robots: { index: false, follow: false },
};

const REPORTABLE_REASONS = new Set<AiState>([
  "missing_api_key",
  "invalid_api_key",
  "throttled",
  "budget_exceeded",
  "provider_unavailable",
]);

/** Tells the reviewer why analysis is missing when the reason is one they can act on. */
function aiStateFor(state: AnalysisState): AiState {
  if (state.state !== "unavailable") return state.state;
  return REPORTABLE_REASONS.has(state.reason as AiState) ? (state.reason as AiState) : "unavailable";
}

export default async function CandidateReviewPage({
  params,
}: {
  params: Promise<{ id: string; applicationId: string }>;
}) {
  const { id, applicationId } = await params;
  const user = await requireResearcher();
  if (!(await canManageOpportunity(user, id))) notFound();

  const bundle = await loadApplication(applicationId);
  if (!bundle || bundle.opportunity.id !== id) notFound();

  if (bundle.application.status === "submitted") {
    await markApplicationOpenedAction(applicationId, user.id);
  }

  const [profile, criteria, storedResults, notes, analysisState, applicants, outcomeRows, references, profileReferences, matchInput] = await Promise.all([
    loadStudentProfile(bundle.application.studentId),
    loadCriteria(id),
    loadCriterionResults(applicationId),
    listResearcherNotes(applicationId),
    loadStoredAnalysis(applicationId),
    listApplicantsForOpportunity(id),
    db.select().from(placementOutcomes).where(eq(placementOutcomes.applicationId, applicationId)).limit(1),
    listReferences(applicationId),
    listConfirmedProfileReferences(bundle.application.studentId),
    loadOpportunityMatchInput(id),
  ]);

  const aiResults: CriterionResult[] =
    analysisState.state === "ready" ? analysisToCriterionResults(criteria, analysisState.analysis) : [];

  const combined: CriterionResult[] = [
    ...storedResults.filter((result) => result.source !== "ai_assisted"),
    ...aiResults,
  ];

  const scoringResults = new Map<string, CriterionResult>();
  for (const result of combined) {
    const existing = scoringResults.get(result.criterionId);
    if (!existing || (existing.status === "unknown" && result.status !== "unknown")) {
      scoringResults.set(result.criterionId, result);
    }
  }

  // The profile match is what guarantees a figure when no criterion could be
  // judged, so it is computed for every applicant rather than as a last resort.
  const match = profile && matchInput ? scoreMatch(studentMatchInput(profile), matchInput) : null;
  const fit = applicantFit(criteria, [...scoringResults.values()], match);
  const status = (bundle.application.status === "submitted" ? "under_review" : bundle.application.status) as ApplicationStatus;
  const isPaid = PAID_COMPENSATION.has(bundle.opportunity.compensationType);
  const outcome = outcomeRows[0] ?? null;

  const index = applicants.findIndex((applicant) => applicant.id === applicationId);
  const previous = index > 0 ? applicants[index - 1] : null;
  const next = index >= 0 && index < applicants.length - 1 ? applicants[index + 1] : null;

  const displayName = `${bundle.student.preferredName ?? bundle.student.firstName} ${bundle.student.lastName}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/researcher/opportunities/${id}/applicants`}
          className="text-[13px] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink xl:hidden"
        >
          Back to the applicant list
        </Link>
        <nav aria-label="Applicant navigation" className="ml-auto flex items-center gap-2">
          {previous ? (
            <Link
              href={`/researcher/opportunities/${id}/applicants/${previous.id}`}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-line-strong bg-white px-3 text-[12.5px] text-ink hover:bg-shell"
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
              Previous
            </Link>
          ) : null}
          <span className="text-[12.5px] text-muted">
            {index + 1} of {applicants.length}
          </span>
          {next ? (
            <Link
              href={`/researcher/opportunities/${id}/applicants/${next.id}`}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-line-strong bg-white px-3 text-[12.5px] text-ink hover:bg-shell"
            >
              Next
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null}
        </nav>
      </div>

      <header className="rounded-[12px] border border-line bg-white px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="font-display text-[26px] leading-tight text-ink" style={{ letterSpacing: "-0.5px" }}>
              {displayName}
            </h1>
            <p className="mt-1 text-[13.5px] text-muted">
              {bundle.student.program ?? "Program not set"}
              {bundle.student.yearLevel ? `, year ${bundle.student.yearLevel}` : ""}
              {`, ${labelOr(DEGREE_LABELS, bundle.student.degreeLevel).toLowerCase()}`}
            </p>
            {bundle.application.courseType ? (
              <p className="mt-1 text-[12.5px] text-forest">
                Applying as: {labelOr(COURSE_TYPE_LABELS, bundle.application.courseType)}
              </p>
            ) : null}
            <p className="mt-0.5 text-[12.5px] text-subtle">
              Submitted {formatDate(bundle.application.submittedAt)}. Profile is{" "}
              {bundle.student.profileCompletion} percent complete.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-[11.5px] text-subtle">Fit</p>
              <p className="font-display text-[26px] leading-none text-ink">{fit.percent}%</p>
              <p className="mt-1 text-[11.5px] text-muted">{FIT_BAND_LABEL[fit.band]}</p>
            </div>
            <StatusPill status={status} />
            {outcome?.confirmed ? <Badge tone="ok">Placement confirmed</Badge> : null}
          </div>
        </div>
      </header>

      <div className="grid gap-5 2xl:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <CriteriaEvidence
            criteria={criteria}
            results={combined}
            fit={fit}
            aiState={aiStateFor(analysisState)}
            isPaidPosition={isPaid}
            refreshControl={<RefreshEvidence applicationId={applicationId} />}
          />

          <ApplicationDetail bundle={bundle} profile={profile} />
        </div>

        <aside className="flex flex-col gap-5">
          <section className="rounded-[12px] border border-line bg-white">
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="font-display text-[17px] text-ink">Move this application</h2>
            </div>
            <div className="flex flex-col gap-4 px-5 py-4">
              <StatusActions
                applicationId={applicationId}
                currentStatus={status}
                allowed={allowedTransitions(status, "researcher")}
              />
              <div className="border-t border-line pt-4">
                <ContactControl applicationId={applicationId} alreadyContacted={Boolean(bundle.application.contactedAt)} />
              </div>
            </div>
          </section>

          <section className="rounded-[12px] border border-line bg-white">
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="font-display text-[17px] text-ink">References</h2>
            </div>
            <div className="px-5 py-4">
              {references.length === 0 && profileReferences.length === 0 ? (
                <p className="text-[12.5px] leading-5 text-subtle">This applicant did not name a reference.</p>
              ) : null}
              {references.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {references.map((reference) => (
                    <li key={reference.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] text-ink">{reference.refereeName || reference.refereeEmail}</p>
                        <p className="mt-0.5 text-[12px] text-subtle">
                          {reference.relationship || "Relationship not given"}
                        </p>
                      </div>
                      <Badge tone={reference.status === "approved" ? "ok" : reference.status === "declined" ? "bad" : "warn"}>
                        {reference.status === "approved" ? "Confirmed" : reference.status === "declined" ? "Declined" : "Unconfirmed"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
              {profileReferences.length > 0 ? (
                <div className="mt-3 border-t border-line pt-3">
                  <p className="text-[12px] text-subtle">On their profile, confirmed</p>
                  <ul className="mt-2 flex flex-col gap-2.5">
                    {profileReferences.map((reference) => (
                      <li key={reference.id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] text-ink">{reference.refereeName || reference.refereeEmail}</p>
                          <p className="mt-0.5 text-[12px] text-subtle">{reference.relationship || "Relationship not given"}</p>
                        </div>
                        <Badge tone="ok">Confirmed</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="mt-3 border-t border-line pt-3 text-[12px] leading-5 text-subtle">
                Only a confirmed reference means the named person replied and agreed. Treat anything else as unverified.
              </p>
            </div>
          </section>
          <NotesPanel
            applicationId={applicationId}
            notes={notes.map((note) => ({ id: note.id, note: note.note, createdAt: note.createdAt }))}
          />

          <section className="rounded-[12px] border border-line bg-white">
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="font-display text-[17px] text-ink">History</h2>
            </div>
            <ol className="flex flex-col gap-2.5 px-5 py-4">
              {bundle.history.map((entry) => (
                <li key={entry.id} className="text-[12.5px] leading-5">
                  <p className="font-medium text-ink">{STATUS_LABELS[entry.newStatus as ApplicationStatus]}</p>
                  <p className="text-subtle">{formatShortDate(entry.createdAt)}</p>
                </li>
              ))}
            </ol>
          </section>

          {["accepted", "researcher_contacted", "interview"].includes(status) ? (
            <section className="rounded-[12px] border border-line bg-white">
              <div className="border-b border-line px-5 py-3.5">
                <h2 className="font-display text-[17px] text-ink">Pilot outcome</h2>
                <p className="mt-1 text-[12px] leading-5 text-muted">Asked once. It is the measure the pilot cares about.</p>
              </div>
              <div className="px-5 py-4">
                <PlacementForm applicationId={applicationId} recorded={outcome?.researcherReportedOutcome ?? null} />
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
