"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, opportunities, researcherFields, researcherProfiles, users } from "@/db";
import { parseForm, toActionError } from "@/lib/action-utils";
import { normalizeEmail, resolveInstitutionForEmail } from "@/lib/auth/codes";
import { requireAdmin } from "@/lib/auth/permissions";
import type { ActionResult } from "@/lib/errors";
import { recordAudit } from "@/lib/events";
import { resolveResearchAreas } from "@/lib/queries/taxonomy";
import { storeFile } from "@/lib/storage";
import { adminResearcherProfileSchema } from "@/lib/validation/profile";

/**
 * Corrects a researcher profile on the person's behalf.
 *
 * An imported profile is somebody else's description of a professor until they
 * confirm it, and until then the only person who can fix a mistake in it is an
 * administrator. That includes the sign-in address: a professor whose email was
 * typed wrong cannot reach the account at all, so no amount of self-service
 * would help them.
 *
 * Confirming the profile does not put it out of reach here. An admin correcting
 * a claimed profile is rarer, but it is still the only way to fix an address
 * somebody can no longer receive mail at.
 */
export async function updateResearcherProfileAction(_prev: ActionResult | null, formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const parsed = parseForm(adminResearcherProfileSchema, formData);
  if (!parsed.ok) return parsed.result;

  try {
    const rows = await db
      .select({ email: users.email, institutionId: users.institutionId })
      .from(users)
      .innerJoin(researcherProfiles, eq(researcherProfiles.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);

    const existing = rows[0];
    if (!existing) return { ok: false as const, error: "That researcher account could not be found." };

    const email = normalizeEmail(parsed.data.email);
    const emailChanged = email !== existing.email;

    if (emailChanged) {
      const taken = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, email), ne(users.id, userId)))
        .limit(1);
      if (taken.length > 0) {
        return {
          ok: false as const,
          error: "Another account already uses that email address.",
          fieldErrors: { email: ["Another account already uses this address."] },
        };
      }
    }

    const photo = formData.get("photo");
    let photoFileId: string | undefined;
    if (photo instanceof File && photo.size > 0) {
      const stored = await storeFile({ file: photo, purpose: "photo", ownerId: userId });
      photoFileId = stored.id;
    }

    const areas = await resolveResearchAreas(parsed.data);
    const now = new Date();

    await db.transaction(async (tx) => {
      if (emailChanged) {
        // The institution follows the address, the way it does at sign-in, so a
        // corrected domain does not leave somebody filed under the wrong one.
        const institution = await resolveInstitutionForEmail(email);
        await tx
          .update(users)
          .set({ email, institutionId: institution?.id ?? existing.institutionId, updatedAt: now })
          .where(eq(users.id, userId));
      }

      await tx
        .update(researcherProfiles)
        .set({
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          researcherType: parsed.data.researcherType ?? null,
          title: parsed.data.title,
          department: parsed.data.department,
          faculty: parsed.data.faculty,
          labName: parsed.data.labName,
          personalWebsite: parsed.data.personalWebsite,
          linkedinUrl: parsed.data.linkedinUrl,
          orcidId: parsed.data.orcidId,
          contactEmail: parsed.data.contactEmail,
          biography: parsed.data.biography,
          ...areas.columns,
          ...(photoFileId ? { photoFileId } : {}),
          updatedAt: now,
        })
        .where(eq(researcherProfiles.userId, userId));

      await tx.delete(researcherFields).where(eq(researcherFields.researcherId, userId));
      if (areas.fieldIds.length > 0) {
        await tx
          .insert(researcherFields)
          .values(areas.fieldIds.map((researchFieldId) => ({ researcherId: userId, researchFieldId })));
      }
    });

    await recordAudit({
      actorId: admin.id,
      action: "researcher_profile_edited",
      subjectType: "researcher_profile",
      subjectId: userId,
      detail: emailChanged ? { emailChangedFrom: existing.email, emailChangedTo: email } : {},
    });

    revalidatePath("/admin/researchers");
    revalidatePath(`/admin/researchers/${userId}`);
    revalidatePath("/admin/faculty");
    revalidatePath("/admin/users");

    return {
      ok: true as const,
      data: undefined,
      message: emailChanged ? `Saved. The sign-in address is now ${email}.` : "Saved.",
    };
  } catch (error) {
    return toActionError(error, "researcher_profile_edit_failed");
  }
}

/**
 * Removes a researcher account outright.
 *
 * For a row that should never have existed, such as a faculty list typed with
 * the wrong address. Everything hanging off the account goes with it, so a
 * person who has already published a position is refused: that would take their
 * listings and every application to them as well, and the right answer there is
 * to correct the profile or disable the account.
 */
export async function deleteResearcherAccountAction(_prev: ActionResult | null, formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const typed = String(formData.get("confirmEmail") ?? "");

  if (userId === admin.id) {
    return { ok: false as const, error: "You cannot delete your own account." };
  }

  let deleted = false;
  try {
    const rows = await db
      .select({
        email: users.email,
        firstName: researcherProfiles.firstName,
        lastName: researcherProfiles.lastName,
      })
      .from(users)
      .innerJoin(researcherProfiles, eq(researcherProfiles.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);

    const person = rows[0];
    if (!person) return { ok: false as const, error: "That researcher account could not be found." };

    if (normalizeEmail(typed) !== person.email) {
      return {
        ok: false as const,
        error: "Type the account's email address exactly to confirm the deletion.",
        fieldErrors: { confirmEmail: ["This does not match the address on the account."] },
      };
    }

    const [posted] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opportunities)
      .where(eq(opportunities.researcherId, userId));

    if ((posted?.count ?? 0) > 0) {
      return {
        ok: false as const,
        error:
          "This account has published positions, so deleting it would take those listings and their applications too. Disable the account instead, or remove the positions first.",
      };
    }

    await db.delete(users).where(eq(users.id, userId));
    deleted = true;

    await recordAudit({
      actorId: admin.id,
      action: "researcher_account_deleted",
      subjectType: "user",
      subjectId: userId,
      detail: { email: person.email, name: `${person.firstName} ${person.lastName}` },
    });

    revalidatePath("/admin/researchers");
    revalidatePath("/admin/faculty");
    revalidatePath("/admin/users");
  } catch (error) {
    return toActionError(error, "researcher_account_delete_failed");
  }

  // Outside the try: a redirect works by throwing, and catching it here would
  // report the deletion as a failure.
  if (deleted) redirect("/admin/researchers?deleted=1");
  return { ok: false as const, error: "That account could not be deleted." };
}
