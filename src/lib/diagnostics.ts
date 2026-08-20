import { sql } from "drizzle-orm";
import { db } from "@/db";
import { anthropicAvailable } from "@/lib/ai/anthropic";
import { env } from "@/lib/env";

export type DependencyStatus = {
  ok: boolean;
  detail: string;
};

export type Diagnostics = {
  process: "ok";
  database: DependencyStatus;
  migrations: DependencyStatus;
  configuration: DependencyStatus;
};

function describeError(error: unknown): string {
  const seen = new Set<unknown>();
  const parts: string[] = [];
  let current: unknown = error;

  while (current && !seen.has(current) && parts.length < 4) {
    seen.add(current);

    const record = current as { message?: unknown; code?: unknown; cause?: unknown; errors?: unknown };
    const message = typeof record.message === "string" ? record.message.split("\n")[0] : null;
    const code = typeof record.code === "string" ? record.code : null;

    if (message) parts.push(code ? `${code}: ${message}` : message);
    else if (code) parts.push(code);

    if (Array.isArray(record.errors) && record.errors.length > 0) {
      current = record.errors[0];
      continue;
    }
    current = record.cause;
  }

  return parts.length > 0 ? [...new Set(parts)].join(" | ") : "Unknown error";
}

export async function checkDatabase(): Promise<DependencyStatus> {
  try {
    await db.execute(sql`select 1`);
    return { ok: true, detail: "Connected" };
  } catch (error) {
    return { ok: false, detail: describeError(error) };
  }
}

export async function checkMigrations(): Promise<DependencyStatus> {
  try {
    const result = await db.execute(sql`select to_regclass('public.users') is not null as present`);
    const rows = result.rows as { present: boolean | null }[];
    const present = Boolean(rows[0]?.present);
    return present
      ? { ok: true, detail: "Applied" }
      : { ok: false, detail: "Tables are missing. Run npm run db:migrate against this database." };
  } catch (error) {
    return { ok: false, detail: describeError(error) };
  }
}

export function checkConfiguration(): DependencyStatus {
  const problems: string[] = [];

  if (!process.env.DATABASE_URL?.trim()) {
    problems.push("DATABASE_URL is not set");
  }
  if (env.APP_URL.includes("localhost") && env.NODE_ENV === "production") {
    problems.push("APP_URL still points at localhost, so session cookies and email links will be wrong");
  }
  if (env.NODE_ENV === "production" && env.SESSION_SECRET === "researchbridge_local_development_secret") {
    problems.push("SESSION_SECRET is still the development default");
  }
  if (env.NODE_ENV === "production" && env.EMAIL_PROVIDER === "console") {
    problems.push("EMAIL_PROVIDER is console, so verification codes are only written to the server log");
  }

  return problems.length === 0
    ? { ok: true, detail: "Complete" }
    : { ok: false, detail: problems.join("; ") };
}

export async function collectDiagnostics(): Promise<Diagnostics> {
  const database = await checkDatabase();
  const migrations = database.ok ? await checkMigrations() : { ok: false, detail: "Not checked, no database connection" };

  return {
    process: "ok",
    database,
    migrations,
    configuration: checkConfiguration(),
  };
}

export function summarizeEnvironment() {
  return {
    nodeEnv: env.NODE_ENV,
    appUrl: env.APP_URL,
    databaseConfigured: Boolean(process.env.DATABASE_URL?.trim()),
    anthropicConfigured: anthropicAvailable(),
    emailProvider: env.EMAIL_PROVIDER,
    fileStorageProvider: env.FILE_STORAGE_PROVIDER,
    adminEmailsConfigured: Boolean(process.env.ADMIN_EMAILS?.trim()),
  };
}
