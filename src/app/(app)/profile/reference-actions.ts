"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, profileReferences } from "@/db";
import { requireOnboardedUser } from "@/lib/auth/permissions";
import { sendProfileReferenceRequest } from "@/lib/email";
import { recordAudit } from "@/lib/events";
import type { ActionResult } from "@/lib/errors";
import { toActionError, parseForm } from "@/lib/action-utils";
import { log } from "@/lib/log";
import { MAX_PROFILE_REFERENCES, profileReferenceAlreadyRequested } from "@/lib/queries/references";
import { loadPeople } from "@/lib/queries/social";
import { generateReferenceToken, hashReferenceToken, referenceUrl } from "@/lib/references/tokens";

const addSchema = z.object({
  refereeEmail: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter the email address of the person vouching for you.")
    .max(254, "That email address is too long.")
    .email("Enter a valid email address."),
  refereeName: z.string().trim().max(120).optional(),
  relationship: z.string().trim().max(160).optional(),
});

/**
 * A profile reference is asked for once and reused across applications, so the
 * confirmation matters more here than it does per application: this row is the
 * only evidence the named person ever agreed.
 */
export async function addProfileReferenceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseForm(addSchema, formData);
  if (!parsed.ok) return parsed.result;

  const { refereeEmail, refereeName, relationship } = parsed.data;
  const user = await requireOnboardedUser();

  try {
    if (refereeEmail === user.email.trim().toLowerCase()) {
      return {
        ok: false as const,
        error: "You cannot list yourself as your own reference.",
        fieldErrors: { refereeEmail: ["Use the address of the person vouching for you."] },
      };
    }

    const existing = await db
      .select({ id: profileReferences.id })
      .from(profileReferences)
      .where(eq(profileReferences.userId, user.id));
    if (existing.length >= MAX_PROFILE_REFERENCES) {
      return {
        ok: false as const,
        error: `You can list at most ${MAX_PROFILE_REFERENCES} references on your profile.`,
      };
    }
    if (await profileReferenceAlreadyRequested(user.id, refereeEmail)) {
      return {
        ok: false as const,
        error: "You have already asked that person.",
        fieldErrors: { refereeEmail: ["This address has already been asked."] },
      };
    }

    const token = generateReferenceToken();
    await db.insert(profileReferences).values({
      userId: user.id,
      refereeEmail,
      refereeName: refereeName || null,
      relationship: relationship || null,
      status: "pending",
      tokenHash: hashReferenceToken(token),
    });

    const people = await loadPeople([user.id]);
    const self = people.get(user.id);

    const delivery = await sendProfileReferenceRequest({
      to: refereeEmail,
      refereeName: refereeName || null,
      personName: self?.displayName ?? user.email,
      personDetail: [self?.headline, self?.institutionName].filter(Boolean).join(", ") || null,
      relationship: relationship || null,
      url: referenceUrl(token),
    });

    if (!delivery.ok) {
      // Leaving the row behind would trip the unique index and block a retry.
      await db
        .delete(profileReferences)
        .where(eq(profileReferences.tokenHash, hashReferenceToken(token)));
      log.error("profile_reference_delivery_failed", { userId: user.id, reason: delivery.error });
      return {
        ok: false as const,
        error: "We could not send the request to that address right now. Check it and try again.",
      };
    }

    await recordAudit({
      actorId: user.id,
      action: "profile_reference_requested",
      subjectType: "user",
      subjectId: user.id,
      detail: { refereeEmail },
    });

    revalidatePath("/profile");
    revalidatePath(`/people/${user.id}`);
    return { ok: true as const, data: undefined, message: "Request sent" };
  } catch (caught) {
    return toActionError(caught, "add_profile_reference_failed");
  }
}

export async function removeProfileReferenceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const referenceId = String(formData.get("referenceId") ?? "");
  const user = await requireOnboardedUser();

  try {
    const rows = await db
      .select({ id: profileReferences.id, userId: profileReferences.userId })
      .from(profileReferences)
      .where(eq(profileReferences.id, referenceId))
      .limit(1);

    const row = rows[0];
    if (!row || row.userId !== user.id) {
      return { ok: false as const, error: "That reference could not be found." };
    }

    await db.delete(profileReferences).where(eq(profileReferences.id, referenceId));
    await recordAudit({
      actorId: user.id,
      action: "profile_reference_removed",
      subjectType: "user",
      subjectId: user.id,
    });

    revalidatePath("/profile");
    revalidatePath(`/people/${user.id}`);
    return { ok: true as const, data: undefined, message: "Reference removed" };
  } catch (caught) {
    return toActionError(caught, "remove_profile_reference_failed");
  }
}
