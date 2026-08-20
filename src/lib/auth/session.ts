import crypto from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, institutions, researcherProfiles, sessions, studentProfiles, users } from "@/db";
import { env } from "@/lib/env";

const COOKIE = "rb_session";
const SECURE_COOKIE = env.APP_URL.startsWith("https://");
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  role: "student" | "researcher" | "admin" | null;
  accountStatus: "pending" | "active" | "suspended" | "disabled";
  institutionId: string | null;
  institutionName: string | null;
  institutionSlug: string | null;
  emailVerifiedAt: Date | null;
  onboardingCompletedAt: Date | null;
  displayName: string | null;
  researcherVerification: "pending" | "needs_review" | "verified" | "rejected" | null;
};

export function hashToken(token: string): string {
  return crypto.createHmac("sha256", env.SESSION_SECRET).update(token).digest("hex");
}

export async function createSession(userId: string, userAgent?: string): Promise<void> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    userAgent: userAgent?.slice(0, 300),
    expiresAt,
  });
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: SECURE_COOKIE,
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, hashToken(token)));
  }
  store.delete(COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      accountStatus: users.accountStatus,
      institutionId: users.institutionId,
      institutionName: institutions.name,
      institutionSlug: institutions.slug,
      emailVerifiedAt: users.emailVerifiedAt,
      onboardingCompletedAt: users.onboardingCompletedAt,
      studentFirst: studentProfiles.firstName,
      studentPreferred: studentProfiles.preferredName,
      studentLast: studentProfiles.lastName,
      researcherFirst: researcherProfiles.firstName,
      researcherLast: researcherProfiles.lastName,
      researcherVerification: researcherProfiles.verificationStatus,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(institutions, eq(institutions.id, users.institutionId))
    .leftJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .leftJoin(researcherProfiles, eq(researcherProfiles.userId, users.id))
    .where(
      and(eq(sessions.tokenHash, hashToken(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.accountStatus === "disabled" || row.accountStatus === "suspended") return null;

  const displayName =
    row.role === "researcher"
      ? [row.researcherFirst, row.researcherLast].filter(Boolean).join(" ") || null
      : [row.studentPreferred ?? row.studentFirst, row.studentLast].filter(Boolean).join(" ") || null;

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    accountStatus: row.accountStatus,
    institutionId: row.institutionId,
    institutionName: row.institutionName,
    institutionSlug: row.institutionSlug,
    emailVerifiedAt: row.emailVerifiedAt,
    onboardingCompletedAt: row.onboardingCompletedAt,
    displayName,
    researcherVerification: row.researcherVerification,
  };
}
