import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { applications, db, opportunities, researcherProfiles } from "@/db";
import { NotFoundError } from "@/lib/errors";
import { log } from "@/lib/log";
import { getSessionUser, type SessionUser } from "./session";

export type Role = "student" | "researcher" | "admin";

function deny(user: SessionUser | null, action: string): never {
  log.warn("authorization_denied", { action, userId: user?.id ?? null, role: user?.role ?? null });
  redirect("/forbidden");
}

export async function currentUser(): Promise<SessionUser | null> {
  return getSessionUser();
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  return user;
}

export async function requireOnboardedUser(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.role) redirect("/onboarding");
  if (!user.onboardingCompletedAt) {
    redirect(user.role === "researcher" ? "/onboarding/researcher" : "/onboarding/student");
  }
  return user;
}

export async function requireStudent(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "student") {
    if (!user.role) redirect("/onboarding");
    deny(user, "require_student");
  }
  if (!user.onboardingCompletedAt) redirect("/onboarding/student");
  return user;
}

export async function requireResearcher(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "researcher") {
    if (!user.role) redirect("/onboarding");
    deny(user, "require_researcher");
  }
  if (!user.onboardingCompletedAt) redirect("/onboarding/researcher");
  return user;
}

/**
 * A page that belongs to one side of the platform. Students browse researchers,
 * researchers browse students, and neither browses their own side. Admins get
 * through to both because moderation means looking at everything.
 */
export async function requireRoleOrAdmin(role: "student" | "researcher"): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === "admin") return user;
  if (user.role !== role) {
    if (!user.role) redirect("/onboarding");
    deny(user, `require_${role}`);
  }
  if (!user.onboardingCompletedAt) redirect(`/onboarding/${role}`);
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") deny(user, "require_admin");
  return user;
}

export async function canManageOpportunity(user: SessionUser, opportunityId: string): Promise<boolean> {
  if (user.role === "admin") return true;
  if (user.role !== "researcher") return false;
  const rows = await db
    .select({ id: opportunities.id })
    .from(opportunities)
    .where(and(eq(opportunities.id, opportunityId), eq(opportunities.researcherId, user.id)))
    .limit(1);
  return rows.length > 0;
}

export async function requireManagedOpportunity(opportunityId: string) {
  const user = await requireUser();
  const allowed = await canManageOpportunity(user, opportunityId);
  if (!allowed) deny(user, "manage_opportunity");
  const rows = await db.select().from(opportunities).where(eq(opportunities.id, opportunityId)).limit(1);
  const opportunity = rows[0];
  if (!opportunity) throw new NotFoundError("That opportunity could not be found.");
  return { user, opportunity };
}

export async function canViewApplication(user: SessionUser, applicationId: string): Promise<boolean> {
  if (user.role === "admin") return true;
  const rows = await db
    .select({ studentId: applications.studentId, researcherId: opportunities.researcherId })
    .from(applications)
    .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
    .where(eq(applications.id, applicationId))
    .limit(1);
  const row = rows[0];
  if (!row) return false;
  if (user.role === "student") return row.studentId === user.id;
  if (user.role === "researcher") return row.researcherId === user.id;
  return false;
}

export async function requireViewableApplication(applicationId: string) {
  const user = await requireUser();
  const allowed = await canViewApplication(user, applicationId);
  if (!allowed) deny(user, "view_application");
  return user;
}

export async function researcherVerificationOf(userId: string) {
  const rows = await db
    .select({ status: researcherProfiles.verificationStatus })
    .from(researcherProfiles)
    .where(eq(researcherProfiles.userId, userId))
    .limit(1);
  return rows[0]?.status ?? null;
}

export { getSessionUser, type SessionUser };
