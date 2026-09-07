export const COMPENSATION_LABELS: Record<string, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
  volunteer: "Volunteer",
  academic_credit: "Academic credit",
  work_study: "Work study",
  grant_funded: "Grant funded",
  thesis: "Thesis project",
  other: "Other arrangement",
};

export const COMPENSATION_ORDER = [
  "paid",
  "grant_funded",
  "work_study",
  "academic_credit",
  "thesis",
  "volunteer",
  "unpaid",
  "other",
] as const;

export const PAID_COMPENSATION = new Set(["paid", "work_study", "grant_funded"]);

export const LOCATION_LABELS: Record<string, string> = {
  in_person: "In person",
  hybrid: "Hybrid",
  remote: "Remote",
};

export const DEGREE_LABELS: Record<string, string> = {
  undergraduate: "Undergraduate",
  masters: "Master's",
  phd: "PhD",
  professional: "Professional",
  postdoctoral: "Postdoctoral",
  other: "Other",
};

export const RESEARCHER_TYPE_LABELS: Record<string, string> = {
  faculty: "Faculty member",
  professor: "Professor",
  principal_investigator: "Principal investigator",
  postdoc: "Postdoctoral researcher",
  phd_student: "PhD student",
  masters_student: "Master's student",
  lab_manager: "Lab manager",
  research_staff: "Research staff",
  student_lead: "Student project lead",
  other: "Other research role",
};

export const VERIFICATION_LABELS: Record<string, string> = {
  pending: "Awaiting review",
  needs_review: "Needs clarification",
  verified: "Verified",
  rejected: "Not approved",
};

export const REQUIREMENT_LABELS: Record<string, string> = {
  required: "Required",
  preferred: "Preferred",
  not_required: "Not required",
};

export const CRITERION_TYPE_LABELS: Record<string, string> = {
  skill: "Skill",
  coursework: "Coursework",
  program: "Program",
  year_level: "Year of study",
  availability: "Availability",
  prior_research: "Prior research experience",
  research_interest: "Research interest",
  technique: "Technique experience",
  written_response: "Written response",
  academic_metric: "Academic standing",
  custom: "Custom criterion",
};

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  short_text: "Short answer",
  long_text: "Long response",
  yes_no: "Yes or no",
  numeric: "Number",
  multiple_choice: "Multiple choice",
  file_upload: "File upload",
  paper_response: "Paper response",
  video_response: "Video response",
};

export const CRITERION_STATUS_LABELS: Record<string, string> = {
  met: "Requirement met",
  partially_met: "Partly evidenced",
  not_met: "No information found",
  unknown: "Not enough information",
};

export const PROFICIENCY_LABELS: Record<string, string> = {
  exposure: "Some exposure",
  working: "Working knowledge",
  proficient: "Proficient",
  advanced: "Advanced",
};

export const COURSE_STATUS_LABELS: Record<string, string> = {
  completed: "Completed",
  in_progress: "In progress",
  planned: "Planned",
};

export const OUTCOME_LABELS: Record<string, string> = {
  yes: "Yes",
  no: "No",
  in_progress: "Still in progress",
  prefer_not_to_say: "Prefer not to say",
};

export const WAITLIST_STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  invited: "Invited",
  converted: "Joined",
  declined: "Declined",
};

export const OPPORTUNITY_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Awaiting review",
  published: "Published",
  closed: "Closed",
  unpublished: "Unpublished",
  archived: "Archived",
};

export const RESEARCH_OUTPUT_OPTIONS = [
  "Poster",
  "Publication",
  "Conference presentation",
  "Report",
  "Dataset",
  "Code",
  "No formal output",
] as const;

export const DURATION_ORDER = ["one_semester", "two_semesters", "summer_only", "one_year", "multi_year"] as const;

export type DurationOption = (typeof DURATION_ORDER)[number];

export const DURATION_LABELS: Record<string, string> = {
  one_semester: "One semester",
  two_semesters: "Two semesters",
  summer_only: "Summer only",
  one_year: "One year",
  multi_year: "Multi-year or ongoing",
};

export const COURSE_TYPE_ORDER = [
  "honours_thesis",
  "thesis_course",
  "one_semester_coursework",
  "two_semester_coursework",
  "volunteer",
  "phd_thesis",
  "medical_student_elective",
] as const;

export type CourseTypeOption = (typeof COURSE_TYPE_ORDER)[number];

export const COURSE_TYPE_LABELS: Record<string, string> = {
  honours_thesis: "Honours thesis",
  thesis_course: "Thesis course",
  one_semester_coursework: "One-semester coursework",
  two_semester_coursework: "Two-semester coursework",
  volunteer: "Volunteer",
  phd_thesis: "PhD thesis",
  medical_student_elective: "Medical student elective",
};

export const PROGRAM_CATEGORY_ORDER = [
  "life_sciences",
  "health_sciences",
  "human_resources_management",
  "health_policy",
  "kinesiology",
  "nursing",
  "medicine",
  "engineering",
  "science",
  "social_sciences",
  "humanities",
  "business",
  "other",
] as const;

export type ProgramCategoryOption = (typeof PROGRAM_CATEGORY_ORDER)[number];

export const PROGRAM_CATEGORY_LABELS: Record<string, string> = {
  life_sciences: "Life sciences",
  health_sciences: "Health sciences",
  human_resources_management: "Human resources management",
  health_policy: "Health policy",
  kinesiology: "Kinesiology",
  nursing: "Nursing",
  medicine: "Medicine",
  engineering: "Engineering",
  science: "Science",
  social_sciences: "Social sciences",
  humanities: "Humanities",
  business: "Business and commerce",
  other: "Other program",
};

export const COMPENSATION_PREFERENCE_ORDER = ["paid", "volunteer", "academic_credit"] as const;

export type CompensationPreferenceOption = (typeof COMPENSATION_PREFERENCE_ORDER)[number];

export const COMPENSATION_PREFERENCE_LABELS: Record<string, string> = {
  paid: "Paid positions",
  volunteer: "Volunteer or unpaid positions",
  academic_credit: "Positions for academic credit",
};

export const REVIEW_TASK_ORDER = [
  "screening",
  "data_extraction",
  "risk_of_bias",
  "manuscript_writing",
  "search_strategy",
  "statistical_analysis",
  "reference_management",
  "other",
] as const;

export type ReviewTaskOption = (typeof REVIEW_TASK_ORDER)[number];

export const REVIEW_TASK_LABELS: Record<string, string> = {
  screening: "Screening",
  data_extraction: "Data extraction",
  risk_of_bias: "Risk of bias assessment",
  manuscript_writing: "Manuscript writing",
  search_strategy: "Search strategy",
  statistical_analysis: "Statistical analysis",
  reference_management: "Reference management",
  other: "Something else",
};

export const OPPORTUNITY_KIND_LABELS: Record<string, string> = {
  research_position: "Research position",
  review_project: "Review",
};

export const SEMESTER_OPTIONS = ["Fall", "Winter", "Spring", "Summer"] as const;

export function labelOr(map: Record<string, string>, key: string | null | undefined, fallback = "Not specified"): string {
  if (!key) return fallback;
  return map[key] ?? fallback;
}
