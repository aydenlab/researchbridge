"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { applicationReferences, db } from "@/db";
import { sendReferenceResolved } from "@/lib/email";
import { recordAudit } from "@/lib/events";
import type { ActionResult } from "@/lib/errors";
import { toActionError, parseForm } from "@/lib/action-utils";
import { log } from "@/lib/log";
import { loadReferenceByToken, studentEmailForApplication } from "@/lib/queries/references";

const respondSchema = z.object({
  token: z.string().min(1),
  decision: z.enum(["approved", "declined"]),
  note: z.string().trim().max(600).optional(),
});

/**
 * Reached from an emailed link by somebody with no account, so the token is the
 * only credential. It is matched by hash, single use, and the row is only ever
 * moved out of "pending" once.
 */
export async function respondToReferenceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseForm(respondSchema, formData);
  if (!parsed.ok) return parsed.result;

  const { token, decision, note } = parsed.data;

  try {
    const context = await loadReferenceByToken(token);
    if (!context) {
      return { ok: false as const, error: "That link is not valid. Ask for a new request." };
    }
    if (context.reference.status !== "pending") {
      return { ok: false as const, error: "This request has already been answered." };
    }

    const updated = await db
      .update(applicationReferences)
      .set({ status: decision, note: note || null, respondedAt: new Date() })
      .where(eq(applicationReferences.id, context.reference.id))
      .returning({ id: applicationReferences.id });

    if (updated.length === 0) {
      return { ok: false as const, error: "This request has already been answered." };
    }

    await recordAudit({
      action: decision === "approved" ? "reference_approved" : "reference_declined",
      subjectType: "application",
      subjectId: context.applicationId,
      detail: { refereeEmail: context.reference.refereeEmail },
    });

    const studentEmail = await studentEmailForApplication(context.applicationId);
    if (studentEmail) {
      void sendReferenceResolved({
        to: studentEmail,
        refereeLabel: context.reference.refereeName || context.reference.refereeEmail,
        projectTitle: context.opportunityTitle,
        approved: decision === "approved",
      }).catch((error) => log.error("reference_resolution_notice_failed", { error }));
    }

    revalidatePath(`/reference/${token}`);
    revalidatePath(`/applications/${context.applicationId}`);
    return {
      ok: true as const,
      data: undefined,
      message: decision === "approved" ? "Reference confirmed" : "Reference declined",
    };
  } catch (caught) {
    return toActionError(caught, "respond_to_reference_failed");
  }
}
