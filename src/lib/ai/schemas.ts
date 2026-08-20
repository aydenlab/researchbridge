import { z } from "zod";

export const PROMPT_VERSION = "2026-09-01";
export const SCHEMA_VERSION = "1";

export const criterionAssessmentSchema = z.object({
  criterionId: z.string(),
  assessment: z.enum(["strong_evidence", "some_evidence", "no_evidence_found", "not_applicable"]),
  evidence: z.array(z.string()).max(6),
  reasoningSummary: z.string().max(600),
});

export const applicationAnalysisSchema = z.object({
  criteria: z.array(criterionAssessmentSchema).max(30),
  responseSummaries: z
    .array(z.object({ questionId: z.string(), summary: z.string().max(600) }))
    .max(20)
    .default([]),
  missingInformation: z.array(z.string().max(240)).max(12).default([]),
  warnings: z.array(z.string().max(240)).max(12).default([]),
});

export type ApplicationAnalysis = z.infer<typeof applicationAnalysisSchema>;
export type CriterionAssessment = z.infer<typeof criterionAssessmentSchema>;

export const applicationAnalysisJsonSchema = {
  type: "object",
  properties: {
    criteria: {
      type: "array",
      description: "One entry for each criterion supplied in the request. Never invent criterion ids.",
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
            description: "Short quotations or close paraphrases drawn only from the supplied application material.",
            items: { type: "string" },
          },
          reasoningSummary: {
            type: "string",
            description: "One or two sentences explaining how the evidence relates to the criterion.",
          },
        },
        required: ["criterionId", "assessment", "evidence", "reasoningSummary"],
      },
    },
    responseSummaries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          questionId: { type: "string" },
          summary: { type: "string" },
        },
        required: ["questionId", "summary"],
      },
    },
    missingInformation: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["criteria", "responseSummaries", "missingInformation", "warnings"],
} as const;

export const interestAlignmentSchema = z.object({
  overlaps: z.array(z.object({ label: z.string().max(120), reason: z.string().max(300) })).max(8).default([]),
  gaps: z.array(z.object({ label: z.string().max(120), reason: z.string().max(300) })).max(8).default([]),
});

export type InterestAlignment = z.infer<typeof interestAlignmentSchema>;

export const interestAlignmentJsonSchema = {
  type: "object",
  properties: {
    overlaps: {
      type: "array",
      description: "Points where the student profile clearly overlaps with what this project describes.",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          reason: { type: "string" },
        },
        required: ["label", "reason"],
      },
    },
    gaps: {
      type: "array",
      description: "Preferred items the project mentions that the profile does not currently show.",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          reason: { type: "string" },
        },
        required: ["label", "reason"],
      },
    },
  },
  required: ["overlaps", "gaps"],
} as const;
