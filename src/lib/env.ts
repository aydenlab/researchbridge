import { z } from "zod";

const boolish = z
  .string()
  .optional()
  .transform((v) => v === undefined || v === "" ? undefined : v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().optional(),
  APP_URL: z.string().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(16).default("researchbridge_local_development_secret"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),
  EMAIL_PROVIDER: z.enum(["console", "resend", "smtp"]).default("console"),
  EMAIL_FROM: z.string().default("ResearchBridge <hello@myresearchbridge.com>"),
  EMAIL_API_KEY: z.string().optional(),
  FILE_STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  FILE_STORAGE_BUCKET: z.string().optional(),
  FILE_STORAGE_PUBLIC_URL: z.string().optional(),
  AI_ANALYSIS_ENABLED: boolish,
  VIDEO_RESPONSES_ENABLED: boolish,
  WAITLIST_ENABLED: boolish,
  PUBLIC_SIGNUP_ENABLED: boolish,
  RESEARCHER_SIGNUP_ENABLED: boolish,
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new Error(`Invalid environment configuration. ${issues}`);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";

export const featureDefaults = {
  AI_ANALYSIS_ENABLED: env.AI_ANALYSIS_ENABLED ?? true,
  VIDEO_RESPONSES_ENABLED: env.VIDEO_RESPONSES_ENABLED ?? false,
  WAITLIST_ENABLED: env.WAITLIST_ENABLED ?? true,
  PUBLIC_SIGNUP_ENABLED: env.PUBLIC_SIGNUP_ENABLED ?? true,
  RESEARCHER_SIGNUP_ENABLED: env.RESEARCHER_SIGNUP_ENABLED ?? true,
} as const;

export type FeatureFlagKey = keyof typeof featureDefaults;
