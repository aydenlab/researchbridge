"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { applications, applicationStatusHistory, db, opportunities, savedOpportunities } from "@/db";
import { requireStudent } from "@/lib/auth/permissions";
import { toActionError } from "@/lib/action-utils";
import type { ActionResult } from "@/lib/errors";
import { recordEvent } from "@/lib/events";

export async function toggleSavedAction(_prev: ActionResult | null, formData: FormData) {
  const user = await requireStudent();
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const slug = String(formData.get("slug") ?? "");

  if (!opportunityId) return { ok: false as const, error: "That opportunity could not be found." };

  try {
    const existing = await db
      .select({ opportunityId: savedOpportunities.opportunityId })
      .from(savedOpportunities)
      .where(and(eq(savedOpportunities.studentId, user.id), eq(savedOpportunities.opportunityId, opportunityId)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .delete(savedOpportunities)
        .where(and(eq(savedOpportunities.studentId, user.id), eq(savedOpportunities.opportunityId, opportunityId)));
    } else {
      await db.insert(savedOpportunities).values({ studentId: user.id, opportunityId });
      await recordEvent({
        name: "opportunity_saved",
        userId: user.id,
        institutionId: user.institutionId,
        subjectType: "opportunity",
        subjectId: opportunityId,
      });
    }

    revalidatePath("/saved");
    if (slug) revalidatePath(`/opportunities/${slug}`);
    return { ok: true as const, data: undefined, message: existing.length > 0 ? "Removed from saved" : "Saved" };
  } catch (error) {
    return toActionError(error, "toggle_saved_failed");
  }
}

export async function startApplicationAction(_prev: ActionResult | null, formData: FormData) {
  const user = await requireStudent();
  const opportunityId = String(formData.get("opportunityId") ?? "");
  let applicationId = "";

  try {
    const rows = await db
      .select({ id: opportunities.id, status: opportunities.status, slug: opportunities.slug })
      .from(opportunities)
      .where(eq(opportunities.id, opportunityId))
      .limit(1);

    const opportunity = rows[0];
    if (!opportunity) return { ok: false as const, error: "That opportunity could not be found." };
    if (opportunity.status !== "published") {
      return { ok: false as const, error: "This position is no longer accepting applications." };
    }

    const existing = await db
      .select({ id: applications.id, status: applications.status })
      .from(applications)
      .where(and(eq(applications.studentId, user.id), eq(applications.opportunityId, opportunityId)))
      .limit(1);

    if (existing[0]) {
      if (existing[0].status !== "draft") {
        return { ok: false as const, error: "You have already applied to this position." };
      }
      applicationId = existing[0].id;
    } else {
      const created = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(applications)
          .values({ opportunityId, studentId: user.id, status: "draft" })
          .returning({ id: applications.id });
        await tx.insert(applicationStatusHistory).values({
          applicationId: row.id,
          previousStatus: null,
          newStatus: "draft",
          changedBy: user.id,
        });
        return row;
      });
      applicationId = created.id;
      await recordEvent({
        name: "application_started",
        userId: user.id,
        institutionId: user.institutionId,
        subjectType: "application",
        subjectId: applicationId,
      });
    }
  } catch (error) {
    return toActionError(error, "start_application_failed");
  }

  redirect(`/applications/${applicationId}/edit`);
}
