import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  applicationAnswers,
  applications,
  applicationStatusHistory,
  criterionEvaluations,
  db,
  opportunities,
  opportunityCriteria,
  opportunityQuestions,
  researcherApplicationNotes,
  researcherProfiles,
  studentCourseTypes,
  studentDurations,
  studentProfiles,
  users,
} from "@/db";
import type { Criterion, CriterionResult } from "@/lib/criteria/types";

export async function loadApplication(applicationId: string) {
  const rows = await db
    .select({
      application: applications,
      opportunity: opportunities,
      researcher: researcherProfiles,
      student: studentProfiles,
      studentEmail: users.email,
    })
    .from(applications)
    .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
    .innerJoin(researcherProfiles, eq(researcherProfiles.userId, opportunities.researcherId))
    .innerJoin(studentProfiles, eq(studentProfiles.userId, applications.studentId))
    .innerJoin(users, eq(users.id, applications.studentId))
    .where(eq(applications.id, applicationId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const [questions, answers, history] = await Promise.all([
    db
      .select()
      .from(opportunityQuestions)
      .where(eq(opportunityQuestions.opportunityId, row.opportunity.id))
      .orderBy(asc(opportunityQuestions.sortOrder)),
    db.select().from(applicationAnswers).where(eq(applicationAnswers.applicationId, applicationId)),
    db
      .select()
      .from(applicationStatusHistory)
      .where(eq(applicationStatusHistory.applicationId, applicationId))
      .orderBy(desc(applicationStatusHistory.createdAt)),
  ]);

  return { ...row, questions, answers, history };
}

export type ApplicationBundle = NonNullable<Awaited<ReturnType<typeof loadApplication>>>;

export async function loadCriteria(opportunityId: string): Promise<Criterion[]> {
  const rows = await db
    .select()
    .from(opportunityCriteria)
    .where(eq(opportunityCriteria.opportunityId, opportunityId))
    .orderBy(asc(opportunityCriteria.sortOrder));

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    label: row.label,
    description: row.description,
    required: row.required,
    importance: row.importance,
    config: row.config,
    sortOrder: row.sortOrder,
  }));
}

export async function persistCriterionResults(applicationId: string, results: CriterionResult[]) {
  if (results.length === 0) return;
  for (const result of results) {
    await db
      .insert(criterionEvaluations)
      .values({
        applicationId,
        criterionId: result.criterionId,
        source: result.source,
        status: result.status,
        score: result.score !== undefined ? String(result.score) : null,
        maxScore: result.maxScore !== undefined ? String(result.maxScore) : null,
        evidence: result.evidence,
      })
      .onConflictDoUpdate({
        target: [criterionEvaluations.applicationId, criterionEvaluations.criterionId, criterionEvaluations.source],
        set: {
          status: result.status,
          score: result.score !== undefined ? String(result.score) : null,
          maxScore: result.maxScore !== undefined ? String(result.maxScore) : null,
          evidence: result.evidence,
          updatedAt: new Date(),
        },
      });
  }
}

export async function loadCriterionResults(applicationId: string): Promise<CriterionResult[]> {
  const rows = await db
    .select()
    .from(criterionEvaluations)
    .where(eq(criterionEvaluations.applicationId, applicationId));

  return rows.map((row) => ({
    criterionId: row.criterionId,
    status: row.status,
    score: row.score === null ? undefined : Number(row.score),
    maxScore: row.maxScore === null ? undefined : Number(row.maxScore),
    evidence: row.evidence ?? [],
    source: row.source,
  }));
}

export async function listStudentApplications(studentId: string) {
  return db
    .select({
      id: applications.id,
      status: applications.status,
      submittedAt: applications.submittedAt,
      updatedAt: applications.updatedAt,
      opportunityId: opportunities.id,
      opportunitySlug: opportunities.slug,
      opportunityTitle: opportunities.title,
      opportunityDeadline: opportunities.deadline,
      opportunityStatus: opportunities.status,
      department: opportunities.department,
      labName: opportunities.labName,
      compensationType: opportunities.compensationType,
      researcherFirstName: researcherProfiles.firstName,
      researcherLastName: researcherProfiles.lastName,
      researcherTitle: researcherProfiles.title,
    })
    .from(applications)
    .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
    .innerJoin(researcherProfiles, eq(researcherProfiles.userId, opportunities.researcherId))
    .where(eq(applications.studentId, studentId))
    .orderBy(desc(applications.updatedAt));
}

export async function listApplicantsForOpportunity(opportunityId: string) {
  const rows = await db
    .select({
      id: applications.id,
      status: applications.status,
      appliedCourseType: applications.courseType,
      submittedAt: applications.submittedAt,
      reviewedAt: applications.reviewedAt,
      studentId: applications.studentId,
      firstName: studentProfiles.firstName,
      lastName: studentProfiles.lastName,
      preferredName: studentProfiles.preferredName,
      program: studentProfiles.program,
      programCategory: studentProfiles.programCategory,
      yearLevel: studentProfiles.yearLevel,
      degreeLevel: studentProfiles.degreeLevel,
      weeklyHours: studentProfiles.weeklyHours,
      locationPreference: studentProfiles.locationPreference,
      profileCompletion: studentProfiles.profileCompletion,
    })
    .from(applications)
    .innerJoin(studentProfiles, eq(studentProfiles.userId, applications.studentId))
    .where(and(eq(applications.opportunityId, opportunityId), ne(applications.status, "draft")))
    .orderBy(desc(applications.submittedAt));

  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const studentIds = [...new Set(rows.map((row) => row.studentId))];
  const [answerCounts, noteCounts, courseTypeRows, durationRows] = await Promise.all([
    db
      .select({ applicationId: applicationAnswers.applicationId, count: sql<number>`count(*)::int` })
      .from(applicationAnswers)
      .where(inArray(applicationAnswers.applicationId, ids))
      .groupBy(applicationAnswers.applicationId),
    db
      .select({ applicationId: researcherApplicationNotes.applicationId, count: sql<number>`count(*)::int` })
      .from(researcherApplicationNotes)
      .where(inArray(researcherApplicationNotes.applicationId, ids))
      .groupBy(researcherApplicationNotes.applicationId),
    db
      .select({ studentId: studentCourseTypes.studentId, courseType: studentCourseTypes.courseType })
      .from(studentCourseTypes)
      .where(inArray(studentCourseTypes.studentId, studentIds)),
    db
      .select({ studentId: studentDurations.studentId, duration: studentDurations.duration })
      .from(studentDurations)
      .where(inArray(studentDurations.studentId, studentIds)),
  ]);

  const answerMap = new Map(answerCounts.map((row) => [row.applicationId, row.count]));
  const noteMap = new Map(noteCounts.map((row) => [row.applicationId, row.count]));

  const courseTypeMap = new Map<string, string[]>();
  for (const row of courseTypeRows) {
    courseTypeMap.set(row.studentId, [...(courseTypeMap.get(row.studentId) ?? []), row.courseType]);
  }
  const durationMap = new Map<string, string[]>();
  for (const row of durationRows) {
    durationMap.set(row.studentId, [...(durationMap.get(row.studentId) ?? []), row.duration]);
  }

  return rows.map((row) => ({
    ...row,
    answerCount: answerMap.get(row.id) ?? 0,
    noteCount: noteMap.get(row.id) ?? 0,
    // What the student said on this application wins over what their profile
    // lists in general, so a researcher filtering the pool sees the answer that
    // applies to their own position.
    courseTypes: row.appliedCourseType ? [row.appliedCourseType] : courseTypeMap.get(row.studentId) ?? [],
    profileCourseTypes: courseTypeMap.get(row.studentId) ?? [],
    durations: durationMap.get(row.studentId) ?? [],
  }));
}

export type ApplicantRow = Awaited<ReturnType<typeof listApplicantsForOpportunity>>[number];

export async function listResearcherNotes(applicationId: string) {
  return db
    .select({
      id: researcherApplicationNotes.id,
      note: researcherApplicationNotes.note,
      createdAt: researcherApplicationNotes.createdAt,
      researcherId: researcherApplicationNotes.researcherId,
    })
    .from(researcherApplicationNotes)
    .where(eq(researcherApplicationNotes.applicationId, applicationId))
    .orderBy(desc(researcherApplicationNotes.createdAt));
}
