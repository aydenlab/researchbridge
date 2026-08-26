import { and, count, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import {
  applications,
  applicationStatusHistory,
  db,
  institutions,
  opportunities,
  placementOutcomes,
  researcherProfiles,
  studentProfiles,
  users,
  waitlistEntries,
} from "@/db";

export type PilotMetric = {
  label: string;
  value: string;
  detail?: string;
  known: boolean;
};

async function scalar(query: Promise<{ value: number }[]>): Promise<number> {
  const rows = await query;
  return rows[0]?.value ?? 0;
}

export async function pilotMetrics(): Promise<{
  headline: PilotMetric[];
  funnel: PilotMetric[];
  outcomes: PilotMetric[];
  timing: PilotMetric[];
}> {
  const [
    verifiedStudents,
    completedStudentProfiles,
    verifiedResearchers,
    pendingResearchers,
    activeResearchers,
    publishedOpportunities,
    draftOpportunities,
    submittedApplications,
    contactedApplications,
    acceptedApplications,
    confirmedPlacements,
    paidPlacements,
    wouldUseAgain,
    outcomeResponses,
    waitlistStudents,
    waitlistResearchers,
  ] = await Promise.all([
    scalar(db.select({ value: count() }).from(users).where(and(eq(users.role, "student"), isNotNull(users.emailVerifiedAt)))),
    scalar(db.select({ value: count() }).from(studentProfiles).where(sql`${studentProfiles.profileCompletion} >= 80`)),
    scalar(db.select({ value: count() }).from(researcherProfiles).where(eq(researcherProfiles.verificationStatus, "verified"))),
    scalar(db.select({ value: count() }).from(researcherProfiles).where(sql`${researcherProfiles.verificationStatus} in ('pending','needs_review')`)),
    scalar(
      db
        .select({ value: sql<number>`count(distinct ${opportunities.researcherId})::int` })
        .from(opportunities)
        .where(eq(opportunities.status, "published")),
    ),
    scalar(db.select({ value: count() }).from(opportunities).where(eq(opportunities.status, "published"))),
    scalar(db.select({ value: count() }).from(opportunities).where(eq(opportunities.status, "draft"))),
    scalar(db.select({ value: count() }).from(applications).where(ne(applications.status, "draft"))),
    scalar(db.select({ value: count() }).from(applications).where(isNotNull(applications.contactedAt))),
    scalar(db.select({ value: count() }).from(applications).where(eq(applications.status, "accepted"))),
    scalar(db.select({ value: count() }).from(placementOutcomes).where(eq(placementOutcomes.confirmed, true))),
    scalar(
      db
        .select({ value: count() })
        .from(placementOutcomes)
        .where(and(eq(placementOutcomes.confirmed, true), sql`${placementOutcomes.positionType} in ('paid','work_study','grant_funded')`)),
    ),
    scalar(
      db
        .select({ value: count() })
        .from(placementOutcomes)
        .where(sql`${placementOutcomes.studentWouldUseAgain} is true or ${placementOutcomes.researcherWouldUseAgain} is true`),
    ),
    scalar(db.select({ value: count() }).from(placementOutcomes)),
    scalar(db.select({ value: count() }).from(waitlistEntries).where(eq(waitlistEntries.kind, "student"))),
    scalar(db.select({ value: count() }).from(waitlistEntries).where(eq(waitlistEntries.kind, "researcher"))),
  ]);

  const perOpportunity = publishedOpportunities > 0 ? submittedApplications / publishedOpportunities : 0;
  const perStudent = verifiedStudents > 0 ? submittedApplications / verifiedStudents : 0;
  const responseRate = submittedApplications > 0 ? (contactedApplications / submittedApplications) * 100 : null;

  const timingRows = await db
    .select({
      avgFirstAction: sql<string | null>`avg(extract(epoch from (${applications.reviewedAt} - ${applications.submittedAt})) / 3600.0)`,
      avgContact: sql<string | null>`avg(extract(epoch from (${applications.contactedAt} - ${applications.submittedAt})) / 3600.0)`,
    })
    .from(applications)
    .where(isNotNull(applications.submittedAt));

  const firstApplicationRows = await db
    .select({
      avgHours: sql<string | null>`avg(extract(epoch from (${applications.submittedAt} - ${opportunities.publishedAt})) / 3600.0)`,
    })
    .from(applications)
    .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
    .where(
      and(
        isNotNull(applications.submittedAt),
        isNotNull(opportunities.publishedAt),
        sql`${applications.submittedAt} >= ${opportunities.publishedAt}`,
      ),
    );

  const fmtHours = (raw: number | string | null | undefined) => {
    if (raw === null || raw === undefined) return { value: "Not known yet", known: false };
    const value = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(value) || value < 0) return { value: "Not known yet", known: false };
    return value < 48
      ? { value: `${value.toFixed(1)} hours`, known: true }
      : { value: `${(value / 24).toFixed(1)} days`, known: true };
  };

  const firstAction = fmtHours(timingRows[0]?.avgFirstAction);
  const contactTiming = fmtHours(timingRows[0]?.avgContact);
  const firstApplication = fmtHours(firstApplicationRows[0]?.avgHours);

  return {
    headline: [
      { label: "Verified students", value: String(verifiedStudents), known: true },
      { label: "Verified researchers", value: String(verifiedResearchers), detail: `${pendingResearchers} awaiting review`, known: true },
      { label: "Published positions", value: String(publishedOpportunities), detail: `${draftOpportunities} in draft`, known: true },
      { label: "Confirmed placements", value: String(confirmedPlacements), detail: "The pilot's core measure", known: true },
    ],
    funnel: [
      { label: "Student profiles at least 80 percent complete", value: String(completedStudentProfiles), known: true },
      { label: "Researchers with a live position", value: String(activeResearchers), known: true },
      { label: "Applications submitted", value: String(submittedApplications), known: true },
      { label: "Average applications per position", value: publishedOpportunities > 0 ? perOpportunity.toFixed(1) : "Not known yet", known: publishedOpportunities > 0 },
      { label: "Average applications per student", value: verifiedStudents > 0 ? perStudent.toFixed(1) : "Not known yet", known: verifiedStudents > 0 },
      { label: "Students on the waitlist", value: String(waitlistStudents), known: true },
      { label: "Researchers who registered interest", value: String(waitlistResearchers), known: true },
    ],
    outcomes: [
      { label: "Students contacted by a researcher", value: String(contactedApplications), known: true },
      { label: "Offers made", value: String(acceptedApplications), known: true },
      { label: "Confirmed placements", value: String(confirmedPlacements), known: true },
      { label: "Paid placements", value: String(paidPlacements), detail: "Of the confirmed placements", known: true },
      {
        label: "Would use ResearchBridge again",
        value: outcomeResponses > 0 ? `${wouldUseAgain} of ${outcomeResponses} responses` : "Not known yet",
        detail: "Self-reported",
        known: outcomeResponses > 0,
      },
      {
        label: "Researcher response rate",
        value: responseRate === null ? "Not known yet" : `${responseRate.toFixed(0)} percent`,
        detail: "Applications where the researcher reached out",
        known: responseRate !== null,
      },
    ],
    timing: [
      { label: "Time to first researcher action", value: firstAction.value, detail: "From submission to first review", known: firstAction.known },
      { label: "Time to researcher contact", value: contactTiming.value, detail: "From submission to contact", known: contactTiming.known },
      { label: "Time to first application", value: firstApplication.value, detail: "From publication to first application", known: firstApplication.known },
      { label: "Time to fill", value: "Not known yet", detail: "Requires confirmed placement dates", known: false },
    ],
  };
}

export async function pendingResearchers() {
  return db
    .select({
      userId: researcherProfiles.userId,
      firstName: researcherProfiles.firstName,
      lastName: researcherProfiles.lastName,
      title: researcherProfiles.title,
      department: researcherProfiles.department,
      faculty: researcherProfiles.faculty,
      labName: researcherProfiles.labName,
      labWebsite: researcherProfiles.labWebsite,
      researcherType: researcherProfiles.researcherType,
      biography: researcherProfiles.biography,
      verificationStatus: researcherProfiles.verificationStatus,
      verificationNotes: researcherProfiles.verificationNotes,
      createdAt: researcherProfiles.createdAt,
      email: users.email,
      institutionName: institutions.name,
    })
    .from(researcherProfiles)
    .innerJoin(users, eq(users.id, researcherProfiles.userId))
    .leftJoin(institutions, eq(institutions.id, users.institutionId))
    .orderBy(desc(researcherProfiles.createdAt));
}

export async function adminUsers(role?: string, search?: string) {
  const conditions = [];
  if (role && ["student", "researcher", "admin"].includes(role)) {
    conditions.push(eq(users.role, role as "student" | "researcher" | "admin"));
  }
  if (search) {
    conditions.push(sql`${users.email} ilike ${`%${search.replace(/[%_]/g, "")}%`}`);
  }

  return db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      accountStatus: users.accountStatus,
      emailVerifiedAt: users.emailVerifiedAt,
      onboardingCompletedAt: users.onboardingCompletedAt,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      institutionName: institutions.name,
      studentFirst: studentProfiles.firstName,
      studentLast: studentProfiles.lastName,
      studentProgram: studentProfiles.program,
      studentCompletion: studentProfiles.profileCompletion,
      researcherFirst: researcherProfiles.firstName,
      researcherLast: researcherProfiles.lastName,
      researcherStatus: researcherProfiles.verificationStatus,
    })
    .from(users)
    .leftJoin(institutions, eq(institutions.id, users.institutionId))
    .leftJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .leftJoin(researcherProfiles, eq(researcherProfiles.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(300);
}

export async function adminOpportunities(status?: string) {
  const conditions = [];
  if (status && ["draft", "published", "closed", "unpublished", "archived"].includes(status)) {
    conditions.push(eq(opportunities.status, status as "draft" | "published" | "closed" | "unpublished" | "archived"));
  }

  const rows = await db
    .select({
      id: opportunities.id,
      slug: opportunities.slug,
      title: opportunities.title,
      status: opportunities.status,
      department: opportunities.department,
      compensationType: opportunities.compensationType,
      deadline: opportunities.deadline,
      publishedAt: opportunities.publishedAt,
      createdAt: opportunities.createdAt,
      viewCount: opportunities.viewCount,
      researcherFirst: researcherProfiles.firstName,
      researcherLast: researcherProfiles.lastName,
      institutionName: institutions.name,
    })
    .from(opportunities)
    .innerJoin(researcherProfiles, eq(researcherProfiles.userId, opportunities.researcherId))
    .leftJoin(institutions, eq(institutions.id, opportunities.institutionId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(opportunities.createdAt))
    .limit(300);

  const counts = await db
    .select({ opportunityId: applications.opportunityId, value: count() })
    .from(applications)
    .where(ne(applications.status, "draft"))
    .groupBy(applications.opportunityId);
  const map = new Map(counts.map((row) => [row.opportunityId, row.value]));

  return rows.map((row) => ({ ...row, applicationCount: map.get(row.id) ?? 0 }));
}

export async function adminApplications() {
  return db
    .select({
      id: applications.id,
      status: applications.status,
      submittedAt: applications.submittedAt,
      opportunityTitle: opportunities.title,
      opportunityId: opportunities.id,
      researcherFirst: researcherProfiles.firstName,
      researcherLast: researcherProfiles.lastName,
      studentFirst: studentProfiles.firstName,
      studentLast: studentProfiles.lastName,
      studentProgram: studentProfiles.program,
      institutionName: institutions.name,
    })
    .from(applications)
    .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
    .innerJoin(researcherProfiles, eq(researcherProfiles.userId, opportunities.researcherId))
    .innerJoin(studentProfiles, eq(studentProfiles.userId, applications.studentId))
    .leftJoin(institutions, eq(institutions.id, opportunities.institutionId))
    .where(ne(applications.status, "draft"))
    .orderBy(desc(applications.submittedAt))
    .limit(300);
}

export async function statusDistribution() {
  return db
    .select({ status: applications.status, value: count() })
    .from(applications)
    .where(ne(applications.status, "draft"))
    .groupBy(applications.status);
}

export async function recentStatusChanges(limit = 15) {
  return db
    .select({
      id: applicationStatusHistory.id,
      newStatus: applicationStatusHistory.newStatus,
      previousStatus: applicationStatusHistory.previousStatus,
      createdAt: applicationStatusHistory.createdAt,
      opportunityTitle: opportunities.title,
    })
    .from(applicationStatusHistory)
    .innerJoin(applications, eq(applications.id, applicationStatusHistory.applicationId))
    .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
    .orderBy(desc(applicationStatusHistory.createdAt))
    .limit(limit);
}
