import crypto from "node:crypto";
import { aiCostControls, env } from "@/lib/env";
import { isEnabled } from "@/lib/flags";
import { FAIRNESS_RULES, structuredCall, UNTRUSTED_INPUT_RULES, wrapUntrusted, type StructuredFailure } from "./anthropic";
import { resumeAnalysisJsonSchema, resumeAnalysisSchema, type ResumeAnalysis } from "./schemas";

export const RESUME_PROMPT_VERSION = "2026-10-02";
const FEATURE = "resume_evidence";
const RESUME_PART_CHARS = Math.min(aiCostControls.maxSectionChars, 9000);

const SYSTEM = [
  "You read a university student's resume and list what it documents, so research opportunities can be matched to evidence rather than to a self-reported skills list.",
  UNTRUSTED_INPUT_RULES,
  FAIRNESS_RULES,
  "Only list something when the resume shows it, and quote the line that shows it.",
  "Do not invent skills, roles, or publications, and do not upgrade a submitted manuscript or a poster to a published paper.",
  "Never score, rank, or judge the student. The summary describes; it does not evaluate.",
].join(" ");

export type ResumeAnalysisResult =
  | { ok: true; analysis: ResumeAnalysis; model: string; inputHash: string }
  | { ok: false; reason: StructuredFailure | "disabled" | "empty"; inputHash: string };

export function resumeInputHash(resumeText: string, experienceText: string): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ v: RESUME_PROMPT_VERSION, model: env.ANTHROPIC_MODEL, resumeText, experienceText }))
    .digest("hex");
}

/**
 * One model call per resume version. The caller stores the result with its
 * input hash and only calls again when the resume or the research entries
 * change, so a student who never edits their profile is read once.
 */
export async function analyzeResume(input: {
  studentId: string;
  resumeText: string;
  experienceText: string;
}): Promise<ResumeAnalysisResult> {
  const inputHash = resumeInputHash(input.resumeText, input.experienceText);
  if (!input.resumeText.trim()) return { ok: false, reason: "empty", inputHash };
  if (!(await isEnabled("AI_ANALYSIS_ENABLED"))) return { ok: false, reason: "disabled", inputHash };

  // A single section is capped, and a two-page CV with publications at the end
  // runs past it, so a long resume goes in as consecutive parts.
  const parts = [input.resumeText.slice(0, RESUME_PART_CHARS), input.resumeText.slice(RESUME_PART_CHARS, RESUME_PART_CHARS * 2)]
    .filter((part) => part.trim().length > 0)
    .map((part, index, all) => wrapUntrusted(all.length > 1 ? `resume_part_${index + 1}` : "resume", part));

  const userContent = [
    ...parts,
    input.experienceText.trim() ? wrapUntrusted("research_experience", input.experienceText) : "",
    "",
    "Report what this resume documents.",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await structuredCall({
    system: SYSTEM,
    userContent,
    toolName: "report_resume_evidence",
    toolDescription: "Report the skills, research positions, and research outputs the resume documents.",
    inputSchema: resumeAnalysisJsonSchema as unknown as Record<string, unknown>,
    parser: resumeAnalysisSchema,
    maxTokens: 3000,
    feature: FEATURE,
    subjectKey: input.studentId,
  });

  if (!response.ok) return { ok: false, reason: response.failure, inputHash };
  return { ok: true, analysis: response.data, model: response.model, inputHash };
}
