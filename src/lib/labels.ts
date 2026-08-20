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

export const SEMESTER_OPTIONS = ["Fall", "Winter", "Spring", "Summer"] as const;

export function labelOr(map: Record<string, string>, key: string | null | undefined, fallback = "Not specified"): string {
  if (!key) return fallback;
  return map[key] ?? fallback;
}
