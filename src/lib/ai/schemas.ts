import { z } from "zod";

export const PROMPT_VERSION = "2026-09-01";
export const SCHEMA_VERSION = "2";

/**
 * The caps below exist so a long-winded model cannot flood a reviewer's screen.
 *
 * They are enforced twice on purpose. The JSON schema states them so the model
 * aims inside the limit, and the parser trims rather than rejects, because a
 * response that runs a few characters long has already been paid for and is
 * still perfectly usable. Rejecting it would throw away a billed call and leave
 * the reviewer with nothing.
 */
export const LIMITS = {
  evidencePerCriterion: 6,
  reasoningSummary: 600,
  criteria: 30,
  responseSummaries: 20,
  responseSummary: 600,
  noteList: 12,
  note: 240,
  alignmentItems: 8,
  alignmentLabel: 120,
  alignmentReason: 300,
} as const;

const trimmedString = (max: number) => z.string().transform((value) => (value.length <= max ? value : value.slice(0, max)));

const trimmedArray = <T extends z.ZodTypeAny>(item: T, max: number) =>
  z.array(item).transform((value) => value.slice(0, max));

export const criterionAssessmentSchema = z.object({
  criterionId: z.string(),
  assessment: z.enum(["strong_evidence", "some_evidence", "no_evidence_found", "not_applicable"]),
  evidence: trimmedArray(z.string(), LIMITS.evidencePerCriterion),
  reasoningSummary: trimmedString(LIMITS.reasoningSummary),
});

export const applicationAnalysisSchema = z.object({
  criteria: trimmedArray(criterionAssessmentSchema, LIMITS.criteria),
  responseSummaries: trimmedArray(
    z.object({ questionId: z.string(), summary: trimmedString(LIMITS.responseSummary) }),
    LIMITS.responseSummaries,
  ).default([]),
  missingInformation: trimmedArray(trimmedString(LIMITS.note), LIMITS.noteList).default([]),
  warnings: trimmedArray(trimmedString(LIMITS.note), LIMITS.noteList).default([]),
});

export type ApplicationAnalysis = z.infer<typeof applicationAnalysisSchema>;
export type CriterionAssessment = z.infer<typeof criterionAssessmentSchema>;

export const applicationAnalysisJsonSchema = {
  type: "object",
  properties: {
    criteria: {
      type: "array",
      description: "One entry for each criterion supplied in the request. Never invent criterion ids.",
      maxItems: LIMITS.criteria,
      items: {
        type: "object",
        properties: {
          criterionId: { type: "string", description: "The exact criterion id supplied in the request." },
          assessment: {
            type: "string",
            enum: ["strong_evidence", "some_evidence", "no_evidence_found", "not_applicable"],
          },
          evidence: {
            type: "array",
            description: `Short quotations or close paraphrases drawn only from the supplied application material. At most ${LIMITS.evidencePerCriterion}.`,
            maxItems: LIMITS.evidencePerCriterion,
            items: { type: "string" },
          },
          reasoningSummary: {
            type: "string",
            description: `One or two sentences explaining how the evidence relates to the criterion. At most ${LIMITS.reasoningSummary} characters.`,
            maxLength: LIMITS.reasoningSummary,
          },
        },
        required: ["criterionId", "assessment", "evidence", "reasoningSummary"],
      },
    },
    responseSummaries: {
      type: "array",
      maxItems: LIMITS.responseSummaries,
      items: {
        type: "object",
        properties: {
          questionId: { type: "string" },
          summary: { type: "string", maxLength: LIMITS.responseSummary },
        },
        required: ["questionId", "summary"],
      },
    },
    missingInformation: {
      type: "array",
      maxItems: LIMITS.noteList,
      items: { type: "string", maxLength: LIMITS.note },
    },
    warnings: {
      type: "array",
      maxItems: LIMITS.noteList,
      items: { type: "string", maxLength: LIMITS.note },
    },
  },
  required: ["criteria", "responseSummaries", "missingInformation", "warnings"],
} as const;

export const interestAlignmentSchema = z.object({
  overlaps: trimmedArray(
    z.object({ label: trimmedString(LIMITS.alignmentLabel), reason: trimmedString(LIMITS.alignmentReason) }),
    LIMITS.alignmentItems,
  ).default([]),
  gaps: trimmedArray(
    z.object({ label: trimmedString(LIMITS.alignmentLabel), reason: trimmedString(LIMITS.alignmentReason) }),
    LIMITS.alignmentItems,
  ).default([]),
});

export type InterestAlignment = z.infer<typeof interestAlignmentSchema>;

const alignmentItems = (description: string) => ({
  type: "array",
  description,
  maxItems: LIMITS.alignmentItems,
  items: {
    type: "object",
    properties: {
      label: {
        type: "string",
        description: `A short name for the point, at most ${LIMITS.alignmentLabel} characters.`,
        maxLength: LIMITS.alignmentLabel,
      },
      reason: {
        type: "string",
        description: `One sentence of explanation, at most ${LIMITS.alignmentReason} characters.`,
        maxLength: LIMITS.alignmentReason,
      },
    },
    required: ["label", "reason"],
  },
});

export const interestAlignmentJsonSchema = {
  type: "object",
  properties: {
    overlaps: alignmentItems("Points where the student profile clearly overlaps with what this project describes."),
    gaps: alignmentItems("Preferred items the project mentions that the profile does not currently show."),
  },
  required: ["overlaps", "gaps"],
} as const;
