import { z } from "zod";
import { arrayField } from "./shared";

const trimmed = (max: number) => z.string().trim().max(max);
const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

const optionalUrl = z
  .string()
  .trim()
  .max(400)
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null))
  .refine((value) => value === null || /^https?:\/\/\S+$/i.test(value), {
    message: "Enter a full web address starting with http or https.",
  });

const optionalOrcid = z
  .string()
  .trim()
  .max(40)
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null))
  .refine((value) => value === null || /^(?:https?:\/\/orcid\.org\/)?\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(value), {
    message: "Enter an ORCID iD in the form 0000-0002-1825-0097.",
  });

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null))
  .refine((value) => value === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value), {
    message: "Enter a valid email address.",
  });

export const studentBasicsSchema = z.object({
  firstName: requiredText("First name", 80),
  lastName: requiredText("Last name", 80),
  preferredName: optionalText(80),
  degreeLevel: z.enum(["undergraduate", "masters", "phd", "professional", "postdoctoral", "other"], {
    message: "Choose your degree level.",
  }),
  program: requiredText("Program", 160),
  faculty: optionalText(160),
  specialization: optionalText(160),
  yearLevel: z.coerce.number().int().min(1, "Year of study must be at least 1.").max(12, "Year of study looks too high."),
  graduationYear: z.coerce
    .number()
    .int()
    .min(2020, "Enter a graduation year of 2020 or later.")
    .max(2040, "Enter a graduation year of 2040 or earlier."),
  linkedinUrl: optionalUrl,
  orcidId: optionalOrcid,
});

export const studentAcademicsSchema = z.object({
  scaleId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  metricValue: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  metricLabel: optionalText(120),
  distinctions: optionalText(1200),
  courseCodes: arrayField(z.string().trim().max(40), { max: 60 }),
});

export const studentInterestsSchema = z.object({
  researchFieldIds: arrayField(z.string().uuid(), { max: 24 }),
  customInterests: arrayField(z.string().trim().min(1).max(80), { max: 12 }),
  researchInterestSummary: optionalText(1500),
});

export const studentSkillEntrySchema = z.object({
  name: z.string().trim().min(1).max(80),
  proficiency: z.enum(["exposure", "working", "proficient", "advanced"]).optional(),
  context: trimmed(300).optional(),
});

export const studentSkillsSchema = z.object({
  skills: arrayField(studentSkillEntrySchema, { max: 40 }),
});

export const experienceSchema = z.object({
  id: z.string().uuid().optional(),
  organization: requiredText("Organization or lab", 160),
  supervisor: optionalText(160),
  title: optionalText(160),
  startDate: optionalText(20),
  endDate: optionalText(20),
  description: optionalText(3000),
  techniques: arrayField(z.string().trim().max(80), { max: 20 }),
  outputs: arrayField(z.string().trim().max(80), { max: 10 }),
});

export const studentAvailabilitySchema = z.object({
  desiredStartDate: optionalText(20),
  weeklyHours: z.coerce.number().int().min(0, "Hours cannot be negative.").max(60, "That is more hours than a full week."),
  semesters: arrayField(z.enum(["Fall", "Winter", "Spring", "Summer"]), { max: 4 }),
  summerAvailable: z.coerce.boolean().default(false),
  locationPreference: z.enum(["in_person", "hybrid", "remote"], { message: "Choose a location preference." }),
  scheduleNotes: optionalText(800),
});

export const researcherProfileSchema = z.object({
  firstName: requiredText("First name", 80),
  lastName: requiredText("Last name", 80),
  researcherType: z.enum(
    [
      "faculty",
      "professor",
      "principal_investigator",
      "postdoc",
      "phd_student",
      "masters_student",
      "lab_manager",
      "research_staff",
      "student_lead",
      "other",
    ],
    { message: "Choose the role that best describes you." },
  ),
  title: optionalText(160),
  faculty: optionalText(160),
  department: requiredText("Department", 160),
  labName: optionalText(160),
  labWebsite: optionalUrl,
  personalWebsite: optionalUrl,
  linkedinUrl: optionalUrl,
  orcidId: optionalOrcid,
  contactEmail: optionalEmail,
  biography: requiredText("Short biography", 2500),
  recruitingOnBehalfOf: z.enum(["personally", "lab", "another_investigator"], {
    message: "Tell us who you are recruiting for.",
  }),
  researchFieldIds: arrayField(z.string().uuid(), { min: 1, max: 12, message: "Choose at least one research area." }),
});

export type StudentBasicsInput = z.infer<typeof studentBasicsSchema>;
export type ResearcherProfileInput = z.infer<typeof researcherProfileSchema>;
