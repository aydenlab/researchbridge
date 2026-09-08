import { and, desc, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { db, follows, institutions, researcherProfiles, studentProfiles, users } from "@/db";
import { canViewPerson, counterpartRole, type Viewable } from "@/lib/visibility";

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

/**
 * The same lookup as loadPeople, minus anybody the viewer is not allowed to see.
 * Every list of people rendered to a signed-in account goes through this, so a
 * same-role account that predates the rule simply drops out of the list rather
 * than rendering a row that leads to a page they cannot open.
 */
export async function loadVisiblePeople(viewer: Viewable, userIds: string[]): Promise<Map<string, PersonSummary>> {
  const people = await loadPeople(userIds);
  for (const [id, person] of people) {
    if (!canViewPerson(viewer, person)) people.delete(id);
  }
  return people;
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
export async function sharedConnectionIds(viewer: Viewable, subjectId: string): Promise<string[]> {
  if (viewer.id === subjectId) return [];
  const viewerFollows = db
    .select({ id: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, viewer.id));

  const wanted = counterpartRole(viewer.role);

  const rows = await db
    .select({ id: follows.followerId })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followerId))
    .where(
      and(
        eq(follows.followingId, subjectId),
        inArray(follows.followerId, viewerFollows),
        ne(follows.followerId, viewer.id),
        ...(wanted ? [eq(users.role, wanted)] : []),
      ),
    )
    .limit(24);

  return rows.map((row) => row.id);
}

/**
 * People worth following that the viewer has not followed yet. Only the other
 * side of the platform is suggested: suggesting peers would be the fastest way
 * to turn the follow graph into something nobody here needs.
 */
export async function suggestedPeopleIds(viewer: Viewable, limit = 12): Promise<string[]> {
  const alreadyFollowing = await listFollowingIds(viewer.id);
  const excluded = [viewer.id, ...alreadyFollowing];
  const wanted = counterpartRole(viewer.role);

  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        ne(users.accountStatus, "disabled"),
        sql`${users.role} is not null`,
        notInArray(users.id, excluded),
        ...(wanted ? [eq(users.role, wanted)] : []),
      ),
    )
    .orderBy(desc(users.createdAt))
    .limit(limit);
  return rows.map((row) => row.id);
}
