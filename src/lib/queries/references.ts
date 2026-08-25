import { and, asc, eq, inArray } from "drizzle-orm";
import {
  applicationReferences,
  applications,
  db,
  opportunities,
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
