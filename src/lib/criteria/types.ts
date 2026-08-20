import type { AcademicMetric } from "@/lib/gpa";

export type CriterionType =
  | "skill"
  | "coursework"
  | "program"
  | "year_level"
  | "availability"
  | "prior_research"
  | "research_interest"
  | "technique"
  | "written_response"
  | "academic_metric"
  | "custom";

export type CriterionImportance = "required" | "high" | "medium" | "low";

export type CriterionStatus = "met" | "partially_met" | "not_met" | "unknown";

export type EvaluationSource = "deterministic" | "ai_assisted" | "researcher";

export type Criterion = {
  id: string;
  type: CriterionType;
  label: string;
  description: string | null;
  required: boolean;
  importance: CriterionImportance;
  config: Record<string, unknown>;
  sortOrder: number;
};

export type CriterionResult = {
  criterionId: string;
  status: CriterionStatus;
  score?: number;
  maxScore?: number;
  evidence: string[];
  source: EvaluationSource;
};

export type ApplicantEvidence = {
  program: string | null;
  faculty: string | null;
  degreeLevel: string | null;
  yearLevel: number | null;
  graduationYear: number | null;
  weeklyHours: number | null;
  locationPreference: string | null;
  desiredStartDate: string | null;
  semesters: string[];
  summerAvailable: boolean | null;
  skills: { name: string; slug: string; proficiency: string | null; context: string | null }[];
  courses: { courseCode: string; courseName: string; status: string }[];
  researchFields: { name: string; slug: string }[];
  experiences: {
    organization: string;
    title: string | null;
    supervisor: string | null;
    description: string | null;
    techniques: string[];
    outputs: string[];
  }[];
  academicRecords: AcademicMetric[];
  answers: { questionId: string; prompt: string; text: string | null }[];
};

export type SkillConfig = { skillSlug?: string; skillName?: string };
export type CourseworkConfig = { courseCodes?: string[] };
export type ProgramConfig = { programs?: string[] };
export type YearLevelConfig = { minYear?: number; maxYear?: number };
export type AvailabilityConfig = { minHoursPerWeek?: number; locationModes?: string[] };
export type PriorResearchConfig = { minExperiences?: number };
export type ResearchInterestConfig = { fieldSlugs?: string[]; keywords?: string[] };
export type AcademicMetricConfig = { minValue?: number; scaleMax?: number | null; metricType?: string };
export type TechniqueConfig = { keywords?: string[] };
export type WrittenResponseConfig = { questionId?: string };

export const AI_ASSISTED_TYPES: CriterionType[] = ["technique", "written_response", "custom", "research_interest"];

export const DETERMINISTIC_TYPES: CriterionType[] = [
  "skill",
  "coursework",
  "program",
  "year_level",
  "availability",
  "prior_research",
  "research_interest",
  "academic_metric",
];
