import { aiCostControls, env } from "@/lib/env";
import { isEnabled } from "@/lib/flags";
import { log } from "@/lib/log";
import { FAIRNESS_RULES, structuredCall, TRANSIENT_FAILURES, UNTRUSTED_INPUT_RULES, wrapUntrusted } from "./anthropic";
import { cacheKeyFor, readResponseCache, writeResponseCache } from "./response-cache";
import { PROMPT_VERSION, SCHEMA_VERSION, interestAlignmentJsonSchema, interestAlignmentSchema, type InterestAlignment } from "./schemas";
import { singleFlight } from "./single-flight";
import { recordUsage } from "./spend";

export type InterestAlignmentState =
  | { state: "ready"; alignment: InterestAlignment }
  | { state: "disabled" }
  | { state: "unavailable" };

const FEATURE = "student_interest_alignment";

const SYSTEM = [
  "You help a university student understand how their own profile lines up with one research opportunity.",
  "You are writing for the student, so the tone is plain and encouraging.",
  UNTRUSTED_INPUT_RULES,
  FAIRNESS_RULES,
  "Never produce a score, percentage, ranking, or a statement about whether the student should apply.",
  "Only mention overlaps and gaps that the researcher actually described in the listing.",
  "A gap is informational. Do not tell the student they are unqualified or discourage them from applying.",
].join(" ");

export type InterestAlignmentInput = {
  projectTitle: string;
  projectSummary: string;
  requestedSkills: string[];
  requestedCoursework: string[];
  researchFields: string[];
  studentSkills: string[];
  studentCoursework: string[];
  studentFields: string[];
  studentSummary: string | null;
};

/** The listing side of the comparison, shared by every student who views it. */
function buildProjectContent(input: InterestAlignmentInput): string {
  return [
    `Project title: ${input.projectTitle}`,
    `Project summary: ${input.projectSummary}`,
    `Requested skills: ${input.requestedSkills.join(", ") || "none listed"}`,
    `Requested coursework: ${input.requestedCoursework.join(", ") || "none listed"}`,
    `Project research fields: ${input.researchFields.join(", ") || "none listed"}`,
  ].join("\n");
}

function buildStudentContent(input: InterestAlignmentInput): string {
  return wrapUntrusted(
    "student_profile",
    [
      `Skills: ${input.studentSkills.join(", ") || "none listed"}`,
      `Coursework: ${input.studentCoursework.join(", ") || "none listed"}`,
      `Research interests: ${input.studentFields.join(", ") || "none listed"}`,
      input.studentSummary ? `Summary: ${input.studentSummary}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

/**
 * This runs on a page a student can reload at will, so an uncached call would
 * bill once per view. The result only depends on the listing and the profile,
 * both of which change rarely, so it is stored under a hash of those inputs.
 */
export async function analyzeInterestAlignment(input: InterestAlignmentInput): Promise<InterestAlignmentState> {
  if (!(await isEnabled("AI_ANALYSIS_ENABLED"))) return { state: "disabled" };

  const projectContent = buildProjectContent(input);
  const studentContent = buildStudentContent(input);
  const cacheKey = cacheKeyFor(FEATURE, {
    promptVersion: PROMPT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    model: env.ANTHROPIC_MODEL,
    projectContent,
    studentContent,
  });

  const cached = await readCached(cacheKey);
  if (cached) return cached;

  return singleFlight(cacheKey, async () => {
    const raced = await readCached(cacheKey);
    if (raced) return raced;

    const response = await structuredCall({
      system: SYSTEM,
      sharedContent: projectContent,
      userContent: studentContent,
      toolName: "report_alignment",
      toolDescription: "Report where the student profile overlaps with the project and where information is missing.",
      inputSchema: interestAlignmentJsonSchema as unknown as Record<string, unknown>,
      parser: interestAlignmentSchema,
      maxTokens: 1200,
      feature: FEATURE,
    });

    if (!response.ok) {
      await writeResponseCache({
        cacheKey,
        feature: FEATURE,
        model: env.ANTHROPIC_MODEL,
        errorCode: response.failure,
        // A transient failure is held only briefly, so a provider blip does not
        // freeze this panel for a week.
        ttlMs: TRANSIENT_FAILURES.has(response.failure)
          ? aiCostControls.negativeCacheTtlMs
          : aiCostControls.responseCacheTtlMs,
      });
      return { state: "unavailable" as const };
    }

    await writeResponseCache({
      cacheKey,
      feature: FEATURE,
      model: response.model,
      result: response.data as unknown as Record<string, unknown>,
      ttlMs: aiCostControls.responseCacheTtlMs,
    });

    return { state: "ready" as const, alignment: response.data };
  });
}

async function readCached(cacheKey: string): Promise<InterestAlignmentState | null> {
  const entry = await readResponseCache(cacheKey);
  if (!entry) return null;

  if (entry.status === "error") return { state: "unavailable" };

  const parsed = interestAlignmentSchema.safeParse(entry.result);
  if (!parsed.success) return null;

  log.debug("ai_alignment_cache_hit", { cacheKey });
  await recordUsage({ feature: FEATURE, model: entry.model, outcome: "served_from_cache" });
  return { state: "ready", alignment: parsed.data };
}
