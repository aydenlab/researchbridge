import { formatMetric, type AcademicMetric } from "@/lib/gpa";
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

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function result(
  criterion: Criterion,
  status: CriterionResult["status"],
  evidence: string[],
): CriterionResult {
  const maxScore = criterion.required ? undefined : weightOf(criterion);
  const factor = STATUS_FACTOR[status];
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
  const target = config.skillSlug ?? (config.skillName ? normalize(config.skillName) : null);
  if (!target) return result(criterion, "unknown", ["This criterion has no skill configured."]);

  const match = evidence.skills.find(
    (skill) => skill.slug === target || normalize(skill.name) === normalize(config.skillName ?? target),
  );
  if (!match) {
    return result(criterion, "not_met", [`No profile entry found for ${config.skillName ?? target}.`]);
  }
  const detail = [`Listed on profile as ${match.name}`];
  if (match.proficiency) detail.push(`Self-reported level: ${match.proficiency}`);
  if (match.context) detail.push(match.context);
  return result(criterion, "met", detail);
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
  const count = evidence.experiences.length;
  if (count >= minimum) {
    return result(
      criterion,
      "met",
      evidence.experiences.slice(0, 3).map((item) => `${item.title ?? "Research role"} at ${item.organization}.`),
    );
  }
  if (count > 0) {
    return result(criterion, "partially_met", [`${count} prior research experience listed. Requested ${minimum}.`]);
  }
  return result(criterion, "not_met", ["No prior research experience listed on this profile."]);
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

function evaluateAcademicMetric(criterion: Criterion, evidence: ApplicantEvidence): CriterionResult {
  const config = criterion.config as AcademicMetricConfig;
  if (evidence.academicRecords.length === 0) {
    return result(criterion, "unknown", ["No academic standing shared on this profile."]);
  }
  if (typeof config.minValue !== "number") {
    // Weighted on the one-page form rather than given a cut-off. There is
    // nothing to pass or fail, so this surfaces the number and stops there:
    // "unknown" keeps it out of the preference score either way.
    return result(criterion, "unknown", [
      `Academic standing: ${evidence.academicRecords.map((record) => formatMetric(record)).join(", ")}. No minimum was set for this position.`,
    ]);
  }
  const comparable = evidence.academicRecords.find(
    (record: AcademicMetric) =>
      record.type === (config.metricType ?? record.type) && (record.scaleMax ?? null) === (config.scaleMax ?? null),
  );
  if (!comparable) {
    return result(criterion, "unknown", [
      `Academic standing shared as ${formatMetric(evidence.academicRecords[0])}. It uses a different scale from the requested threshold.`,
    ]);
  }
  const status = comparable.value >= config.minValue ? "met" : "not_met";
  return result(criterion, status, [
    `Academic standing: ${formatMetric(comparable)}. Requested minimum ${config.minValue}.`,
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
