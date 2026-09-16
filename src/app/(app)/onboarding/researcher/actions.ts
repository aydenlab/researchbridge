"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, researcherFields, researcherProfiles, users } from "@/db";
import { requireUser } from "@/lib/auth/permissions";
import { parseForm, toActionError } from "@/lib/action-utils";
import type { ActionResult } from "@/lib/errors";
import { recordAudit, recordEvent } from "@/lib/events";
import { OTHER_DISCIPLINE_SLUG } from "@/lib/disciplines";
import { ensureResearchField } from "@/lib/queries/taxonomy";
import { storeFile } from "@/lib/storage";
import { facultyClaimSchema, researcherProfileSchema } from "@/lib/validation/profile";

const TOTAL_STEPS = 3;

type ResearchAreaInput = {
  disciplines: string[];
  disciplineOther: string | null;
  researchFieldIds: string[];
  researchAreaOtherSelected?: string;
  researchAreaOther: string | null;
};

/**
 * The profile columns and field ids for a discipline and area selection. A
 * specified Other area also becomes a research field, so the directory search
 * and matching can find it like any listed area.
 */
async function resolveResearchAreas(input: ResearchAreaInput) {
  const areaOther = input.researchAreaOtherSelected ? input.researchAreaOther : null;
  const ids = new Set(input.researchFieldIds);
  if (areaOther) ids.add(await ensureResearchField(areaOther));
  return {
    columns: {
      disciplines: input.disciplines,
      disciplineOther: input.disciplines.includes(OTHER_DISCIPLINE_SLUG) ? input.disciplineOther : null,
      researchAreaOther: areaOther,
    },
    fieldIds: [...ids],
  };
}

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
    const areas = await resolveResearchAreas(parsed.data);

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
        ...areas.columns,
        ...(photoFileId ? { photoFileId } : {}),
        onboardingStep: 2,
        updatedAt: new Date(),
      })
      .where(eq(researcherProfiles.userId, user.id));

    await db.delete(researcherFields).where(eq(researcherFields.researcherId, user.id));
    await db
      .insert(researcherFields)
      .values(areas.fieldIds.map((researchFieldId) => ({ researcherId: user.id, researchFieldId })));
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
    if (!profile || !profile.firstName || !profile.department) {
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

  // A confirmation with posting as the obvious next step, rather than dropping
  // them straight into the form: not everyone has a position ready on day one.
  redirect("/onboarding/researcher/live");
}

/**
 * Confirms a profile that was imported from a faculty list.
 *
 * One screen and one submit, because the entire promise of pre-population is
 * that a professor does not have to fill in a form. Marking `claimedAt` also
 * takes the profile out of reach of any future re-import: from here on these
 * are their words, not the list's.
 *
 * Verification is not re-run. The account came off the institution's own
 * faculty list, which is a stronger check than the manual one done for a
 * self-signup, so making them wait for approval would be theatre.
 */
export async function claimFacultyProfileAction(_prev: ActionResult | null, formData: FormData) {
  const parsed = parseForm(facultyClaimSchema, formData);
  if (!parsed.ok) return parsed.result;
  const user = await requireUser();

  try {
    const rows = await db.select().from(researcherProfiles).where(eq(researcherProfiles.userId, user.id)).limit(1);
    const profile = rows[0];
    if (!profile) return { ok: false as const, error: "That profile could not be found." };
    if (!profile.prefilledSource) {
      return { ok: false as const, error: "This profile was not imported, so there is nothing to confirm." };
    }

    const now = new Date();
    const areas = await resolveResearchAreas(parsed.data);

    await db.transaction(async (tx) => {
      await tx
        .update(researcherProfiles)
        .set({
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          title: parsed.data.title,
          department: parsed.data.department,
          labName: parsed.data.labName,
          labWebsite: parsed.data.labWebsite,
          biography: parsed.data.biography,
          recruitingNeeds: parsed.data.recruitingNeeds,
          recruitingOnBehalfOf: parsed.data.recruitingOnBehalfOf,
          ...areas.columns,
          verificationStatus: "verified",
          approvedAt: profile.approvedAt ?? now,
          claimedAt: now,
          onboardingStep: 3,
          updatedAt: now,
        })
        .where(eq(researcherProfiles.userId, user.id));

      await tx.delete(researcherFields).where(eq(researcherFields.researcherId, user.id));
      await tx
        .insert(researcherFields)
        .values(areas.fieldIds.map((researchFieldId) => ({ researcherId: user.id, researchFieldId })));

      await tx
        .update(users)
        .set({ onboardingCompletedAt: now, accountStatus: "active", updatedAt: now })
        .where(eq(users.id, user.id));
    });

    await recordEvent({
      name: "researcher_profile_completed",
      userId: user.id,
      institutionId: user.institutionId,
      subjectType: "researcher_profile",
      subjectId: user.id,
      properties: { claimed: true, source: profile.prefilledSource },
    });
    await recordAudit({
      actorId: user.id,
      action: "faculty_profile_claimed",
      subjectType: "researcher_profile",
      subjectId: user.id,
      detail: { source: profile.prefilledSource },
    });
  } catch (error) {
    return toActionError(error, "faculty_claim_failed");
  }

  redirect("/onboarding/researcher/live");
}
