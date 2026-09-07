"use server";

import { revalidatePath } from "next/cache";
import { db, directMessages, notifications } from "@/db";
import { requireOnboardedUser } from "@/lib/auth/permissions";
import { parseForm, toActionError } from "@/lib/action-utils";
import type { ActionResult } from "@/lib/errors";
import { recordEvent } from "@/lib/events";
import { canMessage } from "@/lib/queries/messages";
import { loadPeople } from "@/lib/queries/social";
import { directMessageSchema } from "@/lib/validation/profile";

export async function sendMessageAction(_prev: ActionResult | null, formData: FormData) {
  const parsed = parseForm(directMessageSchema, formData);
  if (!parsed.ok) return parsed.result;

  try {
    const user = await requireOnboardedUser();
    const permission = await canMessage(user, parsed.data.recipientId);
    if (!permission.allowed) return { ok: false as const, error: permission.reason };

    await db.insert(directMessages).values({
      senderId: user.id,
      recipientId: parsed.data.recipientId,
      body: parsed.data.body,
    });

    const people = await loadPeople([user.id]);
    const senderName = people.get(user.id)?.displayName ?? "Someone";

    await db.insert(notifications).values({
      userId: parsed.data.recipientId,
      type: "direct_message",
      title: `New message from ${senderName}`,
      body: parsed.data.body.slice(0, 140),
      link: `/messages/${user.id}`,
    });

    await recordEvent({
      name: "direct_message_sent",
      userId: user.id,
      institutionId: user.institutionId,
      subjectType: "user",
      subjectId: parsed.data.recipientId,
    });

    revalidatePath(`/messages/${parsed.data.recipientId}`);
    revalidatePath("/messages");
    return { ok: true as const, data: undefined, message: "Sent" };
  } catch (error) {
    return toActionError(error, "send_message_failed");
  }
}
