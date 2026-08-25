"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, follows, users } from "@/db";
import { requireOnboardedUser } from "@/lib/auth/permissions";
import { sendNewFollowerNotice } from "@/lib/email";
import { recordAudit } from "@/lib/events";
import type { ActionResult } from "@/lib/errors";
import { toActionError } from "@/lib/action-utils";
import { log } from "@/lib/log";
import { loadPeople } from "@/lib/queries/social";

export async function followAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const targetId = String(formData.get("userId") ?? "");
  const user = await requireOnboardedUser();

  try {
    if (!targetId || targetId === user.id) {
      return { ok: false as const, error: "You cannot follow your own account." };
    }

    const target = (await db.select().from(users).where(eq(users.id, targetId)).limit(1))[0];
    if (!target || !target.role) {
      return { ok: false as const, error: "That account could not be found." };
    }
    if (target.accountStatus !== "active") {
      return { ok: false as const, error: "That account is not active." };
    }

    const inserted = await db
      .insert(follows)
      .values({ followerId: user.id, followingId: targetId })
      .onConflictDoNothing()
      .returning({ followerId: follows.followerId });

    // A repeated submit is not an error, but it must not send a second email.
    if (inserted.length > 0) {
      await recordAudit({ action: "follow_created", subjectType: "user", subjectId: targetId });
      const people = await loadPeople([user.id]);
      const name = people.get(user.id)?.displayName ?? "Someone";
      void sendNewFollowerNotice(target.email, name).catch((error) =>
        log.error("follow_notice_failed", { targetId, error }),
      );
    }

    revalidatePath("/connections");
    revalidatePath(`/people/${targetId}`);
    return { ok: true as const, data: undefined, message: "Following" };
  } catch (caught) {
    return toActionError(caught, "follow_failed");
  }
}

export async function unfollowAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const targetId = String(formData.get("userId") ?? "");
  const user = await requireOnboardedUser();

  try {
    await db.delete(follows).where(and(eq(follows.followerId, user.id), eq(follows.followingId, targetId)));
    await recordAudit({ action: "follow_removed", subjectType: "user", subjectId: targetId });

    revalidatePath("/connections");
    revalidatePath(`/people/${targetId}`);
    return { ok: true as const, data: undefined, message: "No longer following" };
  } catch (caught) {
    return toActionError(caught, "unfollow_failed");
  }
}
