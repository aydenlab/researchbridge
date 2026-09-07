import { and, asc, desc, eq, exists, ilike, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  institutions,
  researchFields,
  researcherFields,
  researcherProfiles,
  skills,
  studentCourseTypes,
  studentDurations,
  studentProfiles,
  studentResearchInterests,
  studentSkills,
  users,
} from "@/db";

const PER_PAGE = 20;

export type DirectoryFilters = {
  q?: string;
  fields?: string[];
  page?: number;
  perPage?: number;
};

export type StudentDirectoryFilters = DirectoryFilters & {
  programCategories?: string[];
  courseTypes?: string[];
  durations?: string[];
  degreeLevels?: string[];
  skills?: string[];
};

export type ResearcherDirectoryFilters = DirectoryFilters & {
  departments?: string[];
  researcherTypes?: string[];
  /** Only researchers with at least one published listing right now. */
  recruitingOnly?: boolean;
};

export type StudentDirectoryRow = {
  id: string;
  displayName: string;
  program: string | null;
  programCategory: string | null;
  degreeLevel: string | null;
  yearLevel: number | null;
  weeklyHours: number | null;
  profileCompletion: number;
  institutionName: string | null;
  fieldNames: string[];
  durations: string[];
  courseTypes: string[];
};

export type ResearcherDirectoryRow = {
  id: string;
  displayName: string;
  title: string | null;
  department: string | null;
  labName: string | null;
  institutionName: string | null;
  fieldNames: string[];
  openPositions: number;
};

function searchTerm(value: string): string {
  return `%${value.replace(/[%_]/g, "")}%`;
}

/**
 * Students browsable by a researcher. Only accounts that finished onboarding
 * appear: a half-built profile is not a candidate, and showing one wastes the
 * reviewer's attention on somebody who cannot yet be assessed.
 */
export async function searchStudents(filters: StudentDirectoryFilters) {
  const perPage = filters.perPage ?? PER_PAGE;
  const page = Math.max(filters.page ?? 1, 1);

  const conditions: SQL[] = [
    eq(users.role, "student"),
    ne(users.accountStatus, "disabled"),
    sql`${users.onboardingCompletedAt} is not null`,
  ];

  if (filters.q) {
    const term = searchTerm(filters.q);
    const search = or(
      ilike(studentProfiles.firstName, term),
      ilike(studentProfiles.lastName, term),
      ilike(studentProfiles.preferredName, term),
      ilike(studentProfiles.program, term),
      ilike(studentProfiles.specialization, term),
      ilike(studentProfiles.researchInterestSummary, term),
      exists(
        db
          .select({ one: sql`1` })
          .from(studentResearchInterests)
          .innerJoin(researchFields, eq(researchFields.id, studentResearchInterests.researchFieldId))
          .where(and(eq(studentResearchInterests.studentId, studentProfiles.userId), ilike(researchFields.name, term))),
      ),
      exists(
        db
          .select({ one: sql`1` })
          .from(studentSkills)
          .innerJoin(skills, eq(skills.id, studentSkills.skillId))
          .where(and(eq(studentSkills.studentId, studentProfiles.userId), ilike(skills.name, term))),
      ),
    );
    if (search) conditions.push(search);
  }

  if (filters.programCategories?.length) {
    conditions.push(inArray(studentProfiles.programCategory, filters.programCategories as never[]));
  }
  if (filters.degreeLevels?.length) {
    conditions.push(inArray(studentProfiles.degreeLevel, filters.degreeLevels as never[]));
  }
  if (filters.courseTypes?.length) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(studentCourseTypes)
          .where(
            and(
              eq(studentCourseTypes.studentId, studentProfiles.userId),
              inArray(studentCourseTypes.courseType, filters.courseTypes as never[]),
            ),
          ),
      ),
    );
  }
  if (filters.durations?.length) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(studentDurations)
          .where(
            and(
              eq(studentDurations.studentId, studentProfiles.userId),
              inArray(studentDurations.duration, filters.durations as never[]),
            ),
          ),
      ),
    );
  }
  if (filters.fields?.length) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(studentResearchInterests)
          .innerJoin(researchFields, eq(researchFields.id, studentResearchInterests.researchFieldId))
          .where(
            and(eq(studentResearchInterests.studentId, studentProfiles.userId), inArray(researchFields.slug, filters.fields)),
          ),
      ),
    );
  }
  if (filters.skills?.length) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(studentSkills)
          .innerJoin(skills, eq(skills.id, studentSkills.skillId))
          .where(and(eq(studentSkills.studentId, studentProfiles.userId), inArray(skills.slug, filters.skills))),
      ),
    );
  }

  const rows = await db
    .select({
      id: studentProfiles.userId,
      firstName: studentProfiles.firstName,
      lastName: studentProfiles.lastName,
      preferredName: studentProfiles.preferredName,
      program: studentProfiles.program,
      programCategory: studentProfiles.programCategory,
      degreeLevel: studentProfiles.degreeLevel,
      yearLevel: studentProfiles.yearLevel,
      weeklyHours: studentProfiles.weeklyHours,
      profileCompletion: studentProfiles.profileCompletion,
      institutionName: institutions.name,
    })
    .from(studentProfiles)
    .innerJoin(users, eq(users.id, studentProfiles.userId))
    .leftJoin(institutions, eq(institutions.id, users.institutionId))
    .where(and(...conditions))
    .orderBy(desc(studentProfiles.profileCompletion), desc(studentProfiles.updatedAt))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(studentProfiles)
    .innerJoin(users, eq(users.id, studentProfiles.userId))
    .where(and(...conditions));

  const ids = rows.map((row) => row.id);
  const [fieldRows, durationRows, courseTypeRows] = ids.length
    ? await Promise.all([
        db
          .select({ studentId: studentResearchInterests.studentId, name: researchFields.name })
          .from(studentResearchInterests)
          .innerJoin(researchFields, eq(researchFields.id, studentResearchInterests.researchFieldId))
          .where(inArray(studentResearchInterests.studentId, ids)),
        db
          .select({ studentId: studentDurations.studentId, duration: studentDurations.duration })
          .from(studentDurations)
          .where(inArray(studentDurations.studentId, ids)),
        db
          .select({ studentId: studentCourseTypes.studentId, courseType: studentCourseTypes.courseType })
          .from(studentCourseTypes)
          .where(inArray(studentCourseTypes.studentId, ids)),
      ])
    : [[], [], []];

  const collect = <T>(entries: T[], key: (row: T) => string, value: (row: T) => string) => {
    const map = new Map<string, string[]>();
    for (const row of entries) map.set(key(row), [...(map.get(key(row)) ?? []), value(row)]);
    return map;
  };

  const fieldsBy = collect(fieldRows, (row) => row.studentId, (row) => row.name);
  const durationsBy = collect(durationRows, (row) => row.studentId, (row) => row.duration);
  const courseTypesBy = collect(courseTypeRows, (row) => row.studentId, (row) => row.courseType);

  const items: StudentDirectoryRow[] = rows.map((row) => ({
    id: row.id,
    displayName: `${row.preferredName ?? row.firstName} ${row.lastName}`.trim(),
    program: row.program,
    programCategory: row.programCategory,
    degreeLevel: row.degreeLevel,
    yearLevel: row.yearLevel,
    weeklyHours: row.weeklyHours,
    profileCompletion: row.profileCompletion,
    institutionName: row.institutionName,
    fieldNames: fieldsBy.get(row.id) ?? [],
    durations: durationsBy.get(row.id) ?? [],
    courseTypes: courseTypesBy.get(row.id) ?? [],
  }));

  return { items, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

/**
 * Researchers and labs browsable by a student. Unlike the opportunity list this
 * does not require an open posting, which is the point: a student should be
 * able to find the lab first and ask second.
 */
export async function searchResearchers(filters: ResearcherDirectoryFilters) {
  const perPage = filters.perPage ?? PER_PAGE;
  const page = Math.max(filters.page ?? 1, 1);

  const conditions: SQL[] = [
    ne(users.accountStatus, "disabled"),
    eq(researcherProfiles.verificationStatus, "verified"),
  ];

  if (filters.q) {
    const term = searchTerm(filters.q);
    const search = or(
      ilike(researcherProfiles.firstName, term),
      ilike(researcherProfiles.lastName, term),
      ilike(researcherProfiles.labName, term),
      ilike(researcherProfiles.department, term),
      ilike(researcherProfiles.title, term),
      ilike(researcherProfiles.biography, term),
      exists(
        db
          .select({ one: sql`1` })
          .from(researcherFields)
          .innerJoin(researchFields, eq(researchFields.id, researcherFields.researchFieldId))
          .where(and(eq(researcherFields.researcherId, researcherProfiles.userId), ilike(researchFields.name, term))),
      ),
    );
    if (search) conditions.push(search);
  }

  if (filters.departments?.length) conditions.push(inArray(researcherProfiles.department, filters.departments));
  if (filters.researcherTypes?.length) {
    conditions.push(inArray(researcherProfiles.researcherType, filters.researcherTypes as never[]));
  }
  if (filters.fields?.length) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(researcherFields)
          .innerJoin(researchFields, eq(researchFields.id, researcherFields.researchFieldId))
          .where(and(eq(researcherFields.researcherId, researcherProfiles.userId), inArray(researchFields.slug, filters.fields))),
      ),
    );
  }

  const openCount = sql<number>`(
    select count(*)::int from "opportunities" o
    where o."researcher_id" = ${researcherProfiles.userId} and o."status" = 'published'
  )`;

  if (filters.recruitingOnly) conditions.push(sql`${openCount} > 0`);

  const rows = await db
    .select({
      id: researcherProfiles.userId,
      firstName: researcherProfiles.firstName,
      lastName: researcherProfiles.lastName,
      title: researcherProfiles.title,
      department: researcherProfiles.department,
      labName: researcherProfiles.labName,
      institutionName: institutions.name,
      openPositions: openCount,
    })
    .from(researcherProfiles)
    .innerJoin(users, eq(users.id, researcherProfiles.userId))
    .leftJoin(institutions, eq(institutions.id, users.institutionId))
    .where(and(...conditions))
    .orderBy(desc(openCount), asc(researcherProfiles.lastName))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(researcherProfiles)
    .innerJoin(users, eq(users.id, researcherProfiles.userId))
    .where(and(...conditions));

  const ids = rows.map((row) => row.id);
  const fieldRows = ids.length
    ? await db
        .select({ researcherId: researcherFields.researcherId, name: researchFields.name })
        .from(researcherFields)
        .innerJoin(researchFields, eq(researchFields.id, researcherFields.researchFieldId))
        .where(inArray(researcherFields.researcherId, ids))
    : [];

  const fieldsBy = new Map<string, string[]>();
  for (const row of fieldRows) {
    fieldsBy.set(row.researcherId, [...(fieldsBy.get(row.researcherId) ?? []), row.name]);
  }

  const items: ResearcherDirectoryRow[] = rows.map((row) => ({
    id: row.id,
    displayName: `${row.firstName} ${row.lastName}`.trim(),
    title: row.title,
    department: row.department,
    labName: row.labName,
    institutionName: row.institutionName,
    fieldNames: fieldsBy.get(row.id) ?? [],
    openPositions: Number(row.openPositions),
  }));

  return { items, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}
