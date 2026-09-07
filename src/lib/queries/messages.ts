import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { applications, db, directMessages, follows, opportunities, users } from "@/db";
import { loadPeople, type PersonSummary } from "./social";

/**
 * Who may open a conversation with whom.
 *
 * A researcher can message any student: they are the scarce side, and a message
 * from them is the thing students are here for. A student may only message a
 * researcher who has followed them back, or who has already engaged with one of
 * their applications. That mutual-follow gate is the whole point of the
 * platform: without it a professor's inbox becomes the cold-email pile this
 * exists to replace, and the follow costs the researcher one click when they
 * want to hear from someone.
 *
 * Once a conversation exists in either direction, both sides can reply freely.
 */
export type MessagePermission = { allowed: true } | { allowed: false; reason: string };

export async function canMessage(
  sender: { id: string; role: "student" | "researcher" | "admin" | null },
  recipientId: string,
): Promise<MessagePermission> {
  if (sender.id === recipientId) return { allowed: false, reason: "You cannot message yourself." };

  const recipientRows = await db
    .select({ role: users.role, accountStatus: users.accountStatus })
    .from(users)
    .where(eq(users.id, recipientId))
    .limit(1);
  const recipient = recipientRows[0];
  if (!recipient || !recipient.role) return { allowed: false, reason: "That account cannot receive messages." };
  if (recipient.accountStatus === "disabled" || recipient.accountStatus === "suspended") {
    return { allowed: false, reason: "That account is not active." };
  }

  if (sender.role === "admin") return { allowed: true };

  // An existing conversation always stays open.
  const existing = await db
    .select({ id: directMessages.id })
    .from(directMessages)
    .where(
      or(
        and(eq(directMessages.senderId, sender.id), eq(directMessages.recipientId, recipientId)),
        and(eq(directMessages.senderId, recipientId), eq(directMessages.recipientId, sender.id)),
      ),
    )
    .limit(1);
  if (existing.length > 0) return { allowed: true };

  if (sender.role === "researcher") return { allowed: true };

  if (recipient.role === "student") {
    // Student to student: mutual follow, so neither becomes a broadcast target.
    return (await mutuallyFollowing(sender.id, recipientId))
      ? { allowed: true }
      : { allowed: false, reason: "You can message another student once you both follow each other." };
  }

  if (await mutuallyFollowing(sender.id, recipientId)) return { allowed: true };

  const engaged = await db
    .select({ id: applications.id })
    .from(applications)
    .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
    .where(
      and(
        eq(applications.studentId, sender.id),
        eq(opportunities.researcherId, recipientId),
        sql`${applications.status} in ('under_review','shortlisted','researcher_contacted','interview','accepted')`,
      ),
    )
    .limit(1);
  if (engaged.length > 0) return { allowed: true };

  return {
    allowed: false,
    reason:
      "This researcher has not opened their inbox to you yet. Follow them, and they can follow you back to start a conversation. Applying to one of their positions also opens it once they review you.",
  };
}

export async function mutuallyFollowing(a: string, b: string): Promise<boolean> {
  const rows = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(
      or(
        and(eq(follows.followerId, a), eq(follows.followingId, b)),
        and(eq(follows.followerId, b), eq(follows.followingId, a)),
      ),
    );
  return rows.length === 2;
}

export type ConversationSummary = {
  person: PersonSummary;
  lastMessage: string;
  lastMessageAt: Date;
  lastFromMe: boolean;
  unread: number;
};

/**
 * One row per person the viewer has exchanged messages with. The pair key is
 * built in SQL so the newest message per conversation comes back in a single
 * pass rather than one query per counterpart.
 */
export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const counterpart = sql<string>`case when ${directMessages.senderId} = ${userId} then ${directMessages.recipientId} else ${directMessages.senderId} end`;

  const rows = await db
    .select({
      counterpartId: counterpart,
      body: directMessages.body,
      createdAt: directMessages.createdAt,
      senderId: directMessages.senderId,
      unread: sql<number>`count(*) filter (where ${directMessages.recipientId} = ${userId} and ${directMessages.readAt} is null) over (partition by ${counterpart})`,
      rank: sql<number>`row_number() over (partition by ${counterpart} order by ${directMessages.createdAt} desc, ${directMessages.id} desc)`,
    })
    .from(directMessages)
    .where(or(eq(directMessages.senderId, userId), eq(directMessages.recipientId, userId)));

  const latest = rows.filter((row) => Number(row.rank) === 1);
  latest.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const people = await loadPeople(latest.map((row) => row.counterpartId));

  return latest.flatMap((row) => {
    const person = people.get(row.counterpartId);
    if (!person) return [];
    return [
      {
        person,
        lastMessage: row.body,
        lastMessageAt: row.createdAt,
        lastFromMe: row.senderId === userId,
        unread: Number(row.unread),
      },
    ];
  });
}

export async function loadThread(userId: string, otherId: string) {
  return db
    .select()
    .from(directMessages)
    .where(
      or(
        and(eq(directMessages.senderId, userId), eq(directMessages.recipientId, otherId)),
        and(eq(directMessages.senderId, otherId), eq(directMessages.recipientId, userId)),
      ),
    )
    .orderBy(directMessages.createdAt, directMessages.id);
}

export async function markThreadRead(userId: string, otherId: string) {
  await db
    .update(directMessages)
    .set({ readAt: new Date() })
    .where(
      and(eq(directMessages.recipientId, userId), eq(directMessages.senderId, otherId), isNull(directMessages.readAt)),
    );
}

export async function unreadMessageCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(directMessages)
    .where(and(eq(directMessages.recipientId, userId), isNull(directMessages.readAt)));
  return row?.count ?? 0;
}

export async function latestMessageWith(userId: string, otherId: string) {
  const rows = await db
    .select()
    .from(directMessages)
    .where(
      or(
        and(eq(directMessages.senderId, userId), eq(directMessages.recipientId, otherId)),
        and(eq(directMessages.senderId, otherId), eq(directMessages.recipientId, userId)),
      ),
    )
    .orderBy(desc(directMessages.createdAt))
    .limit(1);
  return rows[0] ?? null;
}
