"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { applicationReferences, applications, db, opportunities, studentProfiles } from "@/db";
import { requireStudent } from "@/lib/auth/permissions";
import { sendReferenceRequest } from "@/lib/email";
import { recordAudit } from "@/lib/events";
import type { ActionResult } from "@/lib/errors";
import { toActionError, parseForm } from "@/lib/action-utils";
import { log } from "@/lib/log";
import { MAX_REFERENCES_PER_APPLICATION, referenceAlreadyRequested } from "@/lib/queries/references";
import { generateReferenceToken, hashReferenceToken, referenceUrl } from "@/lib/references/tokens";

const addReferenceSchema = z.object({
  applicationId: z.string().uuid(),
  refereeEmail: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter the email address of the person referring you.")
    .max(254, "That email address is too long.")
    .email("Enter a valid email address."),
  refereeName: z.string().trim().max(120).optional(),
  relationship: z.string().trim().max(160).optional(),
});

/**
 * Owning the application is not enough on its own: a referral is only meaningful
 * if the named person confirms it, so this records a pending request and mails a
 * single-use approval link. Nothing here marks anybody as referred.
 */
export async function addReferenceAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(addReferenceSchema, formData);
  if (!parsed.ok) return parsed.result;

  const { applicationId, refereeEmail, refereeName, relationship } = parsed.data;
  const user = await requireStudent();

  try {
    const rows = await db
      .select({
        studentId: applications.studentId,
        status: applications.status,
        projectTitle: opportunities.title,
        firstName: studentProfiles.firstName,
        lastName: studentProfiles.lastName,
      })
      .from(applications)
      .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
      .innerJoin(studentProfiles, eq(studentProfiles.userId, applications.studentId))
      .where(eq(applications.id, applicationId))
      .limit(1);

    const application = rows[0];
    if (!application || application.studentId !== user.id) {
      return { ok: false as const, error: "That application could not be found." };
    }
    if (application.status === "withdrawn") {
      return { ok: false as const, error: "This application has been withdrawn." };
    }

    if (refereeEmail === user.email.trim().toLowerCase()) {
      return {
        ok: false as const,
        error: "You cannot refer yourself.",
        fieldErrors: { refereeEmail: ["Use the address of the person referring you."] },
      };
    }

    const existing = await db
      .select({ id: applicationReferences.id })
      .from(applicationReferences)
      .where(eq(applicationReferences.applicationId, applicationId));
    if (existing.length >= MAX_REFERENCES_PER_APPLICATION) {
      return {
        ok: false as const,
        error: `You can name at most ${MAX_REFERENCES_PER_APPLICATION} references on one application.`,
      };
    }
    if (await referenceAlreadyRequested(applicationId, refereeEmail)) {
      return {
        ok: false as const,
        error: "You have already asked that person for this application.",
        fieldErrors: { refereeEmail: ["This address has already been asked."] },
      };
    }

    const token = generateReferenceToken();
    await db.insert(applicationReferences).values({
      applicationId,
      refereeEmail,
      refereeName: refereeName || null,
      relationship: relationship || null,
      status: "pending",
      tokenHash: hashReferenceToken(token),
    });

    const studentName = `${application.firstName} ${application.lastName}`.trim();
    const delivery = await sendReferenceRequest({
      to: refereeEmail,
      refereeName: refereeName || null,
      studentName,
      projectTitle: application.projectTitle,
      relationship: relationship || null,
      url: referenceUrl(token),
    });

    if (!delivery.ok) {
      // The row is useless if the mail never left, and leaving it behind would
      // block the student from retrying the same address.
      await db
        .delete(applicationReferences)
        .where(
          and(
            eq(applicationReferences.applicationId, applicationId),
            eq(applicationReferences.refereeEmail, refereeEmail),
          ),
        );
      log.error("reference_request_delivery_failed", { applicationId, reason: delivery.error });
      return {
        ok: false as const,
        error: "We could not send the request to that address right now. Check it and try again.",
      };
    }

    await recordAudit({
      actorId: user.id,
      action: "reference_requested",
      subjectType: "application",
      subjectId: applicationId,
      detail: { refereeEmail },
    });

    revalidatePath(`/applications/${applicationId}`);
    return { ok: true as const, data: undefined, message: "Request sent" };
  } catch (caught) {
    return toActionError(caught, "add_reference_failed");
  }
}

export async function removeReferenceAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const referenceId = String(formData.get("referenceId") ?? "");
  const user = await requireStudent();

  try {
    const rows = await db
      .select({ id: applicationReferences.id, applicationId: applications.id, studentId: applications.studentId })
      .from(applicationReferences)
      .innerJoin(applications, eq(applications.id, applicationReferences.applicationId))
      .where(eq(applicationReferences.id, referenceId))
      .limit(1);

    const row = rows[0];
    if (!row || row.studentId !== user.id) {
      return { ok: false as const, error: "That reference could not be found." };
    }

    await db.delete(applicationReferences).where(eq(applicationReferences.id, referenceId));
    await recordAudit({
      actorId: user.id,
      action: "reference_withdrawn",
      subjectType: "application",
      subjectId: row.applicationId,
    });

    revalidatePath(`/applications/${row.applicationId}`);
    return { ok: true as const, data: undefined, message: "Reference removed" };
  } catch (caught) {
    return toActionError(caught, "remove_reference_failed");
  }
}
