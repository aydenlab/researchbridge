import { and, desc, eq, exists, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { applications, db, opportunities, studentCourseTypes, studentProfiles } from "@/db";
import { APPLICATION_STATUSES, isActive } from "@/lib/application-status";

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


const APPLICANTS_PER_PAGE = 25;

const ACTIVE_STATUSES = APPLICATION_STATUSES.filter((status) => isActive(status));

export type AllApplicantFilters = {
  /** "" for everyone, or one of the status groupings the tabs offer. */
  filter?: string;
  courseTypes?: string[];
  programCategories?: string[];
  page?: number;
  perPage?: number;
};

export type AllApplicantRow = {
  id: string;
  status: string;
  submittedAt: Date | null;
  opportunityId: string;
  opportunityTitle: string;
  studentId: string;
  displayName: string;
  program: string | null;
  programCategory: string | null;
  yearLevel: number | null;
  weeklyHours: number | null;
  locationPreference: string | null;
  /** What this student is applying as, falling back to what their profile says. */
  courseTypes: string[];
};

/**
 * Every applicant across every position a researcher controls.
 *
 * Course type is filtered the same way the per-position rail reads it: the
 * answer given on this application wins, and only when it was left blank does
 * the profile stand in. Doing that in SQL rather than in the browser is what
 * lets this page paginate, which it has to, because a lab with a few open
 * positions can pass a couple of hundred applicants in a season.
 */
export async function listAllApplicants(researcherId: string, filters: AllApplicantFilters = {}) {
  const perPage = filters.perPage ?? APPLICANTS_PER_PAGE;
  const page = Math.max(filters.page ?? 1, 1);

  const conditions: SQL[] = [eq(opportunities.researcherId, researcherId), ne(applications.status, "draft")];

  if (filters.filter === "awaiting") {
    conditions.push(eq(applications.status, "submitted"));
  } else if (filters.filter === "active") {
    // Derived from the shared helper so the tab and the badge can never drift.
    conditions.push(inArray(applications.status, ACTIVE_STATUSES as never[]));
  }

  if (filters.programCategories?.length) {
    conditions.push(inArray(studentProfiles.programCategory, filters.programCategories as never[]));
  }

  if (filters.courseTypes?.length) {
    const wanted = filters.courseTypes as never[];
    const applied = and(
      sql`${applications.courseType} is not null`,
      inArray(applications.courseType, wanted),
    );
    const fromProfile = and(
      sql`${applications.courseType} is null`,
      exists(
        db
          .select({ one: sql`1` })
          .from(studentCourseTypes)
          .where(
            and(
              eq(studentCourseTypes.studentId, applications.studentId),
              inArray(studentCourseTypes.courseType, wanted),
            ),
          ),
      ),
    );
    const either = or(applied, fromProfile);
    if (either) conditions.push(either);
  }

  const rows = await db
    .select({
      id: applications.id,
      status: applications.status,
      submittedAt: applications.submittedAt,
      appliedCourseType: applications.courseType,
      studentId: applications.studentId,
      opportunityId: opportunities.id,
      opportunityTitle: opportunities.title,
      firstName: studentProfiles.firstName,
      lastName: studentProfiles.lastName,
      preferredName: studentProfiles.preferredName,
      program: studentProfiles.program,
      programCategory: studentProfiles.programCategory,
      yearLevel: studentProfiles.yearLevel,
      weeklyHours: studentProfiles.weeklyHours,
      locationPreference: studentProfiles.locationPreference,
    })
    .from(applications)
    .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
    .innerJoin(studentProfiles, eq(studentProfiles.userId, applications.studentId))
    .where(and(...conditions))
    .orderBy(desc(applications.submittedAt))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(applications)
    .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
    .innerJoin(studentProfiles, eq(studentProfiles.userId, applications.studentId))
    .where(and(...conditions));

  const studentIds = [...new Set(rows.filter((row) => !row.appliedCourseType).map((row) => row.studentId))];
  const profileCourseTypes = studentIds.length
    ? await db
        .select({ studentId: studentCourseTypes.studentId, courseType: studentCourseTypes.courseType })
        .from(studentCourseTypes)
        .where(inArray(studentCourseTypes.studentId, studentIds))
    : [];

  const profileBy = new Map<string, string[]>();
  for (const row of profileCourseTypes) {
    profileBy.set(row.studentId, [...(profileBy.get(row.studentId) ?? []), row.courseType]);
  }

  const items: AllApplicantRow[] = rows.map((row) => ({
    id: row.id,
    status: row.status,
    submittedAt: row.submittedAt,
    opportunityId: row.opportunityId,
    opportunityTitle: row.opportunityTitle,
    studentId: row.studentId,
    displayName: `${row.preferredName ?? row.firstName} ${row.lastName}`.trim(),
    program: row.program,
    programCategory: row.programCategory,
    yearLevel: row.yearLevel,
    weeklyHours: row.weeklyHours,
    locationPreference: row.locationPreference,
    courseTypes: row.appliedCourseType ? [row.appliedCourseType] : profileBy.get(row.studentId) ?? [],
  }));

  return { items, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

/** Tab counts, which have to ignore the status filter to stay meaningful. */
export async function applicantStatusCounts(researcherId: string, filters: AllApplicantFilters = {}) {
  const all = await listAllApplicants(researcherId, { ...filters, filter: "", perPage: 1, page: 1 });
  const awaiting = await listAllApplicants(researcherId, { ...filters, filter: "awaiting", perPage: 1, page: 1 });
  const active = await listAllApplicants(researcherId, { ...filters, filter: "active", perPage: 1, page: 1 });
  return { all: all.total, awaiting: awaiting.total, active: active.total };
}
