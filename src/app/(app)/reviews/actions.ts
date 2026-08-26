"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, placementReviews } from "@/db";
import { requireOnboardedUser } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/events";
import type { ActionResult } from "@/lib/errors";
import { toActionError, parseForm } from "@/lib/action-utils";
import { canReview } from "@/lib/queries/reviews";

const reviewSchema = z.object({
  applicationId: z.string().uuid(),
  direction: z.enum(["researcher_to_student", "student_to_researcher"]),
  rating: z.coerce.number().int().min(1, "Choose a rating from 1 to 5.").max(5, "Choose a rating from 1 to 5."),
  comment: z.string().trim().max(2000).optional(),
});

export async function saveReviewAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(reviewSchema, formData);
  if (!parsed.ok) return parsed.result;

  const { applicationId, direction, rating, comment } = parsed.data;
  const user = await requireOnboardedUser();

  try {
    // Re-checked here rather than trusted from the form, which only decides
    // what to render.
    const permission = await canReview({ applicationId, authorId: user.id, direction });
    if (!permission.ok) return { ok: false as const, error: permission.reason };

    await db
      .insert(placementReviews)
      .values({
        applicationId,
        direction,
        authorId: user.id,
        subjectId: permission.subjectId,
        rating,
        comment: comment || null,
      })
      .onConflictDoUpdate({
        target: [placementReviews.applicationId, placementReviews.direction],
        set: { rating, comment: comment || null, updatedAt: new Date() },
      });

    await recordAudit({
      actorId: user.id,
      action: "review_saved",
      subjectType: "user",
      subjectId: permission.subjectId,
      detail: { applicationId, direction, rating },
    });

    revalidatePath("/reviews");
    revalidatePath(`/people/${permission.subjectId}`);
    return { ok: true as const, data: undefined, message: "Review saved" };
  } catch (caught) {
    return toActionError(caught, "save_review_failed");
  }
}

export async function deleteReviewAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const reviewId = String(formData.get("reviewId") ?? "");
  const user = await requireOnboardedUser();

  try {
    const rows = await db
      .select({ id: placementReviews.id, subjectId: placementReviews.subjectId })
      .from(placementReviews)
      .where(and(eq(placementReviews.id, reviewId), eq(placementReviews.authorId, user.id)))
      .limit(1);

    const row = rows[0];
    if (!row) return { ok: false as const, error: "That review could not be found." };

    await db.delete(placementReviews).where(eq(placementReviews.id, reviewId));
    await recordAudit({
      actorId: user.id,
      action: "review_deleted",
      subjectType: "user",
      subjectId: row.subjectId,
    });

    revalidatePath("/reviews");
    revalidatePath(`/people/${row.subjectId}`);
    return { ok: true as const, data: undefined, message: "Review removed" };
  } catch (caught) {
    return toActionError(caught, "delete_review_failed");
  }
}
