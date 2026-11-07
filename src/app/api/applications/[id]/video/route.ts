import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { applicationAnswers, applications, db } from "@/db";
import { getSessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { recordAudit } from "@/lib/events";
import { log } from "@/lib/log";
import { loadApplication } from "@/lib/queries/applications";
import { removeApplicationVideo, storeVideoStream } from "@/lib/storage";
import { VIDEO_FILE_SOURCE, visibleQuestions, splitVideoQuestion, type VideoAnswer } from "@/lib/video-links";

export const dynamic = "force-dynamic";

function refuse(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

/**
 * A student's uploaded video, attached to their own draft. This is a route rather
 * than a server action because a server action buffers its whole body, and is
 * re-sent with every draft save. The upload happens once, when the file is
 * chosen, with progress the form can show.
 *
 * Cross-site requests are stopped twice over: the session cookie is SameSite=Lax,
 * and a PUT or DELETE needs a CORS preflight this route never answers.
 */
async function draftVideoQuestion(applicationId: string) {
  const user = await getSessionUser();
  if (!user) return { problem: refuse("Sign in to upload a video.", 401) };

  const bundle = await loadApplication(applicationId);
  if (!bundle || bundle.application.studentId !== user.id) {
    log.warn("authorization_denied", { action: "upload_application_video", userId: user.id, applicationId });
    return { problem: refuse("That application could not be found.", 404) };
  }
  if (bundle.application.status !== "draft") {
    return { problem: refuse("This application has already been submitted and can no longer be edited.", 409) };
  }

  const { video } = splitVideoQuestion(visibleQuestions(bundle.questions, bundle.opportunity.videoResponseEnabled));
  if (!video) return { problem: refuse("This position is not asking for a video.", 409) };

  return { user, question: video };
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const found = await draftVideoQuestion(id);
  if (found.problem) return found.problem;
  if (!request.body) return refuse("Choose a video to upload.", 400);

  const declared = request.headers.get("content-length");
  const rawName = request.headers.get("x-file-name") ?? "video";

  let storedId: string | null = null;
  try {
    const stored = await storeVideoStream({
      stream: request.body,
      declaredBytes: declared ? Number(declared) : null,
      fileName: safeDecode(rawName),
      ownerId: found.user.id,
    });
    storedId = stored.id;

    // An upload can take minutes, so everything checked before it may have changed
    // by now: the application sent from another tab, or another upload finished. The
    // row lock makes this the one moment that decides, against what is true now.
    const structuredAnswer: VideoAnswer = { provider: VIDEO_FILE_SOURCE, externalUrl: null, videoId: null };
    const committed = await db.transaction(async (tx) => {
      const [application] = await tx
        .select({ status: applications.status })
        .from(applications)
        .where(eq(applications.id, id))
        .for("update");
      if (application?.status !== "draft") return null;

      const [saved] = await tx
        .select({ fileId: applicationAnswers.fileId })
        .from(applicationAnswers)
        .where(and(eq(applicationAnswers.applicationId, id), eq(applicationAnswers.questionId, found.question.id)))
        .limit(1);
      await tx
        .insert(applicationAnswers)
        .values({ applicationId: id, questionId: found.question.id, fileId: stored.id, structuredAnswer })
        .onConflictDoUpdate({
          target: [applicationAnswers.applicationId, applicationAnswers.questionId],
          set: { fileId: stored.id, structuredAnswer, updatedAt: new Date() },
        });
      return { previous: saved?.fileId ?? null };
    });

    if (!committed) {
      await removeApplicationVideo(stored.id);
      return refuse("This application has already been submitted and can no longer be edited.", 409);
    }
    await removeApplicationVideo(committed.previous);

    await recordAudit({
      actorId: found.user.id,
      action: "application_video_uploaded",
      subjectType: "application",
      subjectId: id,
      detail: { byteSize: stored.byteSize, contentType: stored.contentType },
    });

    return NextResponse.json({ ok: true, file: stored });
  } catch (caught) {
    // Stored, but never attached to anything, so nothing would ever clean it up.
    await removeApplicationVideo(storedId);
    if (caught instanceof AppError) return refuse(caught.message, caught.status);
    log.error("application_video_upload_failed", { applicationId: id, error: caught });
    return refuse("The upload did not finish. Check your connection and try again.", 500);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const found = await draftVideoQuestion(id);
  if (found.problem) return found.problem;

  const [saved] = await db
    .select({ fileId: applicationAnswers.fileId })
    .from(applicationAnswers)
    .where(and(eq(applicationAnswers.applicationId, id), eq(applicationAnswers.questionId, found.question.id)))
    .limit(1);
  if (!saved?.fileId) return NextResponse.json({ ok: true });

  const structuredAnswer: VideoAnswer = { provider: VIDEO_FILE_SOURCE, externalUrl: null, videoId: null };
  await db
    .update(applicationAnswers)
    .set({ fileId: null, structuredAnswer, updatedAt: new Date() })
    .where(and(eq(applicationAnswers.applicationId, id), eq(applicationAnswers.fileId, saved.fileId)));
  await removeApplicationVideo(saved.fileId);

  return NextResponse.json({ ok: true });
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
