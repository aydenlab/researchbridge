"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, researcherFields, researcherProfiles, users } from "@/db";
import { requireUser } from "@/lib/auth/permissions";
import { parseForm, toActionError } from "@/lib/action-utils";
import type { ActionResult } from "@/lib/errors";
import { recordAudit, recordEvent } from "@/lib/events";
import { storeFile } from "@/lib/storage";
import { researcherProfileSchema } from "@/lib/validation/profile";

const TOTAL_STEPS = 3;

export async function saveResearcherDetailsAction(_prev: ActionResult | null, formData: FormData) {
  const parsed = parseForm(researcherProfileSchema, formData);
  if (!parsed.ok) return parsed.result;
  const user = await requireUser();

  try {
    const photo = formData.get("photo");
    let photoFileId: string | undefined;
    if (photo instanceof File && photo.size > 0) {
      const stored = await storeFile({ file: photo, purpose: "photo", ownerId: user.id });
      photoFileId = stored.id;
    }

    await db
      .update(researcherProfiles)
      .set({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        researcherType: parsed.data.researcherType,
        title: parsed.data.title,
        department: parsed.data.department,
        faculty: parsed.data.faculty,
        labName: parsed.data.labName,
        labWebsite: parsed.data.labWebsite,
        personalWebsite: parsed.data.personalWebsite,
        linkedinUrl: parsed.data.linkedinUrl,
        orcidId: parsed.data.orcidId,
        contactEmail: parsed.data.contactEmail,
        biography: parsed.data.biography,
        recruitingOnBehalfOf: parsed.data.recruitingOnBehalfOf,
        ...(photoFileId ? { photoFileId } : {}),
        onboardingStep: 2,
        updatedAt: new Date(),
      })
      .where(eq(researcherProfiles.userId, user.id));

    await db.delete(researcherFields).where(eq(researcherFields.researcherId, user.id));
    await db
      .insert(researcherFields)
      .values(parsed.data.researchFieldIds.map((researchFieldId) => ({ researcherId: user.id, researchFieldId })));
  } catch (error) {
    return toActionError(error, "researcher_details_failed");
  }

  redirect("/onboarding/researcher?step=2");
}

export async function submitResearcherForReviewAction(_prev: ActionResult | null, _formData: FormData) {
  const user = await requireUser();

  try {
    const rows = await db.select().from(researcherProfiles).where(eq(researcherProfiles.userId, user.id)).limit(1);
    const profile = rows[0];
    if (!profile || !profile.firstName || !profile.department || !profile.biography) {
      return { ok: false as const, error: "Complete your details before submitting. Your answers are saved." };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(researcherProfiles)
        .set({
          verificationStatus: profile.verificationStatus === "verified" ? "verified" : "pending",
          onboardingStep: TOTAL_STEPS,
          updatedAt: new Date(),
        })
        .where(eq(researcherProfiles.userId, user.id));

      await tx
        .update(users)
        .set({ onboardingCompletedAt: new Date(), accountStatus: "active", updatedAt: new Date() })
        .where(eq(users.id, user.id));
    });

    await recordEvent({
      name: "researcher_profile_completed",
      userId: user.id,
      institutionId: user.institutionId,
      subjectType: "researcher_profile",
      subjectId: user.id,
    });
    await recordAudit({
      actorId: user.id,
      action: "researcher_submitted_for_review",
      subjectType: "researcher_profile",
      subjectId: user.id,
    });
  } catch (error) {
    return toActionError(error, "researcher_submit_failed");
  }

  // Straight into posting. Verification carries on in the background, and the
  // fewer steps between finishing a profile and having a position written, the
  // fewer people stop here.
  redirect("/researcher/opportunities/new");
}
