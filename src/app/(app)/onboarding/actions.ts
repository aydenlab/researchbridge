"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, researcherProfiles, studentProfiles, users } from "@/db";
import { requireUser } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/events";
import type { ActionResult } from "@/lib/errors";
import { parseForm, toActionError } from "@/lib/action-utils";
import { roleChoiceSchema } from "@/lib/validation/auth";

export async function chooseRoleAction(_prev: ActionResult | null, formData: FormData) {
  const parsed = parseForm(roleChoiceSchema, formData);
  if (!parsed.ok) return parsed.result;

  const user = await requireUser();
  let destination = "/onboarding/student";

  try {
    if (user.role && user.role !== parsed.data.role) {
      return {
        ok: false as const,
        error: "This account already has a role. Contact hello@myresearchbridge.com if that needs to change.",
      };
    }

    await db.update(users).set({ role: parsed.data.role, updatedAt: new Date() }).where(eq(users.id, user.id));

    if (parsed.data.role === "student") {
      const existing = await db.select({ userId: studentProfiles.userId }).from(studentProfiles).where(eq(studentProfiles.userId, user.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(studentProfiles).values({ userId: user.id, firstName: "", lastName: "" });
      }
      destination = "/onboarding/student";
    } else {
      const existing = await db.select({ userId: researcherProfiles.userId }).from(researcherProfiles).where(eq(researcherProfiles.userId, user.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(researcherProfiles).values({ userId: user.id, firstName: "", lastName: "" });
      }
      destination = "/onboarding/researcher";
    }

    await recordAudit({ actorId: user.id, action: "role_selected", subjectType: "user", subjectId: user.id, detail: { role: parsed.data.role } });
  } catch (error) {
    return toActionError(error, "choose_role_failed");
  }

  redirect(destination);
}
