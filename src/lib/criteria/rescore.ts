import { and, eq, inArray, ne } from "drizzle-orm";
import { applicationSnapshots, applications, db, opportunityCriteria } from "@/db";
import type { AcademicMetric, AcademicMetricType } from "@/lib/gpa";
import { persistCriterionResults } from "@/lib/queries/applications";
import { evaluateDeterministic } from "./engine";
import type { ApplicantEvidence, Criterion } from "./types";

type SnapshotRecord = {
  metricType?: string;
  value?: string | number | null;
  scaleMax?: string | number | null;
  institutionScaleName?: string | null;
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
 * Re-evaluates every academic standing criterion on every submitted
 * application, from the profile snapshot taken when it was submitted.
 *
 * Academic standing used to come back "no information" whenever a posting
 * weighted GPA without a minimum, or when the student's scale differed from the
 * minimum's, so stored results from before the fix say nothing at all. The
 * snapshot is what the student actually submitted, so re-reading it changes
 * the judgement without changing the evidence. Safe to run more than once.
 */
export async function rescoreAcademicCriteria(): Promise<{ applications: number; results: number }> {
  const criterionRows = await db
    .select()
    .from(opportunityCriteria)
    .where(eq(opportunityCriteria.type, "academic_metric"));
  if (criterionRows.length === 0) return { applications: 0, results: 0 };

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
      profile: applicationSnapshots.profile,
    })
    .from(applications)
    .innerJoin(applicationSnapshots, eq(applicationSnapshots.applicationId, applications.id))
    .where(
      and(inArray(applications.opportunityId, [...criteriaByOpportunity.keys()]), ne(applications.status, "draft")),
    );

  let results = 0;
  for (const row of rows) {
    const criteria = criteriaByOpportunity.get(row.opportunityId) ?? [];
    const records = Array.isArray(row.profile.academicRecords) ? (row.profile.academicRecords as SnapshotRecord[]) : [];
    // Only academic standing is evaluated, so the rest of the evidence can be empty.
    const evidence = {
      academicRecords: records.map(toMetric).filter((metric): metric is AcademicMetric => metric !== null),
    } as ApplicantEvidence;
    const evaluated = evaluateDeterministic(criteria, evidence);
    await persistCriterionResults(row.applicationId, evaluated);
    results += evaluated.length;
  }

  return { applications: rows.length, results };
}
