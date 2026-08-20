"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, notifications } from "@/db";
import { requireUser } from "@/lib/auth/permissions";
import { toActionError } from "@/lib/action-utils";
import type { ActionResult } from "@/lib/errors";

export async function markAllReadAction(_prev: ActionResult | null, _formData: FormData) {
  const user = await requireUser();
  try {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    revalidatePath("/notifications");
    return { ok: true as const, data: undefined, message: "All caught up" };
  } catch (error) {
    return toActionError(error, "mark_notifications_read_failed");
  }
}
