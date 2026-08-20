export const APPLICATION_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "shortlisted",
  "researcher_contacted",
  "interview",
  "accepted",
  "declined",
  "withdrawn",
  "position_filled",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type Actor = "student" | "researcher" | "admin";

const RESEARCHER_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  draft: [],
  submitted: ["under_review", "shortlisted", "declined", "position_filled"],
  under_review: ["shortlisted", "researcher_contacted", "declined", "position_filled"],
  shortlisted: ["researcher_contacted", "interview", "declined", "position_filled"],
  researcher_contacted: ["interview", "accepted", "declined", "position_filled"],
  interview: ["accepted", "declined", "position_filled"],
  accepted: ["position_filled"],
  declined: [],
  withdrawn: [],
  position_filled: [],
};

const STUDENT_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  draft: ["submitted"],
  submitted: ["withdrawn"],
  under_review: ["withdrawn"],
  shortlisted: ["withdrawn"],
  researcher_contacted: ["withdrawn"],
  interview: ["withdrawn"],
  accepted: ["withdrawn"],
  declined: [],
  withdrawn: [],
  position_filled: [],
};

export function allowedTransitions(current: ApplicationStatus, actor: Actor): ApplicationStatus[] {
  if (actor === "student") return STUDENT_TRANSITIONS[current];
  if (actor === "researcher") return RESEARCHER_TRANSITIONS[current];
  const merged = new Set([...RESEARCHER_TRANSITIONS[current], ...STUDENT_TRANSITIONS[current]]);
  return [...merged];
}

export function canTransition(current: ApplicationStatus, next: ApplicationStatus, actor: Actor): boolean {
  return allowedTransitions(current, actor).includes(next);
}

export function isTerminal(status: ApplicationStatus): boolean {
  return status === "declined" || status === "withdrawn" || status === "position_filled";
}

export function isActive(status: ApplicationStatus): boolean {
  return !isTerminal(status) && status !== "draft";
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  shortlisted: "Shortlisted",
  researcher_contacted: "Researcher reached out",
  interview: "Meeting scheduled",
  accepted: "Offer made",
  declined: "Not moving forward",
  withdrawn: "Withdrawn",
  position_filled: "Position filled",
};

export const STATUS_TONE: Record<ApplicationStatus, "neutral" | "active" | "positive" | "closed"> = {
  draft: "neutral",
  submitted: "active",
  under_review: "active",
  shortlisted: "active",
  researcher_contacted: "positive",
  interview: "positive",
  accepted: "positive",
  declined: "closed",
  withdrawn: "closed",
  position_filled: "closed",
};

export const STUDENT_STATUS_DESCRIPTION: Record<ApplicationStatus, string> = {
  draft: "You have not submitted this application yet.",
  submitted: "Your application has been sent to the researcher.",
  under_review: "The researcher has opened your application.",
  shortlisted: "The researcher has shortlisted your application for this project.",
  researcher_contacted: "The researcher has asked to be in touch with you.",
  interview: "A meeting has been arranged for this project.",
  accepted: "The researcher has offered you this position.",
  declined: "The researcher is not moving forward with this application.",
  withdrawn: "You withdrew this application.",
  position_filled: "This position has been filled.",
};
