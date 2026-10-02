/**
 * Evidence a student's resume and research history actually document.
 *
 * Matching used to read the skills list a student typed, which anyone can pad
 * and strong candidates often leave short. It now reads what is written down
 * in the resume and in prior research roles, and weighs research experience
 * and publications heavily. The self-reported skills list is still shown to
 * researchers, but nothing here reads it.
 *
 * Everything in this file is pure so the reading can be tested without a
 * database, a PDF, or a model.
 */

export type PublicationKind =
  | "peer_reviewed"
  | "preprint"
  | "manuscript"
  | "poster"
  | "oral_presentation"
  | "abstract"
  | "other";

export type DocumentedSkill = { name: string; quote: string | null };
export type DocumentedRole = { role: string; organization: string | null; quote: string | null };
export type DocumentedPublication = { citation: string; kind: PublicationKind | string };

export type DocumentedEvidence = {
  hasResume: boolean;
  /** Resume text plus prior research descriptions, searched for a listing's skills. */
  text: string;
  skills: DocumentedSkill[];
  researchRoles: DocumentedRole[];
  researchCount: number;
  publications: DocumentedPublication[];
  peerReviewedCount: number;
  presentationCount: number;
  summary: string | null;
  source: "resume_ai" | "resume_text" | "profile_only";
};

export type ResearchExperienceInput = {
  organization: string;
  title: string | null;
  description: string | null;
  techniques: string[];
  outputs: string[];
};

/** Kinds that count as presenting work: posters, talks, and conference abstracts. */
export const PRESENTATION_KINDS: ReadonlySet<string> = new Set(["poster", "oral_presentation", "abstract"]);

export const EMPTY_DOCUMENTED: DocumentedEvidence = {
  hasResume: false,
  text: "",
  skills: [],
  researchRoles: [],
  researchCount: 0,
  publications: [],
  peerReviewedCount: 0,
  presentationCount: 0,
  summary: null,
  source: "profile_only",
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whether a phrase appears as a whole term. Very short names such as "R" or
 * "C" only count when written in the same case, so "R" does not match every
 * stray letter in a resume.
 */
function termPattern(name: string): RegExp | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const body = escapeRegExp(trimmed).replace(/\s+/g, "\\s+");
  const flags = trimmed.length <= 2 ? "" : "i";
  return new RegExp(`(^|[^A-Za-z0-9])${body}(?=$|[^A-Za-z0-9])`, flags);
}

function clip(value: string, max = 160): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

/** The line a term appears on, as a short quote, or null when it does not appear. */
export function findQuote(text: string, name: string): string | null {
  const pattern = termPattern(name);
  if (!pattern || !text) return null;
  for (const line of text.split(/\n+/)) {
    if (pattern.test(line)) return clip(line);
  }
  return null;
}

const HEADINGS: { section: Section; pattern: RegExp }[] = [
  { section: "publications", pattern: /^(selected\s+|peer[- ]reviewed\s+)?(publications?|journal articles|papers|manuscripts)\b/i },
  {
    section: "presentations",
    pattern: /^(conference\s+|research\s+|scientific\s+)?(presentations?|posters?|abstracts|talks|conference (activity|contributions)|presentations? (and|&) posters?)\b/i,
  },
  { section: "research", pattern: /^(research|laboratory|lab|clinical research)( and \w+)?\s*(experience|positions?|projects?|history)?\s*$/i },
  { section: "skills", pattern: /^(technical\s+|laboratory\s+|lab\s+|research\s+)?(skills|competencies|techniques|methods)\b/i },
  { section: "other", pattern: /^(education|work experience|employment|experience|volunteer|leadership|awards|honou?rs|extracurricular|activities|certifications?|interests|references|teaching)\b/i },
];

type Section = "publications" | "presentations" | "research" | "skills" | "other" | "none";

function headingOf(line: string): Section | null {
  const clean = line.replace(/[:|•\-–—]+\s*$/, "").trim();
  if (clean.length === 0 || clean.length > 48) return null;
  // Headings are short and rarely carry a year or a full sentence.
  if (/\b(19|20)\d{2}\b/.test(clean) || /[.;]/.test(clean)) return null;
  for (const { section, pattern } of HEADINGS) if (pattern.test(clean)) return section;
  return null;
}

const YEAR = /\b(19|20)\d{2}\b/;
const DOI = /\b(doi\.org\/|doi:\s*)10\.\d{4,}/i;
const RESEARCH_ROLE =
  /\b(research (assistant|student|intern|internship|volunteer|fellow|trainee|associate|coordinator|technician|scholar)|summer research|undergraduate research|honou?rs (thesis|research|project)|thesis (student|project)|lab(oratory)? (assistant|technician|member|volunteer|intern)|clinical research|USRA|NSERC|CIHR)\b/i;

function publicationKind(line: string, section: Section): PublicationKind {
  if (/\b(preprint|medrxiv|biorxiv|arxiv)\b/i.test(line)) return "preprint";
  if (/\b(submitted|under review|in preparation|in prep|in revision)\b/i.test(line)) return "manuscript";
  if (/\bposter\b/i.test(line)) return "poster";
  if (/\b(oral presentation|podium|talk|invited presentation)\b/i.test(line)) return "oral_presentation";
  if (/\babstract\b/i.test(line)) return "abstract";
  if (section === "presentations") {
    return /\b(oral|podium|talk)\b/i.test(line) ? "oral_presentation" : "poster";
  }
  return "peer_reviewed";
}

/**
 * Reads a resume's text without a model. Coarse on purpose: it finds section
 * headings, counts dated entries under publication and presentation headings,
 * recognises research roles by their titles, and quotes the line any known
 * skill appears on. The model, when it is available, reads more carefully and
 * its reading replaces this one.
 */
export function readResumeText(
  text: string,
  knownSkills: string[],
): Pick<DocumentedEvidence, "skills" | "researchRoles" | "publications"> {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const publications: DocumentedPublication[] = [];
  const roles: DocumentedRole[] = [];
  const seenRoles = new Set<string>();
  const seenCitations = new Set<string>();
  let section: Section = "none";

  for (const line of lines) {
    const heading = headingOf(line);
    if (heading) {
      section = heading;
      continue;
    }

    const isCitation =
      ((section === "publications" || section === "presentations") && YEAR.test(line) && line.length > 25) ||
      DOI.test(line);
    if (isCitation) {
      const key = line.toLowerCase().slice(0, 80);
      if (!seenCitations.has(key)) {
        seenCitations.add(key);
        publications.push({ citation: clip(line, 220), kind: publicationKind(line, section) });
      }
      continue;
    }

    if (RESEARCH_ROLE.test(line) || (section === "research" && YEAR.test(line) && line.length < 160)) {
      const key = line.toLowerCase().replace(/[^a-z]/g, "").slice(0, 60);
      if (!seenRoles.has(key)) {
        seenRoles.add(key);
        roles.push({ role: clip(line, 120), organization: null, quote: clip(line) });
      }
    }
  }

  const skills: DocumentedSkill[] = [];
  const seenSkills = new Set<string>();
  for (const name of knownSkills) {
    const key = name.trim().toLowerCase();
    if (!key || seenSkills.has(key)) continue;
    const quote = findQuote(text, name);
    if (quote) {
      seenSkills.add(key);
      skills.push({ name, quote });
    }
  }

  return { skills, researchRoles: roles.slice(0, 12), publications: publications.slice(0, 40) };
}

/** The research experience entries on the profile, as searchable text. */
export function experienceText(experiences: ResearchExperienceInput[]): string {
  return experiences
    .map((item) =>
      [item.title, item.organization, item.techniques.join(", "), item.description, item.outputs.join("\n")]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

/**
 * The two research sources combined: roles read from the resume, and roles on
 * the profile, which name an organization and usually a supervisor. The larger
 * count wins rather than the sum, since the same role is normally in both.
 */
export function combineResearchCount(resumeRoles: number, profileRoles: number): number {
  return Math.max(resumeRoles, profileRoles);
}

export function countPublications(publications: DocumentedPublication[]): {
  peerReviewedCount: number;
  presentationCount: number;
} {
  return {
    peerReviewedCount: publications.filter((item) => item.kind === "peer_reviewed").length,
    presentationCount: publications.filter((item) => PRESENTATION_KINDS.has(item.kind)).length,
  };
}

/**
 * Whether the documented evidence shows a skill, and the line that shows it.
 * Looks at the skills the reader already found first, then searches the text,
 * so a listing can ask for a skill that is not in the taxonomy.
 */
export function documentsSkill(evidence: DocumentedEvidence, name: string): string | null {
  const key = name.trim().toLowerCase();
  const found = evidence.skills.find((skill) => skill.name.trim().toLowerCase() === key);
  if (found) return found.quote ?? `Shown in ${evidence.hasResume ? "resume" : "research experience"}`;
  return findQuote(evidence.text, name);
}

/** Whether there is anything documented to judge at all. */
export function hasDocumentation(evidence: DocumentedEvidence): boolean {
  return evidence.hasResume || evidence.text.trim().length > 0 || evidence.researchCount > 0;
}

/**
 * How strong a research track record is, from 0 to 1. Research roles carry
 * most of it and publications the rest: a peer-reviewed paper is the strongest
 * single signal an undergraduate can show, and a poster or talk counts too.
 */
export function researchStrength(evidence: Pick<DocumentedEvidence, "researchCount" | "peerReviewedCount" | "presentationCount">): number {
  const roles = evidence.researchCount >= 3 ? 0.65 : evidence.researchCount === 2 ? 0.55 : evidence.researchCount === 1 ? 0.4 : 0;
  const papers = evidence.peerReviewedCount >= 2 ? 0.35 : evidence.peerReviewedCount === 1 ? 0.25 : 0;
  const presented = evidence.presentationCount >= 1 ? 0.12 : 0;
  return Math.min(1, Math.round((roles + papers + presented) * 1000) / 1000);
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** One line describing the track record, for a match reason or a review panel. */
export function describeTrackRecord(
  evidence: Pick<DocumentedEvidence, "researchCount" | "peerReviewedCount" | "presentationCount">,
): string | null {
  const parts: string[] = [];
  if (evidence.researchCount > 0) parts.push(plural(evidence.researchCount, "research position", "research positions"));
  if (evidence.peerReviewedCount > 0) parts.push(plural(evidence.peerReviewedCount, "publication", "publications"));
  if (evidence.presentationCount > 0) {
    parts.push(plural(evidence.presentationCount, "poster or presentation", "posters or presentations"));
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** The stored reading of a resume, as the database returns it. */
export type StoredEvidence = {
  resumeFileId: string | null;
  resumeText: string | null;
  skills: DocumentedSkill[];
  researchRoles: DocumentedRole[];
  researchCount: number;
  publications: DocumentedPublication[];
  peerReviewedCount: number;
  presentationCount: number;
  summary: string | null;
  source: string;
};

/**
 * What matching reads for one student: the stored reading of their resume, or
 * just their research entries when there is no reading yet.
 */
export function toDocumented(row: StoredEvidence | null, experiences: ResearchExperienceInput[]): DocumentedEvidence {
  const fromProfile = experienceText(experiences);
  if (!row) {
    return { ...EMPTY_DOCUMENTED, text: fromProfile, researchCount: experiences.length };
  }
  return {
    hasResume: Boolean(row.resumeFileId),
    text: [row.resumeText ?? "", fromProfile].filter(Boolean).join("\n\n"),
    skills: row.skills,
    researchRoles: row.researchRoles,
    researchCount: combineResearchCount(row.researchCount, experiences.length),
    publications: row.publications,
    peerReviewedCount: row.peerReviewedCount,
    presentationCount: row.presentationCount,
    summary: row.summary,
    source: row.source as DocumentedEvidence["source"],
  };
}
