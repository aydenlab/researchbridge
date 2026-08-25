import { and, desc, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { db, follows, institutions, researcherProfiles, studentProfiles, users } from "@/db";

export type PersonSummary = {
  id: string;
  email: string;
  role: "student" | "researcher" | "admin" | null;
  displayName: string;
  headline: string | null;
  institutionName: string | null;
};

/**
 * Names live in two different profile tables depending on the role, and an
 * account that has not finished onboarding has neither. Resolve all three cases
 * in one place so every follower list renders something sensible.
 */
export async function loadPeople(userIds: string[]): Promise<Map<string, PersonSummary>> {
  const result = new Map<string, PersonSummary>();
  if (userIds.length === 0) return result;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      institutionName: institutions.name,
      studentFirst: studentProfiles.firstName,
      studentLast: studentProfiles.lastName,
      studentProgram: studentProfiles.program,
      researcherFirst: researcherProfiles.firstName,
      researcherLast: researcherProfiles.lastName,
      researcherTitle: researcherProfiles.title,
      researcherDepartment: researcherProfiles.department,
    })
    .from(users)
    .leftJoin(institutions, eq(institutions.id, users.institutionId))
    .leftJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .leftJoin(researcherProfiles, eq(researcherProfiles.userId, users.id))
    .where(inArray(users.id, userIds));

  for (const row of rows) {
    const student = row.studentFirst ? `${row.studentFirst} ${row.studentLast ?? ""}`.trim() : null;
    const researcher = row.researcherFirst ? `${row.researcherFirst} ${row.researcherLast ?? ""}`.trim() : null;
    const headline =
      row.role === "researcher"
        ? [row.researcherTitle, row.researcherDepartment].filter(Boolean).join(", ") || null
        : row.studentProgram;

    result.set(row.id, {
      id: row.id,
      email: row.email,
      role: row.role,
      displayName: researcher ?? student ?? row.email.split("@")[0],
      headline: headline || null,
      institutionName: row.institutionName,
    });
  }

  return result;
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const rows = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
    .limit(1);
  return rows.length > 0;
}

export async function followCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [followerRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.followingId, userId));
  const [followingRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.followerId, userId));
  return { followers: followerRow?.count ?? 0, following: followingRow?.count ?? 0 };
}

export async function listFollowerIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: follows.followerId })
    .from(follows)
    .where(eq(follows.followingId, userId))
    .orderBy(desc(follows.createdAt));
  return rows.map((row) => row.id);
}

export async function listFollowingIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, userId))
    .orderBy(desc(follows.createdAt));
  return rows.map((row) => row.id);
}

/**
 * People the viewer follows who also follow the person being viewed. This is
 * the "you both know" line, and it is deliberately one-directional on the
 * viewer's side so it never reveals who someone follows privately.
 */
export async function sharedConnectionIds(viewerId: string, subjectId: string): Promise<string[]> {
  if (viewerId === subjectId) return [];
  const viewerFollows = db
    .select({ id: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, viewerId));

  const rows = await db
    .select({ id: follows.followerId })
    .from(follows)
    .where(and(eq(follows.followingId, subjectId), inArray(follows.followerId, viewerFollows), ne(follows.followerId, viewerId)))
    .limit(24);

  return rows.map((row) => row.id);
}

export async function suggestedPeopleIds(viewerId: string, limit = 12): Promise<string[]> {
  const alreadyFollowing = await listFollowingIds(viewerId);
  const excluded = [viewerId, ...alreadyFollowing];
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(ne(users.accountStatus, "disabled"), sql`${users.role} is not null`, notInArray(users.id, excluded)))
    .orderBy(desc(users.createdAt))
    .limit(limit);
  return rows.map((row) => row.id);
}
