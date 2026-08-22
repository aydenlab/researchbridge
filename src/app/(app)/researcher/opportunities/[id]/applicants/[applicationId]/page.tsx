import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { db, placementOutcomes } from "@/db";
import { CriteriaEvidence, type AiState } from "@/components/app/criteria-evidence";
import { StatusPill } from "@/components/app/status-pill";
import { Badge, Tag } from "@/components/ui/badge";
import { canManageOpportunity, requireApprovedResearcher } from "@/lib/auth/permissions";
import { loadStoredAnalysis, analysisToCriterionResults, type AnalysisState } from "@/lib/ai/application-analysis";
import { allowedTransitions, STATUS_LABELS, type ApplicationStatus } from "@/lib/application-status";
import { summarizeAlignment } from "@/lib/criteria/weights";
import type { CriterionResult } from "@/lib/criteria/types";
import { formatDate, formatMonth, formatShortDate } from "@/lib/format";
import { formatMetric } from "@/lib/gpa";
import { markApplicationOpenedAction } from "@/app/(app)/applications/actions";
import {
  COURSE_STATUS_LABELS,
  DEGREE_LABELS,
  LOCATION_LABELS,
  PAID_COMPENSATION,
  PROFICIENCY_LABELS,
  QUESTION_TYPE_LABELS,
  labelOr,
} from "@/lib/labels";
import { listApplicantsForOpportunity, loadApplication, loadCriteria, loadCriterionResults, listResearcherNotes } from "@/lib/queries/applications";
import { loadStudentProfile, toAcademicMetrics } from "@/lib/queries/student";
import { ContactControl, NotesPanel, PlacementForm, RefreshEvidence, StatusActions } from "./review-controls";

export const metadata: Metadata = {
  title: "Candidate review",
  robots: { index: false, follow: false },
};

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[12px] border border-line bg-white">
      <div className="border-b border-line px-5 py-3.5">
        <h2 className="font-display text-[17px] text-ink">{title}</h2>
        {subtitle ? <p className="mt-1 text-[12px] leading-5 text-muted">{subtitle}</p> : null}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

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
  const user = await requireApprovedResearcher();
  if (!(await canManageOpportunity(user, id))) notFound();

  const bundle = await loadApplication(applicationId);
  if (!bundle || bundle.opportunity.id !== id) notFound();

  if (bundle.application.status === "submitted") {
    await markApplicationOpenedAction(applicationId, user.id);
  }

  const [profile, criteria, storedResults, notes, analysisState, applicants, outcomeRows] = await Promise.all([
    loadStudentProfile(bundle.application.studentId),
    loadCriteria(id),
    loadCriterionResults(applicationId),
    listResearcherNotes(applicationId),
    loadStoredAnalysis(applicationId),
    listApplicantsForOpportunity(id),
    db.select().from(placementOutcomes).where(eq(placementOutcomes.applicationId, applicationId)).limit(1),
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

  const summary = summarizeAlignment(criteria, [...scoringResults.values()]);
  const status = (bundle.application.status === "submitted" ? "under_review" : bundle.application.status) as ApplicationStatus;
  const isPaid = PAID_COMPENSATION.has(bundle.opportunity.compensationType);
  const outcome = outcomeRows[0] ?? null;

  const index = applicants.findIndex((applicant) => applicant.id === applicationId);
  const previous = index > 0 ? applicants[index - 1] : null;
  const next = index >= 0 && index < applicants.length - 1 ? applicants[index + 1] : null;

  const answersByQuestion = new Map(bundle.answers.map((answer) => [answer.questionId, answer]));
  const metrics = profile ? toAcademicMetrics(profile.academicRecords) : [];
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
            <p className="mt-0.5 text-[12.5px] text-subtle">
              Submitted {formatDate(bundle.application.submittedAt)}. Profile is{" "}
              {bundle.student.profileCompletion} percent complete.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
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
            summary={summary}
            aiState={aiStateFor(analysisState)}
            isPaidPosition={isPaid}
            refreshControl={<RefreshEvidence applicationId={applicationId} />}
          />

          <Panel title="Application responses" subtitle="Written for this project, in the order you asked for them.">
            {bundle.questions.length === 0 ? (
              <p className="text-[13.5px] leading-6 text-muted">
                This position asked only for the student profile, so there are no written responses.
              </p>
            ) : (
              <ol className="flex flex-col gap-5">
                {bundle.questions.map((question, position) => {
                  const answer = answersByQuestion.get(question.id);
                  const external = (answer?.structuredAnswer as { externalUrl?: string } | null)?.externalUrl;
                  return (
                    <li key={question.id} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
                      <p className="text-[14px] leading-6 text-ink">
                        <span className="mr-2 font-mono text-[12px] text-subtle">{String(position + 1).padStart(2, "0")}</span>
                        {question.prompt}
                      </p>
                      <p className="mt-1 pl-8 text-[11.5px] text-subtle">
                        {labelOr(QUESTION_TYPE_LABELS, question.type)}
                      </p>
                      <div className="mt-2 pl-8">
                        {answer?.textAnswer ? (
                          <div className="rb-measure whitespace-pre-wrap rounded-[8px] border border-line bg-shell/60 px-3.5 py-3 text-[14px] leading-7 text-muted">
                            {answer.textAnswer}
                          </div>
                        ) : external ? (
                          <a
                            href={external}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13.5px] text-forest underline decoration-line-strong underline-offset-4"
                          >
                            Open the response the student shared
                          </a>
                        ) : answer?.fileId ? (
                          <a
                            href={`/api/files/by-id/${answer.fileId}`}
                            className="inline-flex items-center gap-1.5 text-[13.5px] text-forest underline decoration-line-strong underline-offset-4"
                          >
                            <FileText className="size-3.5" aria-hidden="true" />
                            Open the attached file
                          </a>
                        ) : (
                          <p className="text-[13.5px] text-subtle">No answer submitted.</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>

          <Panel title="Student profile" subtitle="Filled in by the student and included with this application.">
            {profile ? (
              <div className="flex flex-col gap-5">
                <div>
                  <p className="text-[12px] font-medium text-subtle">Availability</p>
                  <p className="mt-1.5 text-[14px] leading-6 text-ink">
                    {profile.profile.weeklyHours !== null ? `${profile.profile.weeklyHours} hours per week` : "Not stated"}{" "}
                    {labelOr(LOCATION_LABELS, profile.profile.locationPreference)}, From{" "}
                    {formatDate(profile.profile.desiredStartDate)}
                  </p>
                  {profile.profile.scheduleNotes ? (
                    <p className="mt-1 text-[13px] leading-6 text-muted">{profile.profile.scheduleNotes}</p>
                  ) : null}
                </div>

                <div className="border-t border-line pt-4">
                  <p className="text-[12px] font-medium text-subtle">Research interests</p>
                  {profile.fields.length === 0 ? (
                    <p className="mt-1.5 text-[13.5px] text-muted">None listed.</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {profile.fields.map((field) => (
                        <Tag key={field.id}>{field.name}</Tag>
                      ))}
                    </div>
                  )}
                  {profile.profile.researchInterestSummary ? (
                    <p className="rb-measure mt-2.5 text-[14px] leading-7 text-muted">
                      {profile.profile.researchInterestSummary}
                    </p>
                  ) : null}
                </div>

                <div className="border-t border-line pt-4">
                  <p className="text-[12px] font-medium text-subtle">Relevant coursework</p>
                  {profile.courses.length === 0 ? (
                    <p className="mt-1.5 text-[13.5px] text-muted">None listed.</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {profile.courses.map((course) => (
                        <Tag key={course.id}>
                          {course.courseCode} {course.courseName}
                          {course.status !== "completed" ? ` (${labelOr(COURSE_STATUS_LABELS, course.status).toLowerCase()})` : ""}
                        </Tag>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-line pt-4">
                  <p className="text-[12px] font-medium text-subtle">Skills</p>
                  {profile.skills.length === 0 ? (
                    <p className="mt-1.5 text-[13.5px] text-muted">None listed.</p>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {profile.skills.map((skill) => (
                        <li key={skill.id} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                          <span className="text-[13.5px] font-medium text-ink">{skill.name}</span>
                          {skill.proficiency ? (
                            <span className="text-[12px] text-muted">{labelOr(PROFICIENCY_LABELS, skill.proficiency)}</span>
                          ) : null}
                          {skill.context ? <span className="text-[12.5px] text-muted">{skill.context}</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="border-t border-line pt-4">
                  <p className="text-[12px] font-medium text-subtle">Research experience</p>
                  {profile.experiences.length === 0 ? (
                    <p className="mt-1.5 text-[13.5px] leading-6 text-muted">
                      None listed. This position states that prior research is{" "}
                      {bundle.opportunity.priorResearchRequired ? "required" : "not required"}.
                    </p>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-4">
                      {profile.experiences.map((experience) => (
                        <li key={experience.id}>
                          <p className="text-[14px] font-medium text-ink">
                            {experience.title ?? "Research role"} at {experience.organization}
                          </p>
                          <p className="mt-0.5 text-[12px] text-subtle">
                            {formatMonth(experience.startDate)} to {formatMonth(experience.endDate)}
                            {experience.supervisor ? `, supervised by ${experience.supervisor}` : ""}
                          </p>
                          {experience.description ? (
                            <p className="rb-measure mt-1.5 text-[13.5px] leading-6 text-muted">{experience.description}</p>
                          ) : null}
                          {(experience.techniques ?? []).length > 0 ? (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {(experience.techniques ?? []).map((technique) => (
                                <Tag key={technique}>{technique}</Tag>
                              ))}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="border-t border-line pt-4">
                  <p className="text-[12px] font-medium text-subtle">Academic standing</p>
                  {metrics.length === 0 ? (
                    <p className="mt-1.5 text-[13.5px] leading-6 text-muted">
                      Not shared. Sharing an average is optional on ResearchBridge.
                    </p>
                  ) : (
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {metrics.map((metric, position) => (
                        <li key={position} className="text-[14px] text-ink">
                          {profile.academicRecords[position]?.label ?? "Average"}: {formatMetric(metric)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="border-t border-line pt-4">
                  <p className="text-[12px] font-medium text-subtle">Resume</p>
                  {profile.profile.resumeFileId ? (
                    <a
                      href={`/api/files/by-id/${profile.profile.resumeFileId}`}
                      className="mt-1.5 inline-flex items-center gap-1.5 text-[13.5px] text-forest underline decoration-line-strong underline-offset-4"
                    >
                      <FileText className="size-3.5" aria-hidden="true" />
                      Open the resume
                    </a>
                  ) : (
                    <p className="mt-1.5 text-[13.5px] text-muted">Not uploaded.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-[13.5px] leading-6 text-muted">
                This student's profile is no longer available. The snapshot taken at submission is preserved with the
                application record.
              </p>
            )}
          </Panel>
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
