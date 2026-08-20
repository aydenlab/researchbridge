import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { aiAnalyses, db } from "@/db";
import { env } from "@/lib/env";
import { isEnabled } from "@/lib/flags";
import { log } from "@/lib/log";
import type { ApplicantEvidence, Criterion, CriterionResult } from "@/lib/criteria/types";
import { AI_ASSISTED_TYPES } from "@/lib/criteria/types";
import { weightOf, STATUS_FACTOR } from "@/lib/criteria/weights";
import { FAIRNESS_RULES, structuredCall, UNTRUSTED_INPUT_RULES, wrapUntrusted, anthropicAvailable } from "./anthropic";
import {
  applicationAnalysisJsonSchema,
  applicationAnalysisSchema,
  PROMPT_VERSION,
  SCHEMA_VERSION,
  type ApplicationAnalysis,
} from "./schemas";

const ANALYSIS_TYPE = "application_criteria_evidence";

export type AnalysisState =
  | { state: "ready"; analysis: ApplicationAnalysis; model: string | null; createdAt: Date }
  | { state: "disabled" }
  | { state: "unavailable"; reason: string }
  | { state: "pending" };

const ASSESSMENT_TO_STATUS: Record<string, CriterionResult["status"]> = {
  strong_evidence: "met",
  some_evidence: "partially_met",
  no_evidence_found: "not_met",
  not_applicable: "unknown",
};

function buildSystemPrompt(isPaidPosition: boolean): string {
  const lines = [
    "You support academic research recruiting on ResearchBridge.",
    "Your only job is to locate evidence in a student application that relates to criteria a researcher wrote for one specific project.",
    UNTRUSTED_INPUT_RULES,
    FAIRNESS_RULES,
    "Quote or closely paraphrase the applicant material. Never invent facts that are not present.",
    "If a criterion has no supporting material, return no_evidence_found with an empty evidence list rather than guessing.",
    "Use not_applicable when the criterion cannot be judged from written material at all.",
    "Do not produce an overall score, ranking, percentage, or recommendation.",
  ];
  if (isPaidPosition) {
    lines.push(
      "This position may constitute paid employment. You must not suggest a hiring decision, shortlist, or ordering of candidates under any circumstances. Report evidence only.",
    );
  }
  return lines.join(" ");
}

function buildUserContent(input: {
  criteria: Criterion[];
  evidence: ApplicantEvidence;
  projectTitle: string;
  projectSummary: string;
}): string {
  const criteriaBlock = input.criteria
    .map((criterion) =>
      [
        `- criterionId: ${criterion.id}`,
        `  label: ${criterion.label}`,
        `  type: ${criterion.type}`,
        `  requested: ${criterion.required ? "Required" : criterion.importance}`,
        criterion.description ? `  description: ${criterion.description}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");

  const profileLines = [
    input.evidence.program ? `Program: ${input.evidence.program}` : null,
    input.evidence.degreeLevel ? `Degree level: ${input.evidence.degreeLevel}` : null,
    input.evidence.yearLevel ? `Year of study: ${input.evidence.yearLevel}` : null,
    input.evidence.weeklyHours ? `Stated availability: ${input.evidence.weeklyHours} hours per week` : null,
    input.evidence.skills.length
      ? `Listed skills: ${input.evidence.skills.map((s) => (s.context ? `${s.name} (${s.context})` : s.name)).join("; ")}`
      : null,
    input.evidence.courses.length
      ? `Listed coursework: ${input.evidence.courses.map((c) => `${c.courseCode} ${c.courseName}`).join("; ")}`
      : null,
    input.evidence.researchFields.length
      ? `Listed research interests: ${input.evidence.researchFields.map((f) => f.name).join(", ")}`
      : null,
  ].filter(Boolean);

  const experienceBlock = input.evidence.experiences
    .map((item) =>
      [
        `Organization: ${item.organization}`,
        item.title ? `Role: ${item.title}` : null,
        item.techniques.length ? `Techniques: ${item.techniques.join(", ")}` : null,
        item.description ? `Description: ${item.description}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");

  const answersBlock = input.evidence.answers
    .filter((answer) => answer.text && answer.text.trim().length > 0)
    .map((answer) => `questionId: ${answer.questionId}\nPrompt: ${answer.prompt}\nResponse:\n${answer.text}`)
    .join("\n\n");

  return [
    `Project title: ${input.projectTitle}`,
    `Project summary: ${input.projectSummary}`,
    "",
    "Criteria defined by the researcher for this project:",
    criteriaBlock,
    "",
    wrapUntrusted("profile", profileLines.join("\n")),
    experienceBlock ? wrapUntrusted("research_experience", experienceBlock) : "",
    answersBlock ? wrapUntrusted("application_responses", answersBlock) : "",
    "",
    "Return one entry per criterion id listed above.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function analysisInputHash(input: {
  criteria: Criterion[];
  evidence: ApplicantEvidence;
  projectTitle: string;
  projectSummary: string;
}): string {
  const payload = JSON.stringify({
    promptVersion: PROMPT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    model: env.ANTHROPIC_MODEL,
    criteria: input.criteria.map((c) => ({ id: c.id, label: c.label, type: c.type, required: c.required, importance: c.importance, description: c.description })),
    content: buildUserContent(input),
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export async function loadStoredAnalysis(applicationId: string): Promise<AnalysisState> {
  const rows = await db
    .select()
    .from(aiAnalyses)
    .where(and(eq(aiAnalyses.applicationId, applicationId), eq(aiAnalyses.type, ANALYSIS_TYPE)))
    .orderBy(desc(aiAnalyses.createdAt))
    .limit(1);

  const row = rows[0];
  if (!row) return { state: "pending" };
  if (row.status !== "ok" || !row.result) return { state: "unavailable", reason: row.errorCode ?? "provider_error" };
  const parsed = applicationAnalysisSchema.safeParse(row.result);
  if (!parsed.success) return { state: "unavailable", reason: "invalid_output" };
  return { state: "ready", analysis: parsed.data, model: row.model, createdAt: row.createdAt };
}

export async function runApplicationAnalysis(input: {
  applicationId: string;
  criteria: Criterion[];
  evidence: ApplicantEvidence;
  projectTitle: string;
  projectSummary: string;
  isPaidPosition: boolean;
  force?: boolean;
}): Promise<AnalysisState> {
  if (!(await isEnabled("AI_ANALYSIS_ENABLED"))) return { state: "disabled" };

  const semanticCriteria = input.criteria.filter((criterion) => AI_ASSISTED_TYPES.includes(criterion.type));
  if (semanticCriteria.length === 0 && input.evidence.answers.length === 0) return { state: "pending" };

  const payload = { ...input, criteria: semanticCriteria };
  const inputHash = analysisInputHash(payload);

  if (!input.force) {
    const cached = await db
      .select()
      .from(aiAnalyses)
      .where(and(eq(aiAnalyses.applicationId, input.applicationId), eq(aiAnalyses.inputHash, inputHash)))
      .orderBy(desc(aiAnalyses.createdAt))
      .limit(1);
    const row = cached[0];
    if (row) {
      if (row.status === "ok" && row.result) {
        const parsed = applicationAnalysisSchema.safeParse(row.result);
        if (parsed.success) return { state: "ready", analysis: parsed.data, model: row.model, createdAt: row.createdAt };
      } else {
        return { state: "unavailable", reason: row.errorCode ?? "provider_error" };
      }
    }
  }

  if (!anthropicAvailable()) {
    await db.insert(aiAnalyses).values({
      applicationId: input.applicationId,
      type: ANALYSIS_TYPE,
      model: null,
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      inputHash,
      status: "error",
      errorCode: "missing_api_key",
    });
    return { state: "unavailable", reason: "missing_api_key" };
  }

  const response = await structuredCall({
    system: buildSystemPrompt(input.isPaidPosition),
    userContent: buildUserContent(payload),
    toolName: "report_criterion_evidence",
    toolDescription: "Report the evidence found for each researcher-defined criterion.",
    inputSchema: applicationAnalysisJsonSchema as unknown as Record<string, unknown>,
    parser: applicationAnalysisSchema,
    maxTokens: 3000,
    feature: ANALYSIS_TYPE,
  });

  if (!response.ok) {
    await db.insert(aiAnalyses).values({
      applicationId: input.applicationId,
      type: ANALYSIS_TYPE,
      model: env.ANTHROPIC_MODEL,
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      inputHash,
      status: "error",
      errorCode: response.failure,
    });
    return { state: "unavailable", reason: response.failure };
  }

  const knownIds = new Set(semanticCriteria.map((criterion) => criterion.id));
  const filtered: ApplicationAnalysis = {
    ...response.data,
    criteria: response.data.criteria.filter((item) => knownIds.has(item.criterionId)),
  };

  const [row] = await db
    .insert(aiAnalyses)
    .values({
      applicationId: input.applicationId,
      type: ANALYSIS_TYPE,
      model: response.model,
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      inputHash,
      status: "ok",
      result: filtered,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    })
    .returning();

  log.info("ai_analysis_stored", {
    applicationId: input.applicationId,
    criteriaCount: filtered.criteria.length,
    model: response.model,
  });

  return { state: "ready", analysis: filtered, model: response.model, createdAt: row.createdAt };
}

export function analysisToCriterionResults(
  criteria: Criterion[],
  analysis: ApplicationAnalysis,
): CriterionResult[] {
  const byId = new Map(criteria.map((criterion) => [criterion.id, criterion]));
  const results: CriterionResult[] = [];
  for (const item of analysis.criteria) {
    const criterion = byId.get(item.criterionId);
    if (!criterion) continue;
    const status = ASSESSMENT_TO_STATUS[item.assessment] ?? "unknown";
    const maxScore = criterion.required ? undefined : weightOf(criterion);
    const factor = STATUS_FACTOR[status];
    results.push({
      criterionId: criterion.id,
      status,
      evidence: item.evidence,
      source: "ai_assisted",
      maxScore,
      score: maxScore !== undefined && factor !== null ? Math.round(maxScore * factor * 1000) / 1000 : undefined,
    });
  }
  return results;
}

export { ANALYSIS_TYPE };
