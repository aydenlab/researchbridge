"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  applications,
  applicationStatusHistory,
  db,
  notifications,
  placementOutcomes,
  researcherApplicationNotes,
  users,
} from "@/db";
import { requireResearcher, canManageOpportunity } from "@/lib/auth/permissions";
import { optionalText, toActionError } from "@/lib/action-utils";
import { runApplicationAnalysis } from "@/lib/ai/application-analysis";
import { canTransition, STATUS_LABELS, type ApplicationStatus } from "@/lib/application-status";
import { evaluateDeterministic } from "@/lib/criteria/engine";
import type { ActionResult } from "@/lib/errors";
import { recordAudit, recordEvent } from "@/lib/events";
import { PAID_COMPENSATION } from "@/lib/labels";
import { log } from "@/lib/log";
import { sendApplicationAccepted, sendResearcherContact, sendStatusChange } from "@/lib/email";
import { loadApplication, loadCriteria, persistCriterionResults } from "@/lib/queries/applications";
import { loadStudentProfile, toApplicantEvidence } from "@/lib/queries/student";

async function guard(applicationId: string) {
  const user = await requireResearcher();
  const bundle = await loadApplication(applicationId);
  if (!bundle) return { error: "That application could not be found.", user: null, bundle: null };
  const allowed = await canManageOpportunity(user, bundle.opportunity.id);
  if (!allowed) {
    log.warn("authorization_denied", { action: "review_application", userId: user.id, applicationId });
    return { error: "You do not have access to this application.", user: null, bundle: null };
  }
  return { error: null, user, bundle };
}

/**
 * Accepts a student onto a position. This is what the platform counts as an
 * acceptance, so it is the only route to that status: the student is told, here
 * and by email, and the record of who was accepted is written once.
 */
export async function acceptApplicantAction(_prev: ActionResult | null, formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  const message = optionalText(formData, "message")?.slice(0, 1500) ?? null;

  const { error, user, bundle } = await guard(applicationId);
  if (error || !user || !bundle) return { ok: false as const, error: error ?? "Not found." };

  const current = bundle.application.status as ApplicationStatus;
  if (!canTransition(current, "accepted", "researcher")) {
    return {
      ok: false as const,
      error: `An application at ${STATUS_LABELS[current].toLowerCase()} cannot be accepted.`,
    };
  }

  try {
    const now = new Date();
    const researcherName = `${bundle.researcher.firstName} ${bundle.researcher.lastName}`;

    const moved = await db.transaction(async (tx) => {
      // Conditional on the status just checked, so a double click or a second tab
      // cannot record, and email, the same acceptance twice.
      const updated = await tx
        .update(applications)
        .set({
          status: "accepted",
          acceptedAt: bundle.application.acceptedAt ?? now,
          acceptedBy: user.id,
          acceptanceMessage: message,
          reviewedAt: bundle.application.reviewedAt ?? now,
          updatedAt: now,
        })
        .where(and(eq(applications.id, applicationId), eq(applications.status, current)))
        .returning({ id: applications.id });
      if (updated.length === 0) return false;

      await tx.insert(applicationStatusHistory).values({
        applicationId,
        previousStatus: current,
        newStatus: "accepted",
        changedBy: user.id,
      });
      await tx.insert(notifications).values({
        userId: bundle.application.studentId,
        type: "application_accepted",
        title: `You have been accepted: ${bundle.opportunity.title}`,
        body: `${researcherName} accepted your application.`,
        link: `/applications/${applicationId}`,
      });
      return true;
    });

    if (!moved) {
      return { ok: false as const, error: "This application has just changed. Reload the page and check where it stands." };
    }

    await recordAudit({
      actorId: user.id,
      action: "application_accepted",
      subjectType: "application",
      subjectId: applicationId,
      detail: { from: current, studentId: bundle.application.studentId },
    });
    await recordEvent({
      name: "application_accepted",
      userId: user.id,
      institutionId: bundle.opportunity.institutionId,
      subjectType: "application",
      subjectId: applicationId,
      properties: { status: "accepted", from: current },
    });

    const researcherEmailRows = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, bundle.opportunity.researcherId))
      .limit(1);
    // The acceptance has happened by this point and the student can see it, so an
    // email failure is logged by the provider layer rather than reported as if it had not.
    await sendApplicationAccepted({
      to: bundle.studentEmail,
      applicationId,
      projectTitle: bundle.opportunity.title,
      researcherName,
      researcherEmail: researcherEmailRows[0]?.email ?? null,
      message,
    }).catch((caught) => log.error("acceptance_email_failed", { applicationId, error: caught }));

    revalidatePath(`/researcher/opportunities/${bundle.opportunity.id}/applicants`, "layout");
    revalidatePath("/researcher/applicants");
    revalidatePath(`/applications/${applicationId}`);
    revalidatePath("/applications");
    return { ok: true as const, data: undefined, message: "Accepted. The student has been notified." };
  } catch (caught) {
    return toActionError(caught, "accept_applicant_failed");
  }
}

export async function updateApplicationStatusAction(_prev: ActionResult | null, formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  const next = String(formData.get("status") ?? "") as ApplicationStatus;

  // One path to an acceptance, so nothing can reach the status without its record.
  if (next === "accepted") return acceptApplicantAction(_prev, formData);

  const { error, user, bundle } = await guard(applicationId);
  if (error || !user || !bundle) return { ok: false as const, error: error ?? "Not found." };

  const current = bundle.application.status as ApplicationStatus;
  // What the page showed when the button was pressed. A tab left open from before
  // an acceptance must not reject a student the researcher has since accepted.
  const expected = formData.get("expectedStatus");
  if (expected && expected !== current) {
    return { ok: false as const, error: "This application has just changed. Reload the page and check where it stands." };
  }
  if (!canTransition(current, next, "researcher")) {
    return {
      ok: false as const,
      error: `An application at ${STATUS_LABELS[current].toLowerCase()} cannot move to ${STATUS_LABELS[next]?.toLowerCase() ?? "that state"}.`,
    };
  }

  try {
    const now = new Date();
    const moved = await db.transaction(async (tx) => {
      const updated = await tx
        .update(applications)
        .set({
          status: next,
          reviewedAt: bundle.application.reviewedAt ?? now,
          updatedAt: now,
        })
        .where(and(eq(applications.id, applicationId), eq(applications.status, current)))
        .returning({ id: applications.id });
      if (updated.length === 0) return false;

      await tx.insert(applicationStatusHistory).values({
        applicationId,
        previousStatus: current,
        newStatus: next,
        changedBy: user.id,
        reason: optionalText(formData, "reason"),
      });

      await tx.insert(notifications).values({
        userId: bundle.application.studentId,
        type: "application_status_changed",
        title: `Your application is now ${STATUS_LABELS[next].toLowerCase()}`,
        body: `${bundle.opportunity.title}.`,
        link: `/applications/${applicationId}`,
      });
      return true;
    });
    if (!moved) {
      return { ok: false as const, error: "This application has just changed. Reload the page and check where it stands." };
    }

    await recordAudit({
      actorId: user.id,
      action: "application_status_changed",
      subjectType: "application",
      subjectId: applicationId,
      detail: { from: current, to: next },
    });
    await recordEvent({
      name: "application_reviewed",
      userId: user.id,
      institutionId: bundle.opportunity.institutionId,
      subjectType: "application",
      subjectId: applicationId,
      properties: { status: next },
    });

    await sendStatusChange(bundle.studentEmail, bundle.opportunity.title, STATUS_LABELS[next].toLowerCase());

    revalidatePath(`/researcher/opportunities/${bundle.opportunity.id}/applicants`, "layout");
    return { ok: true as const, data: undefined, message: `Marked ${STATUS_LABELS[next].toLowerCase()}` };
  } catch (caught) {
    return toActionError(caught, "update_application_status_failed");
  }
}

export async function addNoteAction(_prev: ActionResult | null, formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  const note = optionalText(formData, "note");

  const { error, user, bundle } = await guard(applicationId);
  if (error || !user || !bundle) return { ok: false as const, error: error ?? "Not found." };
  if (!note) return { ok: false as const, error: "Write something before saving the note." };

  try {
    await db.insert(researcherApplicationNotes).values({
      applicationId,
      researcherId: user.id,
      note: note.slice(0, 4000),
    });
    revalidatePath(`/researcher/opportunities/${bundle.opportunity.id}/applicants/${applicationId}`);
    return { ok: true as const, data: undefined, message: "Note saved" };
  } catch (caught) {
    return toActionError(caught, "add_note_failed");
  }
}

export async function deleteNoteAction(_prev: ActionResult | null, formData: FormData) {
  const noteId = String(formData.get("noteId") ?? "");
  const applicationId = String(formData.get("applicationId") ?? "");

  const { error, user, bundle } = await guard(applicationId);
  if (error || !user || !bundle) return { ok: false as const, error: error ?? "Not found." };

  try {
    await db
      .delete(researcherApplicationNotes)
      .where(and(eq(researcherApplicationNotes.id, noteId), eq(researcherApplicationNotes.researcherId, user.id)));
    revalidatePath(`/researcher/opportunities/${bundle.opportunity.id}/applicants/${applicationId}`);
    return { ok: true as const, data: undefined, message: "Note removed" };
  } catch (caught) {
    return toActionError(caught, "delete_note_failed");
  }
}

export async function contactStudentAction(_prev: ActionResult | null, formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  const message = optionalText(formData, "message");

  const { error, user, bundle } = await guard(applicationId);
  if (error || !user || !bundle) return { ok: false as const, error: error ?? "Not found." };

  const current = bundle.application.status as ApplicationStatus;
  if (!canTransition(current, "researcher_contacted", "researcher")) {
    return { ok: false as const, error: "This application cannot move to contacted from its current state." };
  }

  try {
    const now = new Date();
    const moved = await db.transaction(async (tx) => {
      const updated = await tx
        .update(applications)
        .set({ status: "researcher_contacted", contactedAt: now, reviewedAt: bundle.application.reviewedAt ?? now, updatedAt: now })
        .where(and(eq(applications.id, applicationId), eq(applications.status, current)))
        .returning({ id: applications.id });
      if (updated.length === 0) return false;

      await tx.insert(applicationStatusHistory).values({
        applicationId,
        previousStatus: current,
        newStatus: "researcher_contacted",
        changedBy: user.id,
      });

      await tx.insert(notifications).values({
        userId: bundle.application.studentId,
        type: "researcher_contacted",
        title: `${bundle.researcher.firstName} ${bundle.researcher.lastName} would like to speak with you`,
        body: `About ${bundle.opportunity.title}.`,
        link: `/applications/${applicationId}`,
      });
      return true;
    });
    if (!moved) {
      return { ok: false as const, error: "This application has just changed. Reload the page and check where it stands." };
    }

    const researcherEmailRows = await db.select({ email: users.email }).from(users).where(eq(users.id, user.id)).limit(1);

    await sendResearcherContact(
      bundle.studentEmail,
      bundle.opportunity.title,
      `${bundle.researcher.firstName} ${bundle.researcher.lastName}`,
      researcherEmailRows[0]?.email ?? "hello@myresearchbridge.com",
      message ?? "They would like to arrange a time to talk about the project.",
    );

    await recordEvent({
      name: "researcher_contacted_student",
      userId: user.id,
      institutionId: bundle.opportunity.institutionId,
      subjectType: "application",
      subjectId: applicationId,
    });
    await recordAudit({
      actorId: user.id,
      action: "researcher_contacted_student",
      subjectType: "application",
      subjectId: applicationId,
      detail: { studentId: bundle.application.studentId },
    });

    revalidatePath(`/researcher/opportunities/${bundle.opportunity.id}/applicants/${applicationId}`);
    return { ok: true as const, data: undefined, message: "The student has been notified and can reply to your email." };
  } catch (caught) {
    return toActionError(caught, "contact_student_failed");
  }
}

export async function refreshEvidenceAction(_prev: ActionResult | null, formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  const { error, user, bundle } = await guard(applicationId);
  if (error || !user || !bundle) return { ok: false as const, error: error ?? "Not found." };

  try {
    const profile = await loadStudentProfile(bundle.application.studentId);
    if (!profile) return { ok: false as const, error: "This student's profile is no longer available." };

    const answersByQuestion = new Map(bundle.answers.map((answer) => [answer.questionId, answer]));
    const answers = bundle.questions.map((question) => ({
      questionId: question.id,
      prompt: question.prompt,
      text: answersByQuestion.get(question.id)?.textAnswer ?? null,
    }));

    const criteria = await loadCriteria(bundle.opportunity.id);
    const evidence = toApplicantEvidence(profile, answers);

    await persistCriterionResults(applicationId, evaluateDeterministic(criteria, evidence));

    const result = await runApplicationAnalysis({
      applicationId,
      criteria,
      evidence,
      projectTitle: bundle.opportunity.title,
      projectSummary: bundle.opportunity.summary,
      isPaidPosition: PAID_COMPENSATION.has(bundle.opportunity.compensationType),
      force: true,
    });

    revalidatePath(`/researcher/opportunities/${bundle.opportunity.id}/applicants/${applicationId}`);

    if (result.state === "ready") return { ok: true as const, data: undefined, message: "Evidence refreshed" };
    if (result.state === "disabled") {
      return { ok: true as const, data: undefined, message: "Criteria re-evaluated. Written-response analysis is switched off for this pilot." };
    }
    return {
      ok: true as const,
      data: undefined,
      message: "Criteria re-evaluated. Written-response analysis is unavailable right now and will be retried later.",
    };
  } catch (caught) {
    return toActionError(caught, "refresh_evidence_failed");
  }
}

export async function recordPlacementAction(_prev: ActionResult | null, formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  const outcome = String(formData.get("outcome") ?? "");

  const { error, user, bundle } = await guard(applicationId);
  if (error || !user || !bundle) return { ok: false as const, error: error ?? "Not found." };
  if (!["yes", "no", "in_progress", "prefer_not_to_say"].includes(outcome)) {
    return { ok: false as const, error: "Choose one of the listed answers." };
  }

  try {
    await db
      .insert(placementOutcomes)
      .values({
        applicationId,
        researcherReportedOutcome: outcome as "yes" | "no" | "in_progress" | "prefer_not_to_say",
        researcherWouldUseAgain: formData.get("wouldUseAgain") === "true" ? true : null,
        confirmed: outcome === "yes",
        positionType: bundle.opportunity.compensationType,
      })
      .onConflictDoUpdate({
        target: placementOutcomes.applicationId,
        set: {
          researcherReportedOutcome: outcome as "yes" | "no" | "in_progress" | "prefer_not_to_say",
          researcherWouldUseAgain: formData.get("wouldUseAgain") === "true" ? true : null,
          confirmed: outcome === "yes",
          updatedAt: new Date(),
        },
      });

    if (outcome === "yes") {
      await recordEvent({
        name: "placement_confirmed",
        userId: user.id,
        institutionId: bundle.opportunity.institutionId,
        subjectType: "application",
        subjectId: applicationId,
        properties: { reportedBy: "researcher" },
      });
    }

    revalidatePath(`/researcher/opportunities/${bundle.opportunity.id}/applicants/${applicationId}`);
    return { ok: true as const, data: undefined, message: "Recorded. Thank you." };
  } catch (caught) {
    return toActionError(caught, "record_placement_failed");
  }
}
