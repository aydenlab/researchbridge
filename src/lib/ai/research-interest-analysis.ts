import { isEnabled } from "@/lib/flags";
import { FAIRNESS_RULES, structuredCall, UNTRUSTED_INPUT_RULES, wrapUntrusted } from "./anthropic";
import { interestAlignmentJsonSchema, interestAlignmentSchema, type InterestAlignment } from "./schemas";

export type InterestAlignmentState =
  | { state: "ready"; alignment: InterestAlignment }
  | { state: "disabled" }
  | { state: "unavailable" };

const SYSTEM = [
  "You help a university student understand how their own profile lines up with one research opportunity.",
  "You are writing for the student, so the tone is plain and encouraging.",
  UNTRUSTED_INPUT_RULES,
  FAIRNESS_RULES,
  "Never produce a score, percentage, ranking, or a statement about whether the student should apply.",
  "Only mention overlaps and gaps that the researcher actually described in the listing.",
  "A gap is informational. Do not tell the student they are unqualified or discourage them from applying.",
].join(" ");

export async function analyzeInterestAlignment(input: {
  projectTitle: string;
  projectSummary: string;
  requestedSkills: string[];
  requestedCoursework: string[];
  researchFields: string[];
  studentSkills: string[];
  studentCoursework: string[];
  studentFields: string[];
  studentSummary: string | null;
}): Promise<InterestAlignmentState> {
  if (!(await isEnabled("AI_ANALYSIS_ENABLED"))) return { state: "disabled" };

  const content = [
    `Project title: ${input.projectTitle}`,
    `Project summary: ${input.projectSummary}`,
    `Requested skills: ${input.requestedSkills.join(", ") || "none listed"}`,
    `Requested coursework: ${input.requestedCoursework.join(", ") || "none listed"}`,
    `Project research fields: ${input.researchFields.join(", ") || "none listed"}`,
    "",
    wrapUntrusted(
      "student_profile",
      [
        `Skills: ${input.studentSkills.join(", ") || "none listed"}`,
        `Coursework: ${input.studentCoursework.join(", ") || "none listed"}`,
        `Research interests: ${input.studentFields.join(", ") || "none listed"}`,
        input.studentSummary ? `Summary: ${input.studentSummary}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n");

  const response = await structuredCall({
    system: SYSTEM,
    userContent: content,
    toolName: "report_alignment",
    toolDescription: "Report where the student profile overlaps with the project and where information is missing.",
    inputSchema: interestAlignmentJsonSchema as unknown as Record<string, unknown>,
    parser: interestAlignmentSchema,
    maxTokens: 1200,
    feature: "student_interest_alignment",
  });

  if (!response.ok) return { state: "unavailable" };
  return { state: "ready", alignment: response.data };
}
