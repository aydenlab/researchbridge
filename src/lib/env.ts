import { z } from "zod";

const boolish = z
  .string()
  .optional()
  .transform((v) => v === undefined || v === "" ? undefined : v === "true" || v === "1");

const numeric = (fallback: number, predicate: (value: number) => boolean, expectation: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v.trim() === "" ? fallback : Number(v)))
    .refine((v) => Number.isFinite(v) && predicate(v), { message: `must be ${expectation}` });

const positiveInt = (fallback: number) => numeric(fallback, (v) => Number.isInteger(v) && v > 0, "a positive integer");

const nonNegativeNumber = (fallback: number) => numeric(fallback, (v) => v >= 0, "a number of zero or more");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().optional(),
  APP_URL: z.string().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(16).default("researchbridge_local_development_secret"),
  ADMIN_EMAILS: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  DIGEST_AUTORUN: boolish,
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),
  ANTHROPIC_PROMPT_CACHE_ENABLED: boolish,
  AI_MAX_CALLS_PER_MINUTE: positiveInt(20),
  AI_MAX_CALLS_PER_DAY: positiveInt(500),
  AI_MAX_CALLS_PER_SUBJECT_PER_HOUR: positiveInt(5),
  AI_DAILY_BUDGET_USD: nonNegativeNumber(25),
  AI_MONTHLY_BUDGET_USD: nonNegativeNumber(250),
  AI_MAX_INPUT_CHARS: positiveInt(24_000),
  AI_MAX_SECTION_CHARS: positiveInt(8_000),
  AI_RESPONSE_CACHE_TTL_HOURS: positiveInt(168),
  AI_NEGATIVE_CACHE_TTL_MINUTES: positiveInt(30),
  AI_BREAKER_FAILURE_THRESHOLD: positiveInt(4),
  AI_BREAKER_COOLDOWN_SECONDS: positiveInt(120),
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
  OPPORTUNITY_REVIEW_REQUIRED: boolish,
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new Error(`Invalid environment configuration. ${issues}`);
}

export const env = {
  ...parsed.data,
  // On by default so the digest works with no configuration at all. Turning it
  // off is for deployments that would rather drive the endpoint themselves.
  DIGEST_AUTORUN: parsed.data.DIGEST_AUTORUN ?? true,
};

export const isProduction = env.NODE_ENV === "production";

export const adminEmails: ReadonlySet<string> = new Set(
  (env.ADMIN_EMAILS ?? "")
    .split(/[,\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.includes("@")),
);

export function isBootstrapAdmin(email: string): boolean {
  return adminEmails.has(email.trim().toLowerCase());
}

export const aiCostControls = {
  promptCacheEnabled: env.ANTHROPIC_PROMPT_CACHE_ENABLED ?? true,
  maxCallsPerMinute: env.AI_MAX_CALLS_PER_MINUTE,
  maxCallsPerDay: env.AI_MAX_CALLS_PER_DAY,
  maxCallsPerSubjectPerHour: env.AI_MAX_CALLS_PER_SUBJECT_PER_HOUR,
  dailyBudgetUsd: env.AI_DAILY_BUDGET_USD,
  monthlyBudgetUsd: env.AI_MONTHLY_BUDGET_USD,
  maxInputChars: env.AI_MAX_INPUT_CHARS,
  maxSectionChars: env.AI_MAX_SECTION_CHARS,
  responseCacheTtlMs: env.AI_RESPONSE_CACHE_TTL_HOURS * 60 * 60 * 1000,
  negativeCacheTtlMs: env.AI_NEGATIVE_CACHE_TTL_MINUTES * 60 * 1000,
  breakerFailureThreshold: env.AI_BREAKER_FAILURE_THRESHOLD,
  breakerCooldownMs: env.AI_BREAKER_COOLDOWN_SECONDS * 1000,
} as const;

export const featureDefaults = {
  AI_ANALYSIS_ENABLED: env.AI_ANALYSIS_ENABLED ?? true,
  VIDEO_RESPONSES_ENABLED: env.VIDEO_RESPONSES_ENABLED ?? false,
  WAITLIST_ENABLED: env.WAITLIST_ENABLED ?? true,
  PUBLIC_SIGNUP_ENABLED: env.PUBLIC_SIGNUP_ENABLED ?? true,
  RESEARCHER_SIGNUP_ENABLED: env.RESEARCHER_SIGNUP_ENABLED ?? true,
  // Off by default: the pilot optimises for how fast a researcher gets from
  // wanting to recruit to having posted. Turn it on in /admin/system when there
  // are more researchers than can be vouched for individually.
  OPPORTUNITY_REVIEW_REQUIRED: env.OPPORTUNITY_REVIEW_REQUIRED ?? false,
} as const;

export type FeatureFlagKey = keyof typeof featureDefaults;
