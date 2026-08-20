"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, waitlistEntries } from "@/db";
import { parseForm, toActionError } from "@/lib/action-utils";
import { resolveInstitutionForEmail } from "@/lib/auth/codes";
import type { ActionResult } from "@/lib/errors";
import { recordEvent } from "@/lib/events";
import { isEnabled } from "@/lib/flags";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

const studentSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(80),
  lastName: z.string().trim().min(1, "Enter your last name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid institutional email address.").max(254),
  program: optional(160),
  yearLevel: optional(40),
  researchInterests: optional(600),
  willingToPilot: z.coerce.boolean().default(true),
  contactConsent: z.literal("true", { message: "Tick the box so we know we may contact you." }),
});

const researcherSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(80),
  lastName: z.string().trim().min(1, "Enter your last name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid institutional email address.").max(254),
  title: optional(160),
  department: optional(160),
  labName: optional(160),
  researchInterests: optional(600),
  expectedStudentCount: z.coerce.number().int().min(0).max(100).optional(),
  helpNeeded: optional(800),
  comments: optional(1200),
  contactConsent: z.literal("true", { message: "Tick the box so we know we may contact you." }),
});

type WaitlistInsert = typeof waitlistEntries.$inferInsert;

async function submit(kind: "student" | "researcher", data: Partial<WaitlistInsert>, email: string) {
  if (!(await isEnabled("WAITLIST_ENABLED"))) {
    return { ok: false as const, error: "The waitlist is closed right now. Write to hello@myresearchbridge.com instead." };
  }

  const existing = await db
    .select({ id: waitlistEntries.id })
    .from(waitlistEntries)
    .where(and(eq(waitlistEntries.email, email), eq(waitlistEntries.kind, kind)))
    .limit(1);

  if (existing[0]) {
    return {
      ok: true as const,
      data: undefined,
      message: "You are already on the list. We will be in touch before the pilot opens.",
    };
  }

  const institution = await resolveInstitutionForEmail(email);

  const [row] = await db
    .insert(waitlistEntries)
    .values({ ...data, kind, email, institutionId: institution?.id ?? null } as WaitlistInsert)
    .returning({ id: waitlistEntries.id });

  await recordEvent({
    name: "waitlist_joined",
    institutionId: institution?.id ?? null,
    subjectType: "waitlist_entry",
    subjectId: row.id,
    properties: { kind },
  });

  return { ok: true as const, data: undefined, message: "You are on the list." };
}

export async function joinStudentWaitlistAction(_prev: ActionResult | null, formData: FormData) {
  const parsed = parseForm(studentSchema, formData);
  if (!parsed.ok) return parsed.result;

  try {
    return await submit(
      "student",
      {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        program: parsed.data.program,
        yearLevel: parsed.data.yearLevel,
        researchInterests: parsed.data.researchInterests,
        willingToPilot: parsed.data.willingToPilot,
        contactConsent: true,
      },
      parsed.data.email,
    );
  } catch (error) {
    return toActionError(error, "student_waitlist_failed");
  }
}

export async function registerResearcherInterestAction(_prev: ActionResult | null, formData: FormData) {
  const parsed = parseForm(researcherSchema, formData);
  if (!parsed.ok) return parsed.result;

  try {
    return await submit(
      "researcher",
      {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        title: parsed.data.title,
        department: parsed.data.department,
        labName: parsed.data.labName,
        researchInterests: parsed.data.researchInterests,
        expectedStudentCount: parsed.data.expectedStudentCount ?? null,
        helpNeeded: parsed.data.helpNeeded,
        comments: parsed.data.comments,
        contactConsent: true,
      },
      parsed.data.email,
    );
  } catch (error) {
    return toActionError(error, "researcher_interest_failed");
  }
}
