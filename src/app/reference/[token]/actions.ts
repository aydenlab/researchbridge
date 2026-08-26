"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { applicationReferences, db, profileReferences } from "@/db";
import { sendReferenceResolved } from "@/lib/email";
import { recordAudit } from "@/lib/events";
import type { ActionResult } from "@/lib/errors";
import { toActionError, parseForm } from "@/lib/action-utils";
import { log } from "@/lib/log";
import { emailForUser, resolveReferenceToken, studentEmailForApplication } from "@/lib/queries/references";

const respondSchema = z.object({
  token: z.string().min(1),
  decision: z.enum(["approved", "declined"]),
  note: z.string().trim().max(600).optional(),
});

/**
 * Reached from an emailed link by somebody with no account, so the token is the
 * only credential. It is matched by hash, answered once, and it covers both a
 * per-application request and a profile-wide one.
 */
export async function respondToReferenceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseForm(respondSchema, formData);
  if (!parsed.ok) return parsed.result;

  const { token, decision, note } = parsed.data;

  try {
    const resolved = await resolveReferenceToken(token);
    if (!resolved) {
      return { ok: false as const, error: "That link is not valid. Ask for a new request." };
    }
    if (resolved.status !== "pending") {
      return { ok: false as const, error: "This request has already been answered." };
    }

    const table = resolved.kind === "application" ? applicationReferences : profileReferences;
    const updated = await db
      .update(table)
      .set({ status: decision, note: note || null, respondedAt: new Date() })
      .where(eq(table.id, resolved.referenceId))
      .returning({ id: table.id });

    if (updated.length === 0) {
      return { ok: false as const, error: "This request has already been answered." };
    }

    await recordAudit({
      action: decision === "approved" ? "reference_approved" : "reference_declined",
      subjectType: resolved.kind === "application" ? "application" : "user",
      subjectId: resolved.kind === "application" ? resolved.applicationId : resolved.userId,
      detail: { refereeEmail: resolved.refereeEmail, kind: resolved.kind },
    });

    const notifyEmail =
      resolved.kind === "application"
        ? await studentEmailForApplication(resolved.applicationId)
        : await emailForUser(resolved.userId);

    if (notifyEmail) {
      void sendReferenceResolved({
        to: notifyEmail,
        refereeLabel: resolved.refereeName || resolved.refereeEmail,
        projectTitle: resolved.kind === "application" ? resolved.projectTitle : "your profile",
        approved: decision === "approved",
      }).catch((error) => log.error("reference_resolution_notice_failed", { error }));
    }

    revalidatePath(`/reference/${token}`);
    if (resolved.kind === "application") {
      revalidatePath(`/applications/${resolved.applicationId}`);
    } else {
      revalidatePath("/profile");
      revalidatePath(`/people/${resolved.userId}`);
    }

    return {
      ok: true as const,
      data: undefined,
      message: decision === "approved" ? "Reference confirmed" : "Reference declined",
    };
  } catch (caught) {
    return toActionError(caught, "respond_to_reference_failed");
  }
}
