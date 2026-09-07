import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, profileReferrals, researcherProfiles, storedFiles, studentProfiles, users } from "@/db";

export const MAX_REFERRAL_NOTE = 600;

export type ReferralRow = {
  id: string;
  referrerId: string;
  referrerName: string;
  referrerHeadline: string | null;
  note: string | null;
  letterFileId: string | null;
  letterFileName: string | null;
  createdAt: Date;
};

/**
 * Referrals shown on somebody's profile. The referrer's name is read live from
 * their account rather than copied at referral time, so a title change does not
 * leave a stale endorsement behind.
 */
export async function listReferralsFor(subjectId: string): Promise<ReferralRow[]> {
  const rows = await db
    .select({
      id: profileReferrals.id,
      referrerId: profileReferrals.referrerId,
      note: profileReferrals.note,
      letterFileId: profileReferrals.letterFileId,
      createdAt: profileReferrals.createdAt,
      email: users.email,
      role: users.role,
      researcherFirst: researcherProfiles.firstName,
      researcherLast: researcherProfiles.lastName,
      researcherTitle: researcherProfiles.title,
      researcherDepartment: researcherProfiles.department,
      studentFirst: studentProfiles.firstName,
      studentLast: studentProfiles.lastName,
      studentProgram: studentProfiles.program,
    })
    .from(profileReferrals)
    .innerJoin(users, eq(users.id, profileReferrals.referrerId))
    .leftJoin(researcherProfiles, eq(researcherProfiles.userId, users.id))
    .leftJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .where(eq(profileReferrals.subjectId, subjectId))
    .orderBy(desc(profileReferrals.createdAt));

  const fileIds = rows.map((row) => row.letterFileId).filter((id): id is string => Boolean(id));
  const fileRows = fileIds.length
    ? await db
        .select({ id: storedFiles.id, fileName: storedFiles.fileName })
        .from(storedFiles)
        .where(inArray(storedFiles.id, fileIds))
    : [];
  const fileNames = new Map(fileRows.map((row) => [row.id, row.fileName]));

  return rows.map((row) => {
    const researcher = row.researcherFirst ? `${row.researcherFirst} ${row.researcherLast ?? ""}`.trim() : null;
    const student = row.studentFirst ? `${row.studentFirst} ${row.studentLast ?? ""}`.trim() : null;
    return {
      id: row.id,
      referrerId: row.referrerId,
      referrerName: researcher ?? student ?? row.email.split("@")[0],
      referrerHeadline:
        row.role === "researcher"
          ? [row.researcherTitle, row.researcherDepartment].filter(Boolean).join(", ") || null
          : row.studentProgram,
      note: row.note,
      letterFileId: row.letterFileId,
      letterFileName: row.letterFileId ? (fileNames.get(row.letterFileId) ?? "Reference letter") : null,
      createdAt: row.createdAt,
    };
  });
}

export async function referralByReferrer(subjectId: string, referrerId: string) {
  const rows = await db
    .select()
    .from(profileReferrals)
    .where(and(eq(profileReferrals.subjectId, subjectId), eq(profileReferrals.referrerId, referrerId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function referralCounts(subjectIds: string[]): Promise<Map<string, number>> {
  if (subjectIds.length === 0) return new Map();
  const rows = await db
    .select({ subjectId: profileReferrals.subjectId, count: sql<number>`count(*)::int` })
    .from(profileReferrals)
    .where(inArray(profileReferrals.subjectId, subjectIds))
    .groupBy(profileReferrals.subjectId);
  return new Map(rows.map((row) => [row.subjectId, row.count]));
}
