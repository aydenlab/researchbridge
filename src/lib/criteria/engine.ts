import {
  academicStrength,
  compareToMinimum,
  FAIR_TWELVE_POINT,
  formatMetric,
  STRONG_TWELVE_POINT,
  toTwelvePointEquivalent,
  type AcademicMetric,
  type AcademicMetricType,
} from "@/lib/gpa";
import type {
  AcademicMetricConfig,
  ApplicantEvidence,
  AvailabilityConfig,
  Criterion,
  CriterionResult,
  CourseworkConfig,
  PriorResearchConfig,
  ProgramConfig,
  ResearchInterestConfig,
  SkillConfig,
  YearLevelConfig,
} from "./types";
import { weightOf, STATUS_FACTOR } from "./weights";
import { describeTrackRecord, documentsSkill, hasDocumentation } from "@/lib/evidence/documented";

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function result(
  criterion: Criterion,
  status: CriterionResult["status"],
  evidence: string[],
  /** A graded share of the weight, for criteria that are not simply met or not. */
  graded?: number,
): CriterionResult {
  const maxScore = criterion.required ? undefined : weightOf(criterion);
  const factor = graded ?? STATUS_FACTOR[status];
  return {
    criterionId: criterion.id,
    status,
    evidence,
    source: "deterministic",
    maxScore,
    score: maxScore !== undefined && factor !== null ? Math.round(maxScore * factor * 1000) / 1000 : undefined,
  };
}

function evaluateSkill(criterion: Criterion, evidence: ApplicantEvidence): CriterionResult {
  const config = criterion.config as SkillConfig;
  const name = config.skillName ?? criterion.label;
  if (!name) return result(criterion, "unknown", ["This criterion has no skill configured."]);

  // Judged on what the resume and research history show. The typed skills list
  // is easy to pad and often incomplete, so it never decides this.
  const documented = evidence.documented;
  const selfListed = evidence.skills.some(
    (skill) => normalize(skill.name) === normalize(name) || (config.skillSlug && skill.slug === config.skillSlug),
  );
  if (!documented || !hasDocumentation(documented)) {
    return result(criterion, "unknown", [
      `No resume or research experience on file to show ${name}.${selfListed ? " It is listed on the profile, which is not used for matching." : ""}`,
    ]);
  }

  const quote = documentsSkill(documented, name);
  if (quote) {
    return result(criterion, "met", [`${documented.hasResume ? "Resume" : "Research experience"}: ${quote}`]);
  }
  return result(criterion, "not_met", [
    `${name} does not appear in the ${documented.hasResume ? "resume or research experience" : "research experience"}.${
      selfListed ? " It is listed on the profile, which is not used for matching." : ""
    }`,
  ]);
}

function evaluateCoursework(criterion: Criterion, evidence: ApplicantEvidence): CriterionResult {
  const config = criterion.config as CourseworkConfig;
  const wanted = (config.courseCodes ?? []).map(normalize);
  if (wanted.length === 0) return result(criterion, "unknown", ["This criterion has no course configured."]);
  if (evidence.courses.length === 0) {
    return result(criterion, "unknown", ["No coursework listed on this profile."]);
  }

  const completed = evidence.courses.filter((course) => wanted.includes(normalize(course.courseCode)));
  if (completed.length === 0) {
    return result(criterion, "not_met", [`None of ${config.courseCodes?.join(", ")} appear in listed coursework.`]);
  }
  const done = completed.filter((course) => course.status === "completed");
  if (done.length === 0) {
    return result(
      criterion,
      "partially_met",
      completed.map((course) => `${course.courseCode} listed as ${course.status.replace("_", " ")}.`),
    );
  }
  return result(
    criterion,
    "met",
    done.map((course) => `${course.courseCode} ${course.courseName} listed under completed coursework.`),
  );
}

function evaluateProgram(criterion: Criterion, evidence: ApplicantEvidence): CriterionResult {
  const config = criterion.config as ProgramConfig;
  const wanted = (config.programs ?? []).map(normalize);
  if (wanted.length === 0) return result(criterion, "unknown", ["This criterion has no program configured."]);
  if (!evidence.program) return result(criterion, "unknown", ["No program listed on this profile."]);

  const program = normalize(evidence.program);
  const faculty = evidence.faculty ? normalize(evidence.faculty) : "";
  const direct = wanted.some((want) => program.includes(want) || want.includes(program));
  if (direct) return result(criterion, "met", [`Program listed as ${evidence.program}.`]);
  const viaFaculty = faculty && wanted.some((want) => faculty.includes(want));
  if (viaFaculty) return result(criterion, "partially_met", [`Faculty listed as ${evidence.faculty}.`]);
  return result(criterion, "not_met", [`Program listed as ${evidence.program}.`]);
}

function evaluateYearLevel(criterion: Criterion, evidence: ApplicantEvidence): CriterionResult {
  const config = criterion.config as YearLevelConfig;
  if (evidence.yearLevel === null) return result(criterion, "unknown", ["No year of study listed on this profile."]);
  const min = config.minYear ?? null;
  const max = config.maxYear ?? null;
  const withinMin = min === null || evidence.yearLevel >= min;
  const withinMax = max === null || evidence.yearLevel <= max;
  const range = [min !== null ? `year ${min} or above` : null, max !== null ? `year ${max} or below` : null]
    .filter(Boolean)
    .join(" and ");
  if (withinMin && withinMax) {
    return result(criterion, "met", [`Student is in year ${evidence.yearLevel}. Requested ${range || "any year"}.`]);
  }
  // One year either side is close enough to be worth a reviewer's look rather
  // than a flat no: a strong second year applying to a "year 3 and up" project
  // is exactly who a supervisor may want to hear from.
  const offBy = Math.max(min !== null ? min - evidence.yearLevel : 0, max !== null ? evidence.yearLevel - max : 0);
  if (offBy === 1) {
    return result(criterion, "partially_met", [`Student is in year ${evidence.yearLevel}. Requested ${range}.`]);
  }
  return result(criterion, "not_met", [`Student is in year ${evidence.yearLevel}. Requested ${range}.`]);
}

function evaluateAvailability(criterion: Criterion, evidence: ApplicantEvidence): CriterionResult {
  const config = criterion.config as AvailabilityConfig;
  const evidenceLines: string[] = [];
  let status: CriterionResult["status"] = "met";

  if (typeof config.minHoursPerWeek === "number") {
    if (evidence.weeklyHours === null) {
      evidenceLines.push("No weekly availability listed on this profile.");
      status = "unknown";
    } else if (evidence.weeklyHours >= config.minHoursPerWeek) {
      evidenceLines.push(
        `Student availability: ${evidence.weeklyHours} hours per week. Requested minimum ${config.minHoursPerWeek}.`,
      );
    } else {
      evidenceLines.push(
        `Student availability: ${evidence.weeklyHours} hours per week. Requested minimum ${config.minHoursPerWeek}.`,
      );
      status = "not_met";
    }
  }

  if (config.locationModes && config.locationModes.length > 0) {
    if (!evidence.locationPreference) {
      evidenceLines.push("No location preference listed on this profile.");
      if (status === "met") status = "unknown";
    } else if (config.locationModes.includes(evidence.locationPreference)) {
      evidenceLines.push(`Location preference: ${evidence.locationPreference.replace("_", " ")}.`);
    } else {
      evidenceLines.push(
        `Location preference: ${evidence.locationPreference.replace("_", " ")}. This position is ${config.locationModes.join(" or ").replace(/_/g, " ")}.`,
      );
      status = status === "not_met" ? "not_met" : "partially_met";
    }
  }

  if (evidenceLines.length === 0) {
    return result(criterion, "unknown", ["This criterion has no availability threshold configured."]);
  }
  return result(criterion, status, evidenceLines);
}

function evaluatePriorResearch(criterion: Criterion, evidence: ApplicantEvidence): CriterionResult {
  const config = criterion.config as PriorResearchConfig;
  const minimum = config.minExperiences ?? 1;
  const documented = evidence.documented;
  const count = Math.max(documented?.researchCount ?? 0, evidence.experiences.length);

  const roleLines =
    documented && documented.researchRoles.length > 0
      ? documented.researchRoles
          .slice(0, 3)
          .map((role) => `${role.role}${role.organization ? ` at ${role.organization}` : ""}.`)
      : evidence.experiences.slice(0, 3).map((item) => `${item.title ?? "Research role"} at ${item.organization}.`);
  const track = documented ? describeTrackRecord({ ...documented, researchCount: count }) : null;
  const lines = [...(track ? [`Documented: ${track}.`] : []), ...roleLines];

  if (count >= minimum) return result(criterion, "met", lines);
  if (count > 0) return result(criterion, "partially_met", [`${count} prior research experience found. Requested ${minimum}.`, ...roleLines]);
  return result(criterion, "not_met", ["No prior research experience found in the resume or profile."]);
}

function evaluateResearchInterest(criterion: Criterion, evidence: ApplicantEvidence): CriterionResult {
  const config = criterion.config as ResearchInterestConfig;
  const slugs = config.fieldSlugs ?? [];
  if (slugs.length === 0) return result(criterion, "unknown", ["This criterion has no research field configured."]);
  if (evidence.researchFields.length === 0) {
    return result(criterion, "unknown", ["No research interests listed on this profile."]);
  }
  const overlap = evidence.researchFields.filter((field) => slugs.includes(field.slug));
  if (overlap.length > 0) {
    return result(criterion, "met", [`Listed research interests include ${overlap.map((f) => f.name).join(", ")}.`]);
  }
  return result(criterion, "unknown", [
    `Listed research interests are ${evidence.researchFields.map((f) => f.name).join(", ")}. No exact field match.`,
  ]);
}

function describeMetric(record: AcademicMetric): string {
  const twelve = toTwelvePointEquivalent(record);
  const native = record.type === "institution_scale" && record.scaleMax === 12;
  return twelve === null || native
    ? formatMetric(record)
    : `${formatMetric(record)} (about ${Number(twelve.toFixed(1))} on the 12 point scale)`;
}

/** Half a grade point below a minimum still counts for something. */
const ACADEMIC_PARTIAL_GAP = 0.5;

function evaluateAcademicMetric(criterion: Criterion, evidence: ApplicantEvidence): CriterionResult {
  const config = criterion.config as AcademicMetricConfig;
  if (evidence.academicRecords.length === 0) {
    return result(criterion, "unknown", ["No academic standing shared on this profile."]);
  }

  // The strongest readable record is the one to judge on: a student who shared
  // both a cumulative and a major average should not be marked on the lower.
  const readable = evidence.academicRecords
    .map((record) => ({ record, twelve: toTwelvePointEquivalent(record) }))
    .filter((entry): entry is { record: AcademicMetric; twelve: number } => entry.twelve !== null)
    .sort((a, b) => b.twelve - a.twelve);

  if (typeof config.minValue !== "number") {
    // Weighted on the one-page form rather than given a cut-off. Graded on the
    // 12 point scale so the weight a researcher puts on GPA actually moves the
    // score: an 11 or 12 earns nearly all of it, a 10 about half, and anything
    // lower very little.
    const best = readable[0];
    if (!best) {
      return result(criterion, "unknown", [
        `Academic standing shared as ${formatMetric(evidence.academicRecords[0])}, on a scale that could not be compared.`,
      ]);
    }
    const status =
      best.twelve >= STRONG_TWELVE_POINT ? "met" : best.twelve >= FAIR_TWELVE_POINT ? "partially_met" : "not_met";
    return result(criterion, status, [`Academic standing: ${describeMetric(best.record)}.`], academicStrength(best.twelve));
  }

  const minimum = {
    value: config.minValue,
    type: (config.metricType ?? "institution_scale") as AcademicMetricType,
    scaleMax: config.scaleMax ?? null,
  };
  const compared = evidence.academicRecords
    .map((record) => ({ record, outcome: compareToMinimum(record, minimum) }))
    .filter((entry): entry is { record: AcademicMetric; outcome: { meets: boolean; gap: number } } => entry.outcome !== null)
    .sort((a, b) => Number(b.outcome.meets) - Number(a.outcome.meets) || a.outcome.gap - b.outcome.gap);

  const best = compared[0];
  if (!best) {
    return result(criterion, "unknown", [
      `Academic standing shared as ${formatMetric(evidence.academicRecords[0])}. It uses a scale that could not be compared with the requested minimum.`,
    ]);
  }
  const status = best.outcome.meets ? "met" : best.outcome.gap <= ACADEMIC_PARTIAL_GAP ? "partially_met" : "not_met";
  return result(criterion, status, [
    `Academic standing: ${describeMetric(best.record)}. Requested minimum ${config.minValue}${
      minimum.scaleMax ? ` on a ${minimum.scaleMax} point scale` : minimum.type === "percentage" ? " percent" : ""
    }.`,
  ]);
}

export function evaluateCriterion(criterion: Criterion, evidence: ApplicantEvidence): CriterionResult | null {
  switch (criterion.type) {
    case "skill":
      return evaluateSkill(criterion, evidence);
    case "coursework":
      return evaluateCoursework(criterion, evidence);
    case "program":
      return evaluateProgram(criterion, evidence);
    case "year_level":
      return evaluateYearLevel(criterion, evidence);
    case "availability":
      return evaluateAvailability(criterion, evidence);
    case "prior_research":
      return evaluatePriorResearch(criterion, evidence);
    case "research_interest":
      return evaluateResearchInterest(criterion, evidence);
    case "academic_metric":
      return evaluateAcademicMetric(criterion, evidence);
    default:
      return null;
  }
}

export function evaluateDeterministic(criteria: Criterion[], evidence: ApplicantEvidence): CriterionResult[] {
  const results: CriterionResult[] = [];
  for (const criterion of criteria) {
    const evaluated = evaluateCriterion(criterion, evidence);
    if (evaluated) results.push(evaluated);
  }
  return results;
}
