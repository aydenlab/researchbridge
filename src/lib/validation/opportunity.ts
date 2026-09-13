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

// An empty number input posts "", which would otherwise coerce to 0 hours.
const optionalHours = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.coerce.number().int().min(0).max(60).nullable(),
);

export const projectStepSchema = z.object({
  title: requiredText("Project title", 180, 8),
  summary: optionalText(400),
  description: optionalText(8000),
  projectGoals: optionalText(1200),
  department: requiredText("Department", 160),
  labName: optionalText(160),
  researchFieldIds: arrayField(z.string().uuid(), { min: 1, max: 8, message: "Choose at least one research field." }),
});

export const roleStepSchema = z.object({
  responsibilities: optionalText(4000),
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

/** What the "Other" card in a single-choice group submits instead of an id. */
export const OTHER_CHOICE = "other";

const uuidValue = z.string().uuid();

const DURATION_REQUIRED = "Choose at least one length, or describe your own under Other.";

export const logisticsStepSchema = z
  .object({
    numberOfOpenings: z.coerce.number().int().min(1, "There must be at least one opening.").max(50),
    startDate: optionalText(20),
    // A posting made with only a free-text length has no structured duration to
    // reselect here, so requiring one would refuse an edit that changed nothing.
    preferredDurations: arrayField(durationOptionSchema, { max: 5 }),
    duration: optionalText(160),
    hoursPerWeekMin: optionalHours,
    hoursPerWeekMax: optionalHours,
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
  .refine((value) => value.preferredDurations.length > 0 || Boolean(value.duration), {
    message: DURATION_REQUIRED,
    path: ["preferredDurations"],
  })
  .refine(
    (value) =>
      value.hoursPerWeekMin === null || value.hoursPerWeekMax === null || value.hoursPerWeekMax >= value.hoursPerWeekMin,
    {
      message: "The maximum hours cannot be lower than the minimum.",
      path: ["hoursPerWeekMax"],
    },
  );

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
  summary: optionalText(1200),
  authorshipOffered: z.coerce.boolean().default(false),
  reviewTasks: arrayField(reviewTaskSchema, {
    min: 1,
    max: 8,
    message: "Choose at least one part you need help with.",
  }),
});

/**
 * The one-page posting form, and the only way a listing is created. It asks
 * only for what a listing cannot be published without, so a supervisor who
 * already knows what they want is not walked through nine screens to say it.
 * The step forms below still exist for editing a position after the fact.
 */
export const simpleOpportunitySchema = z
  .object({
    title: requiredText("Project title", 180, 8),
    summary: optionalText(400),
    department: requiredText("Department", 160),
    // Either an existing field, or OTHER_CHOICE with the name typed alongside it.
    // The taxonomy is not complete and a supervisor should not have to file their
    // project under the nearest wrong heading.
    researchFieldId: z.string().trim().min(1, "Choose a research field."),
    otherResearchField: optionalText(160),
    preferredDurations: arrayField(durationOptionSchema, { max: 5 }),
    otherDuration: optionalText(160),
    deadline: requiredText("Application deadline", 20),
    locationMode: z.enum(["in_person", "hybrid", "remote"], { message: "Choose a location mode." }),
    compensation: z.enum(["paid", "volunteer"], { message: "Say whether the position is paid." }),
    academicCreditAvailable: z.coerce.boolean().default(false),
    beginnerFriendly: z.coerce.boolean().default(false),
    priorResearchRequired: z.coerce.boolean().default(false),
  })
  .refine((value) => value.researchFieldId === OTHER_CHOICE || uuidValue.safeParse(value.researchFieldId).success, {
    message: "Choose a research field.",
    path: ["researchFieldId"],
  })
  .refine((value) => value.researchFieldId !== OTHER_CHOICE || Boolean(value.otherResearchField), {
    message: "Name the research field this project belongs to.",
    path: ["otherResearchField"],
  })
  .refine((value) => value.preferredDurations.length > 0 || Boolean(value.otherDuration), {
    message: DURATION_REQUIRED,
    path: ["preferredDurations"],
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
