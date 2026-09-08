import { z } from "zod";
import { arrayField } from "./shared";

const requiredText = (label: string, max: number, min = 1) =>
  z
    .string()
    .trim()
    .min(min, min > 1 ? `${label} should be at least ${min} characters.` : `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

export const projectStepSchema = z.object({
  title: requiredText("Project title", 180, 8),
  summary: requiredText("Plain-language summary", 400, 30),
  description: requiredText("Detailed research description", 8000, 120),
  projectGoals: optionalText(1200),
  department: requiredText("Department", 160),
  labName: optionalText(160),
  researchFieldIds: arrayField(z.string().uuid(), { min: 1, max: 8, message: "Choose at least one research field." }),
});

export const roleStepSchema = z.object({
  responsibilities: requiredText("Responsibilities", 4000, 40),
  techniques: optionalText(1200),
  expectedOutputs: optionalText(1200),
  learningOpportunities: optionalText(1200),
});

export const durationOptionSchema = z.enum([
  "one_semester",
  "two_semesters",
  "summer_only",
  "one_year",
  "multi_year",
]);

export const logisticsStepSchema = z
  .object({
    numberOfOpenings: z.coerce.number().int().min(1, "There must be at least one opening.").max(50),
    startDate: optionalText(20),
    preferredDurations: arrayField(durationOptionSchema, {
      min: 1,
      max: 5,
      message: "Choose at least one length. Select them all if you are open to any of them.",
    }),
    duration: optionalText(160),
    hoursPerWeekMin: z.coerce.number().int().min(0).max(60),
    hoursPerWeekMax: z.coerce.number().int().min(0).max(60),
    deadline: requiredText("Application deadline", 20),
    locationMode: z.enum(["in_person", "hybrid", "remote"], { message: "Choose a location mode." }),
    location: optionalText(160),
    compensationType: z.enum(
      ["paid", "unpaid", "volunteer", "academic_credit", "work_study", "grant_funded", "thesis", "other"],
      { message: "Choose a compensation category." },
    ),
    compensationDetails: optionalText(1200),
    academicCreditAvailable: z.coerce.boolean().default(false),
    beginnerFriendly: z.coerce.boolean().default(false),
    priorResearchRequired: z.coerce.boolean().default(false),
  })
  .refine((value) => value.hoursPerWeekMax >= value.hoursPerWeekMin, {
    message: "The maximum hours cannot be lower than the minimum.",
    path: ["hoursPerWeekMax"],
  })
  .refine((value) => value.compensationType !== "paid" || Boolean(value.compensationDetails), {
    message: "Describe the pay arrangement so students know what is offered before applying.",
    path: ["compensationDetails"],
  });

export const reviewTaskSchema = z.enum([
  "screening",
  "data_extraction",
  "risk_of_bias",
  "manuscript_writing",
  "search_strategy",
  "statistical_analysis",
  "reference_management",
  "other",
]);

/**
 * A review posting is deliberately five fields. The whole value of this posting
 * type is that a supervisor can put one up in under two minutes, so anything
 * that is not strictly needed to decide whether to help is left off.
 */
export const reviewPostingSchema = z.object({
  title: requiredText("Title", 180, 8),
  summary: requiredText("Short summary", 1200, 30),
  authorshipOffered: z.coerce.boolean().default(false),
  reviewTasks: arrayField(reviewTaskSchema, {
    min: 1,
    max: 8,
    message: "Choose at least one part you need help with.",
  }),
});

/**
 * The one-page posting form. Same destination as the nine-step wizard, asking
 * only for what a listing cannot legally be published without, so a supervisor
 * who already knows what they want is not walked through nine screens to say it.
 */
export const simpleOpportunitySchema = z
  .object({
    title: requiredText("Project title", 180, 8),
    summary: requiredText("Plain-language summary", 400, 30),
    responsibilities: requiredText("What the student will do", 4000, 40),
    additionalInfo: requiredText("Additional information", 8000, 120),
    department: requiredText("Department", 160),
    researchFieldId: z.string().uuid("Choose a research field."),
    preferredDurations: arrayField(durationOptionSchema, {
      min: 1,
      max: 5,
      message: "Choose at least one length. Select them all if you are open to any of them.",
    }),
    hoursPerWeekMin: z.coerce.number().int().min(0).max(60),
    hoursPerWeekMax: z.coerce.number().int().min(0).max(60),
    deadline: requiredText("Application deadline", 20),
    locationMode: z.enum(["in_person", "hybrid", "remote"], { message: "Choose a location mode." }),
    compensation: z.enum(["paid", "volunteer"], { message: "Say whether the position is paid." }),
    compensationDetails: optionalText(1200),
    academicCreditAvailable: z.coerce.boolean().default(false),
    beginnerFriendly: z.coerce.boolean().default(false),
    priorResearchRequired: z.coerce.boolean().default(false),
  })
  .refine((value) => value.hoursPerWeekMax >= value.hoursPerWeekMin, {
    message: "The maximum hours cannot be lower than the minimum.",
    path: ["hoursPerWeekMax"],
  })
  .refine((value) => value.compensation !== "paid" || Boolean(value.compensationDetails), {
    message: "Describe the pay arrangement so students know what is offered before applying.",
    path: ["compensationDetails"],
  });

export const criterionInputSchema = z.object({
  type: z.enum([
    "skill",
    "coursework",
    "program",
    "year_level",
    "availability",
    "prior_research",
    "research_interest",
    "technique",
    "written_response",
    "academic_metric",
    "custom",
  ]),
  label: requiredText("Criterion label", 180, 3),
  description: optionalText(600),
  importance: z.enum(["required", "high", "medium", "low"]),
  configValue: optionalText(400),
});

export const questionInputSchema = z.object({
  type: z.enum([
    "short_text",
    "long_text",
    "yes_no",
    "numeric",
    "multiple_choice",
    "file_upload",
    "paper_response",
    "video_response",
  ]),
  prompt: requiredText("Question prompt", 600, 8),
  helpText: optionalText(400),
  required: z.coerce.boolean().default(true),
  options: optionalText(600),
  maxLength: z.coerce.number().int().min(50).max(8000).optional(),
});

export const paperStepSchema = z.object({
  materialTitle: optionalText(300),
  materialAuthors: optionalText(300),
  materialUrl: optionalText(500),
  materialDoi: optionalText(120),
  materialAbstract: optionalText(3000),
  materialContext: optionalText(1200),
  paperPrompt: optionalText(1200),
  includePaperQuestion: z.coerce.boolean().default(false),
});

export const videoStepSchema = z.object({
  videoResponseEnabled: z.coerce.boolean().default(false),
  videoPrompt: optionalText(600),
  videoMaxSeconds: z.coerce.number().int().min(15).max(180).default(60),
});

export const DEFAULT_PAPER_PROMPT =
  "After reviewing the research provided, describe one aspect you found particularly interesting and one direction you would be interested in exploring further.";

export type ProjectStepInput = z.infer<typeof projectStepSchema>;
export type LogisticsStepInput = z.infer<typeof logisticsStepSchema>;
