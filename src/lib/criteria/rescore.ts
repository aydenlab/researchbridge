import { and, eq, inArray, ne } from "drizzle-orm";
import {
  applicationSnapshots,
  applications,
  criterionEvaluations,
  db,
  opportunityCriteria,
  researchFields,
  studentProfiles,
} from "@/db";
import { slugify } from "@/lib/format";
import type { AcademicMetric, AcademicMetricType } from "@/lib/gpa";
import { persistCriterionResults } from "@/lib/queries/applications";
import { loadStudentProfile, toApplicantEvidence } from "@/lib/queries/student";
import { evaluateDeterministic } from "./engine";
import { DETERMINISTIC_TYPES, type ApplicantEvidence, type Criterion, type CriterionResult } from "./types";
import type { DocumentedEvidence } from "@/lib/evidence/documented";
import { loadDocumentedEvidence } from "@/lib/evidence/refresh";

type SnapshotRecord = {
  metricType?: string;
  value?: string | number | null;
  scaleMax?: string | number | null;
  institutionScaleName?: string | null;
};

type Snapshot = {
  program?: string | null;
  faculty?: string | null;
  degreeLevel?: string | null;
  yearLevel?: number | null;
  graduationYear?: number | null;
  weeklyHours?: number | null;
  locationPreference?: string | null;
  desiredStartDate?: string | null;
  semesters?: string[] | null;
  summerAvailable?: boolean | null;
  skills?: { name: string; proficiency?: string | null; context?: string | null }[];
  courses?: { code: string; name: string; status: string }[];
  researchFields?: string[];
  experiences?: {
    organization: string;
    title?: string | null;
    supervisor?: string | null;
    description?: string | null;
    techniques?: string[] | null;
    outputs?: string[] | null;
  }[];
  academicRecords?: SnapshotRecord[];
  resumeFileId?: string | null;
  documented?: DocumentedEvidence;
};

function toMetric(record: SnapshotRecord): AcademicMetric | null {
  const value = Number(record.value);
  if (!record.metricType || !Number.isFinite(value)) return null;
  return {
    type: record.metricType as AcademicMetricType,
    value,
    scaleMax: record.scaleMax === null || record.scaleMax === undefined ? null : Number(record.scaleMax),
    institutionScaleName: record.institutionScaleName ?? null,
  };
}

/**
 * The evidence a student submitted, read back from the snapshot taken at
 * submission. The snapshot stores names rather than slugs, so research areas
 * are resolved against the taxonomy and skills fall back to their slug form,
 * which is how the evaluator matches them anyway.
 */
export function evidenceFromSnapshot(
  snapshot: Snapshot,
  fieldSlugs: Map<string, string>,
  documented?: DocumentedEvidence,
): ApplicantEvidence {
  return {
    program: snapshot.program ?? null,
    faculty: snapshot.faculty ?? null,
    degreeLevel: snapshot.degreeLevel ?? null,
    yearLevel: snapshot.yearLevel ?? null,
    graduationYear: snapshot.graduationYear ?? null,
    weeklyHours: snapshot.weeklyHours ?? null,
    locationPreference: snapshot.locationPreference ?? null,
    desiredStartDate: snapshot.desiredStartDate ?? null,
    semesters: snapshot.semesters ?? [],
    summerAvailable: snapshot.summerAvailable ?? null,
    skills: (snapshot.skills ?? []).map((skill) => ({
      name: skill.name,
      slug: slugify(skill.name),
      proficiency: skill.proficiency ?? null,
      context: skill.context ?? null,
    })),
    courses: (snapshot.courses ?? []).map((course) => ({
      courseCode: course.code,
      courseName: course.name,
      status: course.status,
    })),
    researchFields: (snapshot.researchFields ?? []).map((name) => ({
      name,
      slug: fieldSlugs.get(name.toLowerCase()) ?? slugify(name),
    })),
    experiences: (snapshot.experiences ?? []).map((experience) => ({
      organization: experience.organization,
      title: experience.title ?? null,
      supervisor: experience.supervisor ?? null,
      description: experience.description ?? null,
      techniques: experience.techniques ?? [],
      outputs: experience.outputs ?? [],
    })),
    academicRecords: (snapshot.academicRecords ?? [])
      .map(toMetric)
      .filter((metric): metric is AcademicMetric => metric !== null),
    // No rule-based criterion reads written answers; those are the model's job.
    answers: [],
    documented: documented ?? snapshot.documented,
  };
}

/**
 * Whether a stored snapshot actually holds a profile. Real submissions always
 * write the skills and courses lists; seeded and demo data can store a
 * placeholder instead, and reading that as evidence would mark a student as
 * having shared nothing at all.
 */
export function isProfileSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Snapshot;
  return Array.isArray(snapshot.skills) && Array.isArray(snapshot.courses);
}

function sameResult(stored: { status: string; score: string | null; evidence: string[] | null }, next: CriterionResult) {
  const storedScore = stored.score === null ? null : Number(stored.score);
  const nextScore = next.score ?? null;
  return (
    stored.status === next.status &&
    storedScore === nextScore &&
    JSON.stringify(stored.evidence ?? []) === JSON.stringify(next.evidence)
  );
}

export type SubmittedRow = { applicationId: string; studentId: string; profile: unknown };

/**
 * The evidence each submitted application is judged on: the snapshot the
 * student submitted, with the current reading of their resume when it is the
 * resume they submitted (so a model reading that finished after submission
 * counts). Applications with no real snapshot fall back to the current profile.
 * Written answers are not included; callers that need them add them.
 */
export async function loadSubmittedEvidence(rows: SubmittedRow[]): Promise<Map<string, ApplicantEvidence>> {
  const result = new Map<string, ApplicantEvidence>();
  if (rows.length === 0) return result;

  const fieldNames = new Set<string>();
  for (const row of rows) {
    if (!isProfileSnapshot(row.profile)) continue;
    for (const name of row.profile.researchFields ?? []) fieldNames.add(name);
  }
  const fieldSlugs = new Map<string, string>();
  if (fieldNames.size > 0) {
    const fieldRows = await db
      .select({ name: researchFields.name, slug: researchFields.slug })
      .from(researchFields)
      .where(inArray(researchFields.name, [...fieldNames]));
    for (const field of fieldRows) fieldSlugs.set(field.name.toLowerCase(), field.slug);
  }

  // The current reading of each student's resume. It is used for an
  // application when the resume is the one that was submitted, which also lets
  // a model reading that finished after submission count.
  const current = await loadDocumentedEvidence(rows.map((row) => row.studentId));
  const currentResume = new Map(
    (
      await db
        .select({ id: studentProfiles.userId, resumeFileId: studentProfiles.resumeFileId })
        .from(studentProfiles)
        .where(inArray(studentProfiles.userId, [...new Set(rows.map((row) => row.studentId))]))
    ).map((row) => [row.id, row.resumeFileId]),
  );

  for (const row of rows) {
    if (isProfileSnapshot(row.profile)) {
      const sameResume = (row.profile.resumeFileId ?? null) === (currentResume.get(row.studentId) ?? null);
      const documented = sameResume || !row.profile.documented ? current.get(row.studentId) : row.profile.documented;
      result.set(row.applicationId, evidenceFromSnapshot(row.profile, fieldSlugs, documented));
    } else {
      const bundle = await loadStudentProfile(row.studentId);
      if (bundle) result.set(row.applicationId, toApplicantEvidence(bundle, []));
    }
  }
  return result;
}

/**
 * Re-evaluates every rule-based criterion on every submitted application, so
 * results stored under older rules (GPA that never counted, a year of study
 * one off marked as a flat no) catch up with how criteria are judged now.
 *
 * Evidence comes from the snapshot taken at submission, which is what the
 * student actually sent; an application with no real snapshot (seeded or demo
 * data) falls back to the student's current profile. Written-response analysis is untouched.
 * Only rows whose result actually changed are written, so it is cheap to run
 * on every start.
 */
export async function rescoreDeterministicCriteria(
  options: { studentId?: string; opportunityId?: string } = {},
): Promise<{
  applications: number;
  evaluated: number;
  changed: number;
}> {
  const criterionRows = await db
    .select()
    .from(opportunityCriteria)
    .where(
      and(
        inArray(opportunityCriteria.type, DETERMINISTIC_TYPES),
        options.opportunityId ? eq(opportunityCriteria.opportunityId, options.opportunityId) : undefined,
      ),
    );
  if (criterionRows.length === 0) return { applications: 0, evaluated: 0, changed: 0 };

  const criteriaByOpportunity = new Map<string, Criterion[]>();
  for (const row of criterionRows) {
    const criterion: Criterion = {
      id: row.id,
      type: row.type,
      label: row.label,
      description: row.description,
      required: row.required,
      importance: row.importance,
      config: row.config,
      sortOrder: row.sortOrder,
    };
    criteriaByOpportunity.set(row.opportunityId, [...(criteriaByOpportunity.get(row.opportunityId) ?? []), criterion]);
  }

  const rows = await db
    .select({
      applicationId: applications.id,
      opportunityId: applications.opportunityId,
      studentId: applications.studentId,
      profile: applicationSnapshots.profile,
    })
    .from(applications)
    .leftJoin(applicationSnapshots, eq(applicationSnapshots.applicationId, applications.id))
    .where(
      and(
        inArray(applications.opportunityId, [...criteriaByOpportunity.keys()]),
        ne(applications.status, "draft"),
        options.studentId ? eq(applications.studentId, options.studentId) : undefined,
      ),
    );
  if (rows.length === 0) return { applications: 0, evaluated: 0, changed: 0 };

  const storedRows = await db
    .select({
      applicationId: criterionEvaluations.applicationId,
      criterionId: criterionEvaluations.criterionId,
      status: criterionEvaluations.status,
      score: criterionEvaluations.score,
      evidence: criterionEvaluations.evidence,
    })
    .from(criterionEvaluations)
    .where(
      and(
        inArray(
          criterionEvaluations.applicationId,
          rows.map((row) => row.applicationId),
        ),
        eq(criterionEvaluations.source, "deterministic"),
      ),
    );
  const stored = new Map(storedRows.map((row) => [`${row.applicationId}:${row.criterionId}`, row]));

  const evidenceBy = await loadSubmittedEvidence(rows);

  let evaluated = 0;
  let changed = 0;
  for (const row of rows) {
    const evidence = evidenceBy.get(row.applicationId);
    if (!evidence) continue;

    const results = evaluateDeterministic(criteriaByOpportunity.get(row.opportunityId) ?? [], evidence);
    evaluated += results.length;
    const different = results.filter((result) => {
      const previous = stored.get(`${row.applicationId}:${result.criterionId}`);
      return !previous || !sameResult(previous, result);
    });
    if (different.length > 0) {
      await persistCriterionResults(row.applicationId, different);
      changed += different.length;
    }
  }

  return { applications: rows.length, evaluated, changed };
}
