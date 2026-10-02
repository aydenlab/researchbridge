import type { DurationOption } from "@/lib/labels";
import { COMPENSATION_LABELS, DURATION_ORDER, labelOr } from "@/lib/labels";
import type { Weights } from "@/lib/criteria/from-weights";

/**
 * A Future Research Opportunity is the posting a researcher makes when they do
 * not have a project yet but want to meet strong students in their area. It is
 * an ordinary listing in every way that matters to the platform (matched,
 * applied to, reviewed, messaged), written for them from their profile so they
 * do not have to invent a project to get in front of students.
 *
 * Everything here is pure so the wording can be tested and previewed in the
 * browser before anything is saved.
 */
export const FUTURE_OPPORTUNITY_LABEL = "Future Research Opportunity";

/** The most research areas a posting can carry; the edit form refuses more. */
export const FUTURE_MAX_AREAS = 8;

/** Said everywhere a future posting appears, so nobody mistakes it for an opening. */
export const FUTURE_OPPORTUNITY_NOTICE =
  "There is no fixed start date and no guaranteed immediate position. This researcher wants to meet strong students in their area and may recruit from them when an opportunity comes up.";

export const FUTURE_DURATION_TEXT = "No fixed length yet. Agreed with the researcher when an opportunity comes up.";

/**
 * Open to any length, so the posting surfaces under whatever length a student
 * filters on. The free text above says the length is not decided.
 */
export const FUTURE_DURATIONS: DurationOption[] = [...DURATION_ORDER];

/**
 * Research interest leads, because it is the only thing a future posting knows
 * about the work. Grades and prior research still count for something, and
 * skills are left out because there is no project to need them yet.
 */
export const FUTURE_WEIGHTS: Weights = {
  weightGpa: 50,
  weightExtracurriculars: 30,
  weightPriorResearch: 30,
  weightResearchInterests: 90,
  weightSkills: 0,
};

export type FutureOpportunityInput = {
  /** As students should read it: "Amara Okonjo". */
  researcherName: string;
  /** A role rather than an honorific: "Associate Professor". */
  researcherTitle: string | null;
  department: string | null;
  labName: string | null;
  areaNames: string[];
  biography: string | null;
  recruitingNeeds: string | null;
  /** Anything extra the researcher wants students to know. Optional. */
  note: string | null;
};

export type FutureOpportunityContent = {
  title: string;
  summary: string;
  description: string;
};

function listPhrase(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function clip(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** The research areas a student will read, in a phrase that stays short. */
function areaPhrase(areaNames: string[], max: number): string {
  if (areaNames.length === 0) return "";
  if (areaNames.length <= max) return listPhrase(areaNames);
  return `${areaNames.slice(0, max).join(", ")}, and related areas`;
}

export function buildFutureOpportunity(input: FutureOpportunityInput): FutureOpportunityContent {
  const areas = input.areaNames.map((name) => name.trim()).filter(Boolean);
  const department = clean(input.department);
  const lab = clean(input.labName);
  const who = clean(input.researcherName) ?? "This researcher";

  const titleSubject = areas.length > 0 ? areaPhrase(areas, 2) : (department ?? "Research");
  const title = clip(`${FUTURE_OPPORTUNITY_LABEL}: ${titleSubject}`, 180);

  const field = areas.length > 0 ? areaPhrase(areas, 3) : department ? `${department} research` : "their research area";
  const summary = clip(
    `${who} is interested in meeting strong students in ${field} and may recruit from them when future opportunities come up. No fixed start date or guaranteed position.`,
    400,
  );

  const affiliation = [clean(input.researcherTitle), department, lab].filter(Boolean).join(", ");
  const paragraphs = [
    `This is not a posting for a specific project. Rather than recruiting for one opening, ${who}${affiliation ? ` (${affiliation})` : ""} would like to get to know promising students now, and may reach out to students from this group when a project, funding, or a position opens up.`,
    `There is no fixed start date and no guaranteed immediate position. Expressing interest puts you in front of this researcher now, so they can get to know you before an opportunity exists rather than after it has been filled.`,
  ];

  const needs = clean(input.recruitingNeeds);
  if (needs) paragraphs.push(`What they look for in a student: ${clip(needs, 1500)}`);

  const biography = clean(input.biography);
  if (biography) paragraphs.push(`About their research: ${clip(biography, 2500)}`);

  const note = clean(input.note);
  if (note) paragraphs.push(clip(note, 1500));

  paragraphs.push(
    "If something comes up, the project, length, hours, and whether it is paid or for credit will be worked out directly with the researcher.",
  );

  return { title, summary, description: clip(paragraphs.join("\n\n"), 8000) };
}

/**
 * How a posting's arrangement is named in a badge. A future posting has no pay
 * arrangement yet, so it is named for what it is rather than "Other arrangement".
 */
export function arrangementLabel(opportunity: { compensationType: string; futureOpportunity?: boolean }): string {
  return opportunity.futureOpportunity ? FUTURE_OPPORTUNITY_LABEL : labelOr(COMPENSATION_LABELS, opportunity.compensationType);
}
