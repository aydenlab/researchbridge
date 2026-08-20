"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  db,
  researchExperiences,
  studentAcademicRecords,
  studentCourses,
  studentProfiles,
  studentResearchInterests,
  studentSkills,
  users,
} from "@/db";
import { requireUser } from "@/lib/auth/permissions";
import { checkboxValue, formList, optionalText, parseForm, toActionError } from "@/lib/action-utils";
import type { ActionResult } from "@/lib/errors";
import { recordEvent } from "@/lib/events";
import { GRADE_SCALES, scaleById } from "@/lib/gpa";
import { computeProfileCompletion, loadStudentProfile } from "@/lib/queries/student";
import { ensureCourse, ensureResearchField, ensureSkill } from "@/lib/queries/taxonomy";
import { storeFile } from "@/lib/storage";
import {
  studentAcademicsSchema,
  studentAvailabilitySchema,
  studentBasicsSchema,
  studentInterestsSchema,
} from "@/lib/validation/profile";

const TOTAL_STEPS = 8;

async function advance(userId: string, step: number) {
  const next = Math.min(step + 1, TOTAL_STEPS);
  await db
    .update(studentProfiles)
    .set({ onboardingStep: next, updatedAt: new Date() })
    .where(eq(studentProfiles.userId, userId));
  return next;
}

async function refreshCompletion(userId: string) {
  const bundle = await loadStudentProfile(userId);
  if (!bundle) return;
  await db
    .update(studentProfiles)
    .set({ profileCompletion: computeProfileCompletion(bundle), updatedAt: new Date() })
    .where(eq(studentProfiles.userId, userId));
}

export async function saveBasicsAction(_prev: ActionResult | null, formData: FormData) {
  const parsed = parseForm(studentBasicsSchema, formData);
  if (!parsed.ok) return parsed.result;
  const user = await requireUser();
  let next = 2;

  try {
    await db
      .update(studentProfiles)
      .set({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        preferredName: parsed.data.preferredName,
        degreeLevel: parsed.data.degreeLevel,
        program: parsed.data.program,
        faculty: parsed.data.faculty,
        specialization: parsed.data.specialization,
        yearLevel: parsed.data.yearLevel,
        graduationYear: parsed.data.graduationYear,
        updatedAt: new Date(),
      })
      .where(eq(studentProfiles.userId, user.id));
    next = await advance(user.id, 1);
    await refreshCompletion(user.id);
  } catch (error) {
    return toActionError(error, "student_basics_failed");
  }

  redirect(`/onboarding/student?step=${next}`);
}

export async function saveAcademicsAction(_prev: ActionResult | null, formData: FormData) {
  const parsed = parseForm(studentAcademicsSchema, formData);
  if (!parsed.ok) return parsed.result;
  const user = await requireUser();
  let next = 3;

  try {
    if (parsed.data.scaleId && parsed.data.metricValue) {
      const scale = scaleById(parsed.data.scaleId);
      if (!scale) {
        return { ok: false as const, error: "Choose a grading scale from the list." };
      }
      const value = Number(parsed.data.metricValue);
      if (!Number.isFinite(value) || value < 0 || value > scale.max) {
        return {
          ok: false as const,
          error: `Enter a value between 0 and ${scale.max} for the ${scale.label}.`,
          fieldErrors: { metricValue: [`Must be between 0 and ${scale.max}.`] },
        };
      }
      await db.delete(studentAcademicRecords).where(eq(studentAcademicRecords.studentId, user.id));
      await db.insert(studentAcademicRecords).values({
        studentId: user.id,
        metricType: scale.metricType,
        value: value.toFixed(2),
        scaleMax: scale.metricType === "percentage" ? null : scale.max.toFixed(2),
        institutionScaleName: scale.institutionScaleName,
        label: parsed.data.metricLabel ?? "Cumulative average",
      });
    } else if (!parsed.data.metricValue) {
      await db.delete(studentAcademicRecords).where(eq(studentAcademicRecords.studentId, user.id));
    }

    await db
      .update(studentProfiles)
      .set({ distinctions: parsed.data.distinctions, updatedAt: new Date() })
      .where(eq(studentProfiles.userId, user.id));

    await db.delete(studentCourses).where(eq(studentCourses.studentId, user.id));
    const institutionId = user.institutionId;
    if (institutionId && parsed.data.courseCodes.length > 0) {
      const unique = [...new Set(parsed.data.courseCodes.map((code) => code.toUpperCase()).filter(Boolean))];
      const rows: { studentId: string; courseId: string; status: "completed" }[] = [];
      for (const code of unique) {
        rows.push({ studentId: user.id, courseId: await ensureCourse(institutionId, code), status: "completed" });
      }
      if (rows.length > 0) await db.insert(studentCourses).values(rows);
    }

    next = await advance(user.id, 2);
    await refreshCompletion(user.id);
  } catch (error) {
    return toActionError(error, "student_academics_failed");
  }

  redirect(`/onboarding/student?step=${next}`);
}

export async function saveSkillsAction(_prev: ActionResult | null, formData: FormData) {
  const user = await requireUser();
  let next = 4;

  try {
    const names = formList(formData, "skillName");
    const proficiencies = formData.getAll("skillProficiency").map(String);
    const contexts = formData.getAll("skillContext").map(String);

    await db.delete(studentSkills).where(eq(studentSkills.studentId, user.id));

    const seen = new Set<string>();
    const rows: { studentId: string; skillId: string; proficiency: "exposure" | "working" | "proficient" | "advanced" | null; context: string | null }[] = [];

    for (let index = 0; index < names.length; index += 1) {
      const name = names[index];
      if (!name || name.length > 80) continue;
      const skillId = await ensureSkill(name);
      if (seen.has(skillId)) continue;
      seen.add(skillId);
      const proficiency = proficiencies[index];
      const context = contexts[index]?.trim();
      rows.push({
        studentId: user.id,
        skillId,
        proficiency: ["exposure", "working", "proficient", "advanced"].includes(proficiency)
          ? (proficiency as "exposure" | "working" | "proficient" | "advanced")
          : null,
        context: context && context.length > 0 ? context.slice(0, 300) : null,
      });
    }

    if (rows.length > 0) await db.insert(studentSkills).values(rows);
    next = await advance(user.id, 3);
    await refreshCompletion(user.id);
  } catch (error) {
    return toActionError(error, "student_skills_failed");
  }

  redirect(`/onboarding/student?step=${next}`);
}

export async function saveInterestsAction(_prev: ActionResult | null, formData: FormData) {
  const parsed = parseForm(studentInterestsSchema, formData);
  if (!parsed.ok) return parsed.result;
  const user = await requireUser();
  let next = 5;

  try {
    await db.delete(studentResearchInterests).where(eq(studentResearchInterests.studentId, user.id));

    const ids = new Set(parsed.data.researchFieldIds);
    for (const custom of parsed.data.customInterests) {
      ids.add(await ensureResearchField(custom));
    }

    if (ids.size > 0) {
      await db
        .insert(studentResearchInterests)
        .values([...ids].map((researchFieldId) => ({ studentId: user.id, researchFieldId })));
    }

    await db
      .update(studentProfiles)
      .set({ researchInterestSummary: parsed.data.researchInterestSummary, updatedAt: new Date() })
      .where(eq(studentProfiles.userId, user.id));

    next = await advance(user.id, 4);
    await refreshCompletion(user.id);
  } catch (error) {
    return toActionError(error, "student_interests_failed");
  }

  redirect(`/onboarding/student?step=${next}`);
}

export async function saveExperiencesAction(_prev: ActionResult | null, formData: FormData) {
  const user = await requireUser();
  let next = 6;

  try {
    const organizations = formData.getAll("expOrganization").map(String);
    const supervisors = formData.getAll("expSupervisor").map(String);
    const titles = formData.getAll("expTitle").map(String);
    const starts = formData.getAll("expStart").map(String);
    const ends = formData.getAll("expEnd").map(String);
    const descriptions = formData.getAll("expDescription").map(String);
    const techniques = formData.getAll("expTechniques").map(String);
    const outputs = formData.getAll("expOutputs").map(String);

    await db.delete(researchExperiences).where(eq(researchExperiences.studentId, user.id));

    const rows = organizations
      .map((organization, index) => ({
        organization: organization.trim(),
        supervisor: supervisors[index]?.trim() || null,
        title: titles[index]?.trim() || null,
        startDate: starts[index]?.trim() || null,
        endDate: ends[index]?.trim() || null,
        description: descriptions[index]?.trim() || null,
        techniques: (techniques[index] ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
          .slice(0, 20),
        outputs: (outputs[index] ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
          .slice(0, 10),
        studentId: user.id,
        sortOrder: index,
      }))
      .filter((row) => row.organization.length > 0);

    if (rows.length > 0) await db.insert(researchExperiences).values(rows);

    next = await advance(user.id, 5);
    await refreshCompletion(user.id);
  } catch (error) {
    return toActionError(error, "student_experiences_failed");
  }

  redirect(`/onboarding/student?step=${next}`);
}

export async function saveAvailabilityAction(_prev: ActionResult | null, formData: FormData) {
  const parsed = parseForm(studentAvailabilitySchema, formData);
  if (!parsed.ok) return parsed.result;
  const user = await requireUser();
  let next = 7;

  try {
    await db
      .update(studentProfiles)
      .set({
        desiredStartDate: parsed.data.desiredStartDate,
        weeklyHours: parsed.data.weeklyHours,
        semesters: parsed.data.semesters,
        summerAvailable: parsed.data.summerAvailable,
        locationPreference: parsed.data.locationPreference,
        scheduleNotes: parsed.data.scheduleNotes,
        updatedAt: new Date(),
      })
      .where(eq(studentProfiles.userId, user.id));
    next = await advance(user.id, 6);
    await refreshCompletion(user.id);
  } catch (error) {
    return toActionError(error, "student_availability_failed");
  }

  redirect(`/onboarding/student?step=${next}`);
}

export async function saveResumeAction(_prev: ActionResult | null, formData: FormData) {
  const user = await requireUser();
  let next = 8;

  try {
    const file = formData.get("resume");
    if (file instanceof File && file.size > 0) {
      const stored = await storeFile({ file, purpose: "resume", ownerId: user.id });
      await db
        .update(studentProfiles)
        .set({ resumeFileId: stored.id, updatedAt: new Date() })
        .where(eq(studentProfiles.userId, user.id));
    }
    if (checkboxValue(formData, "removeResume")) {
      await db
        .update(studentProfiles)
        .set({ resumeFileId: null, updatedAt: new Date() })
        .where(eq(studentProfiles.userId, user.id));
    }
    next = await advance(user.id, 7);
  } catch (error) {
    return toActionError(error, "student_resume_failed");
  }

  redirect(`/onboarding/student?step=${next}`);
}

export async function completeStudentOnboardingAction(_prev: ActionResult | null, _formData: FormData) {
  const user = await requireUser();

  try {
    const bundle = await loadStudentProfile(user.id);
    if (!bundle || !bundle.profile.firstName || !bundle.profile.program) {
      return { ok: false as const, error: "Complete the basics step before finishing. Your other answers are saved." };
    }

    await db
      .update(studentProfiles)
      .set({ profileCompletion: computeProfileCompletion(bundle), onboardingStep: TOTAL_STEPS, updatedAt: new Date() })
      .where(eq(studentProfiles.userId, user.id));

    await db
      .update(users)
      .set({ onboardingCompletedAt: new Date(), accountStatus: "active", updatedAt: new Date() })
      .where(eq(users.id, user.id));

    await recordEvent({
      name: "student_profile_completed",
      userId: user.id,
      institutionId: user.institutionId,
      subjectType: "student_profile",
      subjectId: user.id,
    });

    revalidatePath("/dashboard");
  } catch (error) {
    return toActionError(error, "student_onboarding_complete_failed");
  }

  redirect("/dashboard");
}

export async function goToStepAction(formData: FormData) {
  const user = await requireUser();
  const step = Number(optionalText(formData, "step") ?? "1");
  const safe = Number.isFinite(step) ? Math.min(Math.max(Math.round(step), 1), TOTAL_STEPS) : 1;
  await db
    .update(studentProfiles)
    .set({ onboardingStep: safe })
    .where(and(eq(studentProfiles.userId, user.id)));
  redirect(`/onboarding/student?step=${safe}`);
}

