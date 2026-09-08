"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, notifications, profileReferrals, users } from "@/db";
import { requireOnboardedUser } from "@/lib/auth/permissions";
import { optionalText, toActionError } from "@/lib/action-utils";
import type { ActionResult } from "@/lib/errors";
import { recordAudit, recordEvent } from "@/lib/events";
import { MAX_REFERRAL_NOTE } from "@/lib/queries/referrals";
import { loadPeople } from "@/lib/queries/social";
import { canViewPerson } from "@/lib/visibility";
import { storeFile } from "@/lib/storage";

/**
 * Refers somebody by name. The referrer is whoever is signed in, so there is no
 * emailed confirmation step to wait on: the endorsement is already attributable
 * to a real, verified account, which is what makes it worth reading.
 */
export async function referStudentAction(_prev: ActionResult | null, formData: FormData) {
  const subjectId = String(formData.get("subjectId") ?? "");
  const note = optionalText(formData, "note");

  try {
    const user = await requireOnboardedUser();
    if (subjectId === user.id) return { ok: false as const, error: "You cannot refer yourself." };

    const subjectRows = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, subjectId))
      .limit(1);
    const subject = subjectRows[0];
    if (!subject || !subject.role) return { ok: false as const, error: "That person could not be found." };
    if (!canViewPerson(user, subject)) return { ok: false as const, error: "That person could not be found." };

    let letterFileId: string | null = null;
    const letter = formData.get("letter");
    if (letter instanceof File && letter.size > 0) {
      const stored = await storeFile({ file: letter, purpose: "attachment", ownerId: user.id });
      letterFileId = stored.id;
    }

    await db
      .insert(profileReferrals)
      .values({
        subjectId,
        referrerId: user.id,
        note: note ? note.slice(0, MAX_REFERRAL_NOTE) : null,
        letterFileId,
      })
      .onConflictDoUpdate({
        target: [profileReferrals.subjectId, profileReferrals.referrerId],
        set: {
          note: note ? note.slice(0, MAX_REFERRAL_NOTE) : null,
          ...(letterFileId ? { letterFileId } : {}),
        },
      });

    const people = await loadPeople([user.id]);
    const referrerName = people.get(user.id)?.displayName ?? "Someone";

    await db.insert(notifications).values({
      userId: subjectId,
      type: "profile_referred",
      title: `${referrerName} referred you`,
      body: "Their name now appears on your profile as a referral.",
      link: `/people/${subjectId}`,
    });

    await recordEvent({
      name: "student_referred",
      userId: user.id,
      institutionId: user.institutionId,
      subjectType: "user",
      subjectId,
    });
    await recordAudit({ actorId: user.id, action: "student_referred", subjectType: "user", subjectId });

    revalidatePath(`/people/${subjectId}`);
    return { ok: true as const, data: undefined, message: "Referral added" };
  } catch (error) {
    return toActionError(error, "refer_student_failed");
  }
}

export async function withdrawReferralAction(_prev: ActionResult | null, formData: FormData) {
  const subjectId = String(formData.get("subjectId") ?? "");

  try {
    const user = await requireOnboardedUser();
    await db
      .delete(profileReferrals)
      .where(and(eq(profileReferrals.subjectId, subjectId), eq(profileReferrals.referrerId, user.id)));

    revalidatePath(`/people/${subjectId}`);
    return { ok: true as const, data: undefined, message: "Referral withdrawn" };
  } catch (error) {
    return toActionError(error, "withdraw_referral_failed");
  }
}
