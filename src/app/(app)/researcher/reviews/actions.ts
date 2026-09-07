"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, opportunities, opportunityReviewTasks } from "@/db";
import { requireResearcher, requireManagedOpportunity } from "@/lib/auth/permissions";
import { parseForm, toActionError } from "@/lib/action-utils";
import type { ActionResult } from "@/lib/errors";
import { recordAudit, recordEvent } from "@/lib/events";
import { slugify } from "@/lib/format";
import { reviewPostingSchema } from "@/lib/validation/opportunity";

async function uniqueSlug(title: string, excludeId: string | null): Promise<string> {
  const base = slugify(title) || "review-project";
  let candidate = base;
  let counter = 1;
  while (true) {
    const rows = await db
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(eq(opportunities.slug, candidate))
      .limit(1);
    if (!rows[0] || rows[0].id === excludeId) return candidate;
    counter += 1;
    candidate = `${base}-${counter}`;
  }
}

/**
 * Creates and publishes a review posting in one submit. There is no draft step
 * and no review queue: the entire promise of this posting type is that it goes
 * up in under two minutes, and a multi-step wizard would be the thing that
 * stops it from being used.
 */
export async function createReviewPostingAction(_prev: ActionResult | null, formData: FormData) {
  const parsed = parseForm(reviewPostingSchema, formData);
  if (!parsed.ok) return parsed.result;

  const user = await requireResearcher();
  let slug = "";

  try {
    const candidate = await uniqueSlug(parsed.data.title, null);
    const now = new Date();

    const [row] = await db
      .insert(opportunities)
      .values({
        institutionId: user.institutionId ?? null,
        researcherId: user.id,
        kind: "review_project",
        title: parsed.data.title,
        slug: candidate,
        summary: parsed.data.summary,
        authorshipOffered: parsed.data.authorshipOffered,
        status: "published",
        publishedAt: now,
        draftStep: 1,
        compensationType: "volunteer",
      })
      .returning({ id: opportunities.id, slug: opportunities.slug });

    await db
      .insert(opportunityReviewTasks)
      .values(parsed.data.reviewTasks.map((task) => ({ opportunityId: row.id, task })));

    slug = row.slug;

    await recordEvent({
      name: "review_posting_created",
      userId: user.id,
      institutionId: user.institutionId,
      subjectType: "opportunity",
      subjectId: row.id,
    });
    await recordAudit({
      actorId: user.id,
      action: "review_posting_created",
      subjectType: "opportunity",
      subjectId: row.id,
    });

    revalidatePath("/reviews");
    revalidatePath("/researcher/opportunities");
  } catch (error) {
    return toActionError(error, "create_review_posting_failed");
  }

  redirect(`/opportunities/${slug}?posted=1`);
}

export async function updateReviewPostingAction(_prev: ActionResult | null, formData: FormData) {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const parsed = parseForm(reviewPostingSchema, formData);
  if (!parsed.ok) return parsed.result;

  let slug = "";

  try {
    const { opportunity } = await requireManagedOpportunity(opportunityId);
    if (opportunity.kind !== "review_project") {
      return { ok: false as const, error: "That posting is not a review." };
    }

    slug = await uniqueSlug(parsed.data.title, opportunity.id);

    await db
      .update(opportunities)
      .set({
        title: parsed.data.title,
        slug,
        summary: parsed.data.summary,
        authorshipOffered: parsed.data.authorshipOffered,
        updatedAt: new Date(),
      })
      .where(eq(opportunities.id, opportunity.id));

    await db.transaction(async (tx) => {
      await tx.delete(opportunityReviewTasks).where(eq(opportunityReviewTasks.opportunityId, opportunity.id));
      await tx
        .insert(opportunityReviewTasks)
        .values(parsed.data.reviewTasks.map((task) => ({ opportunityId: opportunity.id, task })));
    });

    revalidatePath("/reviews");
    revalidatePath(`/opportunities/${slug}`);
  } catch (error) {
    return toActionError(error, "update_review_posting_failed");
  }

  redirect(`/opportunities/${slug}?updated=1`);
}
