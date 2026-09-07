import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { applications, db, opportunities, studentProfiles } from "@/db";

export async function researcherOpportunities(researcherId: string) {
  const rows = await db
    .select({
      id: opportunities.id,
      slug: opportunities.slug,
      title: opportunities.title,
      summary: opportunities.summary,
      kind: opportunities.kind,
      authorshipOffered: opportunities.authorshipOffered,
      status: opportunities.status,
      deadline: opportunities.deadline,
      numberOfOpenings: opportunities.numberOfOpenings,
      compensationType: opportunities.compensationType,
      locationMode: opportunities.locationMode,
      hoursPerWeekMin: opportunities.hoursPerWeekMin,
      hoursPerWeekMax: opportunities.hoursPerWeekMax,
      publishedAt: opportunities.publishedAt,
      updatedAt: opportunities.updatedAt,
      draftStep: opportunities.draftStep,
      viewCount: opportunities.viewCount,
    })
    .from(opportunities)
    .where(eq(opportunities.researcherId, researcherId))
    .orderBy(desc(opportunities.updatedAt));

  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const counts = await db
    .select({
      opportunityId: applications.opportunityId,
      total: sql<number>`count(*) filter (where ${applications.status} <> 'draft')::int`,
      awaiting: sql<number>`count(*) filter (where ${applications.status} = 'submitted')::int`,
      shortlisted: sql<number>`count(*) filter (where ${applications.status} in ('shortlisted','researcher_contacted','interview'))::int`,
      accepted: sql<number>`count(*) filter (where ${applications.status} = 'accepted')::int`,
    })
    .from(applications)
    .where(inArray(applications.opportunityId, ids))
    .groupBy(applications.opportunityId);

  const map = new Map(counts.map((row) => [row.opportunityId, row]));

  return rows.map((row) => ({
    ...row,
    applicationCount: map.get(row.id)?.total ?? 0,
    awaitingReview: map.get(row.id)?.awaiting ?? 0,
    shortlistedCount: map.get(row.id)?.shortlisted ?? 0,
    acceptedCount: map.get(row.id)?.accepted ?? 0,
  }));
}

export type ResearcherOpportunityRow = Awaited<ReturnType<typeof researcherOpportunities>>[number];

export async function researcherRecentApplicants(researcherId: string, limit = 8) {
  return db
    .select({
      id: applications.id,
      status: applications.status,
      submittedAt: applications.submittedAt,
      opportunityId: opportunities.id,
      opportunityTitle: opportunities.title,
      firstName: studentProfiles.firstName,
      lastName: studentProfiles.lastName,
      preferredName: studentProfiles.preferredName,
      program: studentProfiles.program,
      yearLevel: studentProfiles.yearLevel,
    })
    .from(applications)
    .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
    .innerJoin(studentProfiles, eq(studentProfiles.userId, applications.studentId))
    .where(and(eq(opportunities.researcherId, researcherId), ne(applications.status, "draft")))
    .orderBy(desc(applications.submittedAt))
    .limit(limit);
}
