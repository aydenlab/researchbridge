"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import {
  applicationAnswers,
  applications,
  applicationSnapshots,
  applicationStatusHistory,
  db,
  notifications,
  opportunities,
  opportunityQuestions,
  studentProfiles,
  users,
} from "@/db";
import { requireStudent } from "@/lib/auth/permissions";
import { optionalText, toActionError } from "@/lib/action-utils";
import { canTransition } from "@/lib/application-status";
import { runApplicationAnalysis } from "@/lib/ai/application-analysis";
import { evaluateDeterministic } from "@/lib/criteria/engine";
import type { ActionResult } from "@/lib/errors";
import { recordAudit, recordEvent } from "@/lib/events";
import { COURSE_TYPE_ORDER, PAID_COMPENSATION, type CourseTypeOption } from "@/lib/labels";
import { log } from "@/lib/log";
import { sendApplicationReceived, sendNewApplicantNotice } from "@/lib/email";
import { loadApplication, loadCriteria, persistCriterionResults } from "@/lib/queries/applications";
import { loadStudentProfile, toApplicantEvidence } from "@/lib/queries/student";
import { storeFile } from "@/lib/storage";

async function requireOwnedDraft(applicationId: string) {
  const user = await requireStudent();
  const bundle = await loadApplication(applicationId);
  if (!bundle || bundle.application.studentId !== user.id) {
    return { error: "That application could not be found." as const, user: null, bundle: null };
  }
  return { error: null, user, bundle };
}

async function persistAnswers(applicationId: string, questions: (typeof opportunityQuestions.$inferSelect)[], formData: FormData, ownerId: string) {
  for (const question of questions) {
    const key = `q_${question.id}`;

    if (question.type === "file_upload") {
      const file = formData.get(key);
      if (file instanceof File && file.size > 0) {
        const stored = await storeFile({ file, purpose: "attachment", ownerId });
        await db
          .insert(applicationAnswers)
          .values({ applicationId, questionId: question.id, fileId: stored.id })
          .onConflictDoUpdate({
            target: [applicationAnswers.applicationId, applicationAnswers.questionId],
            set: { fileId: stored.id, updatedAt: new Date() },
          });
      }
      continue;
    }

    if (question.type === "video_response") {
      const value = optionalText(formData, key);
      await db
        .insert(applicationAnswers)
        .values({ applicationId, questionId: question.id, structuredAnswer: { externalUrl: value } })
        .onConflictDoUpdate({
          target: [applicationAnswers.applicationId, applicationAnswers.questionId],
          set: { structuredAnswer: { externalUrl: value }, updatedAt: new Date() },
        });
      continue;
    }

    const value = optionalText(formData, key);
    await db
      .insert(applicationAnswers)
      .values({ applicationId, questionId: question.id, textAnswer: value })
      .onConflictDoUpdate({
        target: [applicationAnswers.applicationId, applicationAnswers.questionId],
        set: { textAnswer: value, updatedAt: new Date() },
      });
  }
}

/**
 * The course type this application is being made under. Optional, and narrowed
 * to the values researchers filter on, so an unrecognised post body clears it
 * rather than trying to write something the column cannot hold.
 */
function readCourseType(formData: FormData): CourseTypeOption | null {
  const raw = String(formData.get("courseType") ?? "").trim();
  return (COURSE_TYPE_ORDER as readonly string[]).includes(raw) ? (raw as CourseTypeOption) : null;
}

export async function saveDraftAction(_prev: ActionResult | null, formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  const { error, user, bundle } = await requireOwnedDraft(applicationId);
  if (error || !bundle || !user) return { ok: false as const, error: error ?? "That application could not be found." };

  if (bundle.application.status !== "draft") {
    return { ok: false as const, error: "This application has already been submitted and can no longer be edited." };
  }

  try {
    await persistAnswers(applicationId, bundle.questions, formData, user.id);
    await db
      .update(applications)
      .set({ courseType: readCourseType(formData), updatedAt: new Date() })
      .where(eq(applications.id, applicationId));
    revalidatePath(`/applications/${applicationId}/edit`);
    return { ok: true as const, data: undefined, message: "Draft saved" };
  } catch (caught) {
    return toActionError(caught, "save_draft_failed");
  }
}

export async function submitApplicationAction(_prev: ActionResult | null, formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  const { error, user, bundle } = await requireOwnedDraft(applicationId);
  if (error || !bundle || !user) return { ok: false as const, error: error ?? "That application could not be found." };

  if (!canTransition(bundle.application.status, "submitted", "student")) {
    return { ok: false as const, error: "This application has already been submitted." };
  }
  if (bundle.opportunity.status !== "published") {
    return { ok: false as const, error: "This position is no longer accepting applications." };
  }
  if (bundle.opportunity.deadline && new Date(`${bundle.opportunity.deadline}T23:59:59Z`).getTime() < Date.now()) {
    return { ok: false as const, error: "The application deadline for this position has passed." };
  }

  try {
    await persistAnswers(applicationId, bundle.questions, formData, user.id);

    const refreshed = await loadApplication(applicationId);
    if (!refreshed) return { ok: false as const, error: "That application could not be found." };

    const answersByQuestion = new Map(refreshed.answers.map((answer) => [answer.questionId, answer]));
    const missing = refreshed.questions.filter((question) => {
      if (!question.required) return false;
      const answer = answersByQuestion.get(question.id);
      if (!answer) return true;
      if (question.type === "file_upload") return !answer.fileId;
      if (question.type === "video_response") {
        const structured = answer.structuredAnswer as { externalUrl?: string } | null;
        return !structured?.externalUrl;
      }
      return !answer.textAnswer || answer.textAnswer.trim().length === 0;
    });

    if (missing.length > 0) {
      return {
        ok: false as const,
        error: `Answer every required question before submitting. Still needed: ${missing
          .map((question, index) => `question ${index + 1}`)
          .join(", ")}. Your draft is saved.`,
        fieldErrors: Object.fromEntries(missing.map((question) => [`q_${question.id}`, ["This question is required."]])),
      };
    }

    const profile = await loadStudentProfile(user.id);
    if (!profile) return { ok: false as const, error: "Complete your profile before submitting an application." };

    // Onboarding stays optional, but no application goes out without a resume.
    if (!profile.profile.resumeFileId) {
      return {
        ok: false as const,
        error: "Attach a resume before submitting. It is the one document every researcher expects, and your draft is saved.",
        fieldErrors: { resume: ["Upload a resume to submit this application."] },
      };
    }

    const snapshot = {
      firstName: profile.profile.firstName,
      lastName: profile.profile.lastName,
      preferredName: profile.profile.preferredName,
      program: profile.profile.program,
      faculty: profile.profile.faculty,
      specialization: profile.profile.specialization,
      degreeLevel: profile.profile.degreeLevel,
      yearLevel: profile.profile.yearLevel,
      graduationYear: profile.profile.graduationYear,
      researchInterestSummary: profile.profile.researchInterestSummary,
      weeklyHours: profile.profile.weeklyHours,
      locationPreference: profile.profile.locationPreference,
      desiredStartDate: profile.profile.desiredStartDate,
      semesters: profile.profile.semesters,
      summerAvailable: profile.profile.summerAvailable,
      scheduleNotes: profile.profile.scheduleNotes,
      resumeFileId: profile.profile.resumeFileId,
      skills: profile.skills.map((skill) => ({ name: skill.name, proficiency: skill.proficiency, context: skill.context })),
      courses: profile.courses.map((course) => ({ code: course.courseCode, name: course.courseName, status: course.status })),
      researchFields: profile.fields.map((field) => field.name),
      experiences: profile.experiences.map((experience) => ({
        organization: experience.organization,
        title: experience.title,
        supervisor: experience.supervisor,
        startDate: experience.startDate,
        endDate: experience.endDate,
        description: experience.description,
        techniques: experience.techniques,
        outputs: experience.outputs,
      })),
      academicRecords: profile.academicRecords.map((record) => ({
        metricType: record.metricType,
        value: record.value,
        scaleMax: record.scaleMax,
        institutionScaleName: record.institutionScaleName,
        label: record.label,
      })),
    };

    const submittedAt = new Date();

    const courseType = readCourseType(formData);

    await db.transaction(async (tx) => {
      await tx
        .update(applications)
        .set({ status: "submitted", courseType, submittedAt, updatedAt: submittedAt })
        .where(and(eq(applications.id, applicationId), eq(applications.status, "draft")));

      await tx.insert(applicationStatusHistory).values({
        applicationId,
        previousStatus: "draft",
        newStatus: "submitted",
        changedBy: user.id,
      });

      await tx
        .insert(applicationSnapshots)
        .values({ applicationId, profile: snapshot, capturedAt: submittedAt })
        .onConflictDoUpdate({
          target: applicationSnapshots.applicationId,
          set: { profile: snapshot, capturedAt: submittedAt },
        });

      await tx.insert(notifications).values({
        userId: bundle.opportunity.researcherId,
        type: "new_application",
        title: "New application received",
        body: `${bundle.opportunity.title} has a new applicant.`,
        link: `/researcher/opportunities/${bundle.opportunity.id}/applicants`,
      });
    });

    await recordEvent({
      name: "application_submitted",
      userId: user.id,
      institutionId: user.institutionId,
      subjectType: "application",
      subjectId: applicationId,
      properties: { opportunityId: bundle.opportunity.id },
    });
    await recordAudit({
      actorId: user.id,
      action: "application_submitted",
      subjectType: "application",
      subjectId: applicationId,
    });

    const criteria = await loadCriteria(bundle.opportunity.id);
    const answers = refreshed.questions.map((question) => ({
      questionId: question.id,
      prompt: question.prompt,
      text: answersByQuestion.get(question.id)?.textAnswer ?? null,
    }));
    const evidence = toApplicantEvidence(profile, answers);

    try {
      await persistCriterionResults(applicationId, evaluateDeterministic(criteria, evidence));
    } catch (caught) {
      log.error("deterministic_evaluation_failed", { applicationId, error: caught });
    }

    // Written-response analysis is the slow half, so it runs after the response
    // rather than in front of the student. `after` keeps the work alive past the
    // redirect; a bare floating promise could be dropped with the request, which
    // would leave the reviewer waiting on evidence that was never requested.
    after(async () => {
      try {
        await runApplicationAnalysis({
          applicationId,
          criteria,
          evidence,
          projectTitle: bundle.opportunity.title,
          projectSummary: bundle.opportunity.summary,
          isPaidPosition: PAID_COMPENSATION.has(bundle.opportunity.compensationType),
        });
      } catch (caught) {
        log.error("ai_analysis_dispatch_failed", { applicationId, error: caught });
      }
    });

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(applications)
      .where(and(eq(applications.opportunityId, bundle.opportunity.id), sql`${applications.status} <> 'draft'`));

    const researcherEmailRows = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, bundle.opportunity.researcherId))
      .limit(1);

    await Promise.allSettled([
      sendApplicationReceived(
        bundle.studentEmail,
        bundle.opportunity.title,
        `${bundle.researcher.firstName} ${bundle.researcher.lastName}`,
      ),
      researcherEmailRows[0]
        ? sendNewApplicantNotice(researcherEmailRows[0].email, bundle.opportunity.title, count)
        : Promise.resolve(),
    ]);

    revalidatePath("/applications");
    revalidatePath("/dashboard");
  } catch (caught) {
    return toActionError(caught, "submit_application_failed");
  }

  redirect(`/applications/${applicationId}?submitted=1`);
}

export async function withdrawApplicationAction(_prev: ActionResult | null, formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  const user = await requireStudent();

  try {
    const bundle = await loadApplication(applicationId);
    if (!bundle || bundle.application.studentId !== user.id) {
      return { ok: false as const, error: "That application could not be found." };
    }
    if (!canTransition(bundle.application.status, "withdrawn", "student")) {
      return { ok: false as const, error: "This application can no longer be withdrawn." };
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(applications)
        .set({ status: "withdrawn", withdrawnAt: now, updatedAt: now })
        .where(eq(applications.id, applicationId));
      await tx.insert(applicationStatusHistory).values({
        applicationId,
        previousStatus: bundle.application.status,
        newStatus: "withdrawn",
        changedBy: user.id,
      });
      await tx.insert(notifications).values({
        userId: bundle.opportunity.researcherId,
        type: "application_withdrawn",
        title: "An applicant withdrew",
        body: `${bundle.student.firstName} ${bundle.student.lastName} withdrew from ${bundle.opportunity.title}.`,
        link: `/researcher/opportunities/${bundle.opportunity.id}/applicants`,
      });
    });

    await recordAudit({
      actorId: user.id,
      action: "application_withdrawn",
      subjectType: "application",
      subjectId: applicationId,
    });
    revalidatePath("/applications");
    return { ok: true as const, data: undefined, message: "Application withdrawn" };
  } catch (caught) {
    return toActionError(caught, "withdraw_application_failed");
  }
}

export async function deleteDraftAction(_prev: ActionResult | null, formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  const user = await requireStudent();

  try {
    const rows = await db
      .select({ id: applications.id, status: applications.status, studentId: applications.studentId })
      .from(applications)
      .where(eq(applications.id, applicationId))
      .limit(1);
    const row = rows[0];
    if (!row || row.studentId !== user.id) return { ok: false as const, error: "That draft could not be found." };
    if (row.status !== "draft") {
      return { ok: false as const, error: "Submitted applications are withdrawn rather than deleted." };
    }
    await db.delete(applications).where(eq(applications.id, applicationId));
  } catch (caught) {
    return toActionError(caught, "delete_draft_failed");
  }

  redirect("/applications");
}

export async function reportOutcomeAction(_prev: ActionResult | null, formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  const user = await requireStudent();

  if (!["yes", "no", "in_progress", "prefer_not_to_say"].includes(outcome)) {
    return { ok: false as const, error: "Choose one of the listed answers." };
  }

  try {
    const bundle = await loadApplication(applicationId);
    if (!bundle || bundle.application.studentId !== user.id) {
      return { ok: false as const, error: "That application could not be found." };
    }

    const { placementOutcomes } = await import("@/db");
    await db
      .insert(placementOutcomes)
      .values({
        applicationId,
        studentReportedOutcome: outcome as "yes" | "no" | "in_progress" | "prefer_not_to_say",
        studentWouldUseAgain: formData.get("wouldUseAgain") === "true" ? true : null,
      })
      .onConflictDoUpdate({
        target: placementOutcomes.applicationId,
        set: {
          studentReportedOutcome: outcome as "yes" | "no" | "in_progress" | "prefer_not_to_say",
          studentWouldUseAgain: formData.get("wouldUseAgain") === "true" ? true : null,
          updatedAt: new Date(),
        },
      });

    if (outcome === "yes") {
      await recordEvent({
        name: "placement_confirmed",
        userId: user.id,
        institutionId: user.institutionId,
        subjectType: "application",
        subjectId: applicationId,
        properties: { reportedBy: "student" },
      });
    }

    revalidatePath(`/applications/${applicationId}`);
    return { ok: true as const, data: undefined, message: "Thank you. That helps the pilot." };
  } catch (caught) {
    return toActionError(caught, "report_outcome_failed");
  }
}

export async function markApplicationOpenedAction(applicationId: string, researcherId: string) {
  await db
    .update(applications)
    .set({ status: "under_review", reviewedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(applications.id, applicationId), eq(applications.status, "submitted")));

  await db.insert(applicationStatusHistory).values({
    applicationId,
    previousStatus: "submitted",
    newStatus: "under_review",
    changedBy: researcherId,
  });
}

/**
 * Uploads a resume from inside the application flow. A student who skipped the
 * optional step during onboarding should not have to leave a half-finished
 * application to go and fix that.
 */
export async function attachResumeAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const applicationId = String(formData.get("applicationId") ?? "");
  const user = await requireStudent();

  try {
    const file = formData.get("resume");
    if (!(file instanceof File) || file.size === 0) {
      return {
        ok: false as const,
        error: "Choose a PDF to upload.",
        fieldErrors: { resume: ["Choose a PDF to upload."] },
      };
    }

    const stored = await storeFile({ file, purpose: "resume", ownerId: user.id });
    await db
      .update(studentProfiles)
      .set({ resumeFileId: stored.id, updatedAt: new Date() })
      .where(eq(studentProfiles.userId, user.id));

    await recordAudit({
      actorId: user.id,
      action: "resume_attached",
      subjectType: "application",
      subjectId: applicationId,
    });

    revalidatePath(`/applications/${applicationId}`);
    revalidatePath(`/applications/${applicationId}/edit`);
    revalidatePath("/profile");
    return { ok: true as const, data: undefined, message: "Resume saved to your profile" };
  } catch (caught) {
    return toActionError(caught, "attach_resume_failed");
  }
}
