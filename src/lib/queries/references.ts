import { and, asc, eq, inArray } from "drizzle-orm";
import {
  applicationReferences,
  applications,
  db,
  institutions,
  opportunities,
  profileReferences,
  researcherProfiles,
  studentProfiles,
  users,
} from "@/db";
import { hashReferenceToken } from "@/lib/references/tokens";

export const MAX_REFERENCES_PER_APPLICATION = 3;

export async function listReferences(applicationId: string) {
  return db
    .select()
    .from(applicationReferences)
    .where(eq(applicationReferences.applicationId, applicationId))
    .orderBy(asc(applicationReferences.requestedAt));
}

export async function listReferencesForApplications(applicationIds: string[]) {
  if (applicationIds.length === 0) return [];
  return db
    .select()
    .from(applicationReferences)
    .where(inArray(applicationReferences.applicationId, applicationIds))
    .orderBy(asc(applicationReferences.requestedAt));
}

export type ReferenceContext = Awaited<ReturnType<typeof loadReferenceByToken>>;

/**
 * Resolves an emailed approval link. The referee has no account, so everything
 * the approval page needs to render has to come back from this one lookup.
 */
export async function loadReferenceByToken(token: string) {
  const tokenHash = hashReferenceToken(token);
  const rows = await db
    .select({
      reference: applicationReferences,
      applicationId: applications.id,
      applicationStatus: applications.status,
      studentFirstName: studentProfiles.firstName,
      studentLastName: studentProfiles.lastName,
      studentProgram: studentProfiles.program,
      studentYearLevel: studentProfiles.yearLevel,
      opportunityTitle: opportunities.title,
      opportunityLabName: opportunities.labName,
      researcherFirstName: researcherProfiles.firstName,
      researcherLastName: researcherProfiles.lastName,
    })
    .from(applicationReferences)
    .innerJoin(applications, eq(applications.id, applicationReferences.applicationId))
    .innerJoin(studentProfiles, eq(studentProfiles.userId, applications.studentId))
    .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
    .leftJoin(researcherProfiles, eq(researcherProfiles.userId, opportunities.researcherId))
    .where(eq(applicationReferences.tokenHash, tokenHash))
    .limit(1);

  return rows[0] ?? null;
}

export async function studentEmailForApplication(applicationId: string): Promise<string | null> {
  const rows = await db
    .select({ email: users.email })
    .from(applications)
    .innerJoin(users, eq(users.id, applications.studentId))
    .where(eq(applications.id, applicationId))
    .limit(1);
  return rows[0]?.email ?? null;
}

export async function referenceAlreadyRequested(applicationId: string, refereeEmail: string): Promise<boolean> {
  const rows = await db
    .select({ id: applicationReferences.id })
    .from(applicationReferences)
    .where(
      and(
        eq(applicationReferences.applicationId, applicationId),
        eq(applicationReferences.refereeEmail, refereeEmail),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export function summarizeReferences(rows: { status: "pending" | "approved" | "declined" }[]) {
  return {
    total: rows.length,
    approved: rows.filter((row) => row.status === "approved").length,
    pending: rows.filter((row) => row.status === "pending").length,
    declined: rows.filter((row) => row.status === "declined").length,
  };
}

export const MAX_PROFILE_REFERENCES = 5;

export async function listProfileReferences(userId: string) {
  return db
    .select()
    .from(profileReferences)
    .where(eq(profileReferences.userId, userId))
    .orderBy(asc(profileReferences.requestedAt));
}

export async function listConfirmedProfileReferences(userId: string) {
  return db
    .select()
    .from(profileReferences)
    .where(and(eq(profileReferences.userId, userId), eq(profileReferences.status, "approved")))
    .orderBy(asc(profileReferences.requestedAt));
}

export async function profileReferenceAlreadyRequested(userId: string, refereeEmail: string): Promise<boolean> {
  const rows = await db
    .select({ id: profileReferences.id })
    .from(profileReferences)
    .where(and(eq(profileReferences.userId, userId), eq(profileReferences.refereeEmail, refereeEmail)))
    .limit(1);
  return rows.length > 0;
}

async function loadProfileReferenceByToken(token: string) {
  const tokenHash = hashReferenceToken(token);
  const rows = await db
    .select({
      reference: profileReferences,
      userEmail: users.email,
      role: users.role,
      studentFirstName: studentProfiles.firstName,
      studentLastName: studentProfiles.lastName,
      studentProgram: studentProfiles.program,
      researcherFirstName: researcherProfiles.firstName,
      researcherLastName: researcherProfiles.lastName,
      researcherTitle: researcherProfiles.title,
      researcherDepartment: researcherProfiles.department,
      institutionName: institutions.name,
    })
    .from(profileReferences)
    .innerJoin(users, eq(users.id, profileReferences.userId))
    .leftJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .leftJoin(researcherProfiles, eq(researcherProfiles.userId, users.id))
    .leftJoin(institutions, eq(institutions.id, users.institutionId))
    .where(eq(profileReferences.tokenHash, tokenHash))
    .limit(1);
  return rows[0] ?? null;
}

export type ResolvedReference =
  | {
      kind: "application";
      referenceId: string;
      status: "pending" | "approved" | "declined";
      respondedAt: Date | null;
      refereeName: string | null;
      refereeEmail: string;
      relationship: string | null;
      subjectName: string;
      subjectDetail: string | null;
      projectTitle: string;
      supervisorName: string | null;
      applicationId: string;
    }
  | {
      kind: "profile";
      referenceId: string;
      status: "pending" | "approved" | "declined";
      respondedAt: Date | null;
      refereeName: string | null;
      refereeEmail: string;
      relationship: string | null;
      subjectName: string;
      subjectDetail: string | null;
      userId: string;
    };

/**
 * One emailed link format has to cover both kinds of request, because the person
 * clicking it has no idea which table their name landed in.
 */
export async function resolveReferenceToken(token: string): Promise<ResolvedReference | null> {
  const application = await loadReferenceByToken(token);
  if (application) {
    const subjectName = `${application.studentFirstName} ${application.studentLastName}`.trim();
    const detail = [
      application.studentProgram,
      application.studentYearLevel ? `year ${application.studentYearLevel}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    return {
      kind: "application",
      referenceId: application.reference.id,
      status: application.reference.status,
      respondedAt: application.reference.respondedAt,
      refereeName: application.reference.refereeName,
      refereeEmail: application.reference.refereeEmail,
      relationship: application.reference.relationship,
      subjectName,
      subjectDetail: detail || null,
      projectTitle: application.opportunityTitle,
      supervisorName: application.researcherFirstName
        ? `${application.researcherFirstName} ${application.researcherLastName ?? ""}`.trim()
        : null,
      applicationId: application.applicationId,
    };
  }

  const profile = await loadProfileReferenceByToken(token);
  if (!profile) return null;

  const researcherName = profile.researcherFirstName
    ? `${profile.researcherFirstName} ${profile.researcherLastName ?? ""}`.trim()
    : null;
  const studentName = profile.studentFirstName
    ? `${profile.studentFirstName} ${profile.studentLastName ?? ""}`.trim()
    : null;
  const detail =
    profile.role === "researcher"
      ? [profile.researcherTitle, profile.researcherDepartment, profile.institutionName].filter(Boolean).join(", ")
      : [profile.studentProgram, profile.institutionName].filter(Boolean).join(", ");

  return {
    kind: "profile",
    referenceId: profile.reference.id,
    status: profile.reference.status,
    respondedAt: profile.reference.respondedAt,
    refereeName: profile.reference.refereeName,
    refereeEmail: profile.reference.refereeEmail,
    relationship: profile.reference.relationship,
    subjectName: researcherName ?? studentName ?? profile.userEmail.split("@")[0],
    subjectDetail: detail || null,
    userId: profile.reference.userId,
  };
}

export async function emailForUser(userId: string): Promise<string | null> {
  const rows = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  return rows[0]?.email ?? null;
}
