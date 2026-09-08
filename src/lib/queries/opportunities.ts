import { and, asc, desc, eq, exists, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import {
  applications,
  db,
  opportunities,
  opportunityCriteria,
  opportunityDurations,
  opportunityFields,
  opportunityQuestions,
  opportunityResearchMaterials,
  opportunityReviewTasks,
  opportunitySkills,
  researcherFields,
  researcherProfiles,
  researchFields,
  savedOpportunities,
  skills,
} from "@/db";

export type OpportunityFilters = {
  q?: string;
  kind?: "research_position" | "review_project";
  durations?: string[];
  authorshipOnly?: boolean;
  reviewTasks?: string[];
  fields?: string[];
  departments?: string[];
  compensation?: string[];
  location?: string[];
  maxHours?: number;
  beginnerOnly?: boolean;
  noPriorResearch?: boolean;
  openOnly?: boolean;
  skills?: string[];
  researcherTypes?: string[];
  yearLevel?: number;
  sort?: "recent" | "deadline" | "hours";
  page?: number;
  perPage?: number;
};

export type OpportunityListItem = {
  id: string;
  kind: string;
  slug: string;
  title: string;
  summary: string;
  department: string | null;
  labName: string | null;
  locationMode: string;
  location: string | null;
  hoursPerWeekMin: number | null;
  hoursPerWeekMax: number | null;
  deadline: string | null;
  compensationType: string;
  academicCreditAvailable: boolean;
  beginnerFriendly: boolean;
  priorResearchRequired: boolean;
  authorshipOffered: boolean;
  numberOfOpenings: number;
  publishedAt: Date | null;
  researcherFirstName: string;
  researcherLastName: string;
  researcherTitle: string | null;
  researcherType: string | null;
  fieldNames: string[];
  skillNames: string[];
  durations: string[];
  reviewTasks: string[];
};

const PER_PAGE = 12;

function baseConditions(filters: OpportunityFilters): SQL[] {
  const conditions: SQL[] = [eq(opportunities.status, "published")];

  if (filters.q) {
    const term = `%${filters.q.replace(/[%_]/g, "")}%`;
    const search = or(
      ilike(opportunities.title, term),
      ilike(opportunities.summary, term),
      ilike(opportunities.description, term),
      ilike(opportunities.department, term),
      ilike(opportunities.labName, term),
      ilike(researcherProfiles.firstName, term),
      ilike(researcherProfiles.lastName, term),
      exists(
        db
          .select({ one: sql`1` })
          .from(opportunityFields)
          .innerJoin(researchFields, eq(researchFields.id, opportunityFields.researchFieldId))
          .where(and(eq(opportunityFields.opportunityId, opportunities.id), ilike(researchFields.name, term))),
      ),
    );
    if (search) conditions.push(search);
  }

  conditions.push(eq(opportunities.kind, filters.kind ?? "research_position"));

  if (filters.durations?.length) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(opportunityDurations)
          .where(
            and(
              eq(opportunityDurations.opportunityId, opportunities.id),
              inArray(opportunityDurations.duration, filters.durations as never[]),
            ),
          ),
      ),
    );
  }

  if (filters.reviewTasks?.length) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(opportunityReviewTasks)
          .where(
            and(
              eq(opportunityReviewTasks.opportunityId, opportunities.id),
              inArray(opportunityReviewTasks.task, filters.reviewTasks as never[]),
            ),
          ),
      ),
    );
  }

  if (filters.authorshipOnly) conditions.push(eq(opportunities.authorshipOffered, true));

  if (filters.fields?.length) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(opportunityFields)
          .innerJoin(researchFields, eq(researchFields.id, opportunityFields.researchFieldId))
          .where(and(eq(opportunityFields.opportunityId, opportunities.id), inArray(researchFields.slug, filters.fields))),
      ),
    );
  }

  if (filters.skills?.length) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(opportunitySkills)
          .innerJoin(skills, eq(skills.id, opportunitySkills.skillId))
          .where(and(eq(opportunitySkills.opportunityId, opportunities.id), inArray(skills.slug, filters.skills))),
      ),
    );
  }

  if (filters.departments?.length) conditions.push(inArray(opportunities.department, filters.departments));
  if (filters.compensation?.length) {
    conditions.push(inArray(opportunities.compensationType, filters.compensation as never[]));
  }
  if (filters.location?.length) conditions.push(inArray(opportunities.locationMode, filters.location as never[]));
  if (typeof filters.maxHours === "number") {
    const clause = or(isNull(opportunities.hoursPerWeekMin), lte(opportunities.hoursPerWeekMin, filters.maxHours));
    if (clause) conditions.push(clause);
  }
  if (filters.beginnerOnly) conditions.push(eq(opportunities.beginnerFriendly, true));
  if (filters.noPriorResearch) conditions.push(eq(opportunities.priorResearchRequired, false));
  if (filters.openOnly) {
    const clause = or(isNull(opportunities.deadline), gte(opportunities.deadline, new Date().toISOString().slice(0, 10)));
    if (clause) conditions.push(clause);
  }
  if (filters.researcherTypes?.length) {
    conditions.push(inArray(researcherProfiles.researcherType, filters.researcherTypes as never[]));
  }

  return conditions;
}

export async function searchOpportunities(filters: OpportunityFilters) {
  const perPage = filters.perPage ?? PER_PAGE;
  const page = Math.max(filters.page ?? 1, 1);
  const conditions = baseConditions(filters);

  const orderBy =
    filters.sort === "deadline"
      ? [sql`${opportunities.deadline} asc nulls last`]
      : filters.sort === "hours"
        ? [sql`${opportunities.hoursPerWeekMin} asc nulls last`]
        : [desc(opportunities.publishedAt)];

  const rows = await db
    .select({
      id: opportunities.id,
      kind: opportunities.kind,
      slug: opportunities.slug,
      title: opportunities.title,
      summary: opportunities.summary,
      department: opportunities.department,
      labName: opportunities.labName,
      locationMode: opportunities.locationMode,
      location: opportunities.location,
      hoursPerWeekMin: opportunities.hoursPerWeekMin,
      hoursPerWeekMax: opportunities.hoursPerWeekMax,
      deadline: opportunities.deadline,
      compensationType: opportunities.compensationType,
      academicCreditAvailable: opportunities.academicCreditAvailable,
      beginnerFriendly: opportunities.beginnerFriendly,
      priorResearchRequired: opportunities.priorResearchRequired,
      authorshipOffered: opportunities.authorshipOffered,
      numberOfOpenings: opportunities.numberOfOpenings,
      publishedAt: opportunities.publishedAt,
      researcherFirstName: researcherProfiles.firstName,
      researcherLastName: researcherProfiles.lastName,
      researcherTitle: researcherProfiles.title,
      researcherType: researcherProfiles.researcherType,
    })
    .from(opportunities)
    .innerJoin(researcherProfiles, eq(researcherProfiles.userId, opportunities.researcherId))
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(opportunities)
    .innerJoin(researcherProfiles, eq(researcherProfiles.userId, opportunities.researcherId))
    .where(and(...conditions));

  const ids = rows.map((row) => row.id);
  const [fieldRows, skillRows, durationRows, taskRows] = ids.length
    ? await Promise.all([
        db
          .select({ opportunityId: opportunityFields.opportunityId, name: researchFields.name })
          .from(opportunityFields)
          .innerJoin(researchFields, eq(researchFields.id, opportunityFields.researchFieldId))
          .where(inArray(opportunityFields.opportunityId, ids)),
        db
          .select({
            opportunityId: opportunitySkills.opportunityId,
            name: skills.name,
            requirementLevel: opportunitySkills.requirementLevel,
          })
          .from(opportunitySkills)
          .innerJoin(skills, eq(skills.id, opportunitySkills.skillId))
          .where(inArray(opportunitySkills.opportunityId, ids)),
        db
          .select({ opportunityId: opportunityDurations.opportunityId, duration: opportunityDurations.duration })
          .from(opportunityDurations)
          .where(inArray(opportunityDurations.opportunityId, ids)),
        db
          .select({ opportunityId: opportunityReviewTasks.opportunityId, task: opportunityReviewTasks.task })
          .from(opportunityReviewTasks)
          .where(inArray(opportunityReviewTasks.opportunityId, ids)),
      ])
    : [[], [], [], []];

  const fieldsByOpportunity = new Map<string, string[]>();
  for (const row of fieldRows) {
    fieldsByOpportunity.set(row.opportunityId, [...(fieldsByOpportunity.get(row.opportunityId) ?? []), row.name]);
  }
  const skillsByOpportunity = new Map<string, string[]>();
  for (const row of skillRows) {
    if (row.requirementLevel === "not_required") continue;
    skillsByOpportunity.set(row.opportunityId, [...(skillsByOpportunity.get(row.opportunityId) ?? []), row.name]);
  }

  const durationsByOpportunity = new Map<string, string[]>();
  for (const row of durationRows) {
    durationsByOpportunity.set(row.opportunityId, [...(durationsByOpportunity.get(row.opportunityId) ?? []), row.duration]);
  }
  const tasksByOpportunity = new Map<string, string[]>();
  for (const row of taskRows) {
    tasksByOpportunity.set(row.opportunityId, [...(tasksByOpportunity.get(row.opportunityId) ?? []), row.task]);
  }

  const items: OpportunityListItem[] = rows.map((row) => ({
    ...row,
    fieldNames: fieldsByOpportunity.get(row.id) ?? [],
    skillNames: skillsByOpportunity.get(row.id) ?? [],
    durations: durationsByOpportunity.get(row.id) ?? [],
    reviewTasks: tasksByOpportunity.get(row.id) ?? [],
  }));

  return { items, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

export async function loadOpportunityBySlug(slug: string) {
  const rows = await db
    .select({
      opportunity: opportunities,
      researcher: researcherProfiles,
    })
    .from(opportunities)
    .innerJoin(researcherProfiles, eq(researcherProfiles.userId, opportunities.researcherId))
    .where(eq(opportunities.slug, slug))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return loadOpportunityDetail(row.opportunity.id);
}

export async function loadOpportunityDetail(opportunityId: string) {
  const rows = await db
    .select({ opportunity: opportunities, researcher: researcherProfiles })
    .from(opportunities)
    .innerJoin(researcherProfiles, eq(researcherProfiles.userId, opportunities.researcherId))
    .where(eq(opportunities.id, opportunityId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const [
    fieldRows,
    skillRows,
    criteriaRows,
    questionRows,
    materialRows,
    researcherFieldRows,
    durationRows,
    reviewTaskRows,
  ] = await Promise.all([
    db
      .select({ id: researchFields.id, name: researchFields.name, slug: researchFields.slug })
      .from(opportunityFields)
      .innerJoin(researchFields, eq(researchFields.id, opportunityFields.researchFieldId))
      .where(eq(opportunityFields.opportunityId, opportunityId)),
    db
      .select({
        id: skills.id,
        name: skills.name,
        slug: skills.slug,
        requirementLevel: opportunitySkills.requirementLevel,
      })
      .from(opportunitySkills)
      .innerJoin(skills, eq(skills.id, opportunitySkills.skillId))
      .where(eq(opportunitySkills.opportunityId, opportunityId))
      .orderBy(asc(skills.name)),
    db
      .select()
      .from(opportunityCriteria)
      .where(eq(opportunityCriteria.opportunityId, opportunityId))
      .orderBy(asc(opportunityCriteria.sortOrder)),
    db
      .select()
      .from(opportunityQuestions)
      .where(eq(opportunityQuestions.opportunityId, opportunityId))
      .orderBy(asc(opportunityQuestions.sortOrder)),
    db
      .select()
      .from(opportunityResearchMaterials)
      .where(eq(opportunityResearchMaterials.opportunityId, opportunityId))
      .orderBy(asc(opportunityResearchMaterials.sortOrder)),
    db
      .select({ name: researchFields.name })
      .from(researcherFields)
      .innerJoin(researchFields, eq(researchFields.id, researcherFields.researchFieldId))
      .where(eq(researcherFields.researcherId, row.researcher.userId))
      .orderBy(asc(researchFields.name)),
    db
      .select({ duration: opportunityDurations.duration })
      .from(opportunityDurations)
      .where(eq(opportunityDurations.opportunityId, opportunityId)),
    db
      .select({ task: opportunityReviewTasks.task })
      .from(opportunityReviewTasks)
      .where(eq(opportunityReviewTasks.opportunityId, opportunityId)),
  ]);

  return {
    opportunity: row.opportunity,
    researcher: row.researcher,
    fields: fieldRows,
    skills: skillRows,
    criteria: criteriaRows,
    questions: questionRows,
    materials: materialRows,
    researcherFields: researcherFieldRows.map((field) => field.name),
    durations: durationRows.map((entry) => entry.duration),
    reviewTasks: reviewTaskRows.map((entry) => entry.task),
  };
}

export type OpportunityDetail = NonNullable<Awaited<ReturnType<typeof loadOpportunityDetail>>>;

export async function studentOpportunityState(studentId: string, opportunityId: string) {
  const [savedRows, applicationRows] = await Promise.all([
    db
      .select({ createdAt: savedOpportunities.createdAt })
      .from(savedOpportunities)
      .where(and(eq(savedOpportunities.studentId, studentId), eq(savedOpportunities.opportunityId, opportunityId)))
      .limit(1),
    db
      .select({ id: applications.id, status: applications.status })
      .from(applications)
      .where(and(eq(applications.studentId, studentId), eq(applications.opportunityId, opportunityId)))
      .limit(1),
  ]);

  return {
    saved: savedRows.length > 0,
    application: applicationRows[0] ?? null,
  };
}

export async function countApplications(opportunityId: string) {
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(applications)
    .where(and(eq(applications.opportunityId, opportunityId), sql`${applications.status} <> 'draft'`));
  return total;
}
