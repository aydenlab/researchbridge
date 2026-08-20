import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;
export type DriverName = "postgres" | "pglite";

declare global {
  var __rbDb: Database | undefined;
  var __rbDriver: DriverName | undefined;
}

export const localDataDir = path.join(process.cwd(), ".pgdata");

function serialize(client: PGlite): PGlite {
  let queue: Promise<unknown> = Promise.resolve();

  const chain = <T>(work: () => Promise<T>): Promise<T> => {
    const next = queue.then(work, work);
    queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  return new Proxy(client, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;
      if (property !== "query" && property !== "exec" && property !== "transaction") return value.bind(target);
      return (...args: unknown[]) => chain(() => (value as (...a: unknown[]) => Promise<unknown>).apply(target, args));
    },
  }) as PGlite;
}

export function sslFor(url: string): { rejectUnauthorized: boolean } | undefined {
  let host = "";
  let sslmode: string | null = null;

  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    sslmode = parsed.searchParams.get("sslmode");
  } catch {
    return undefined;
  }

  if (sslmode === "disable") return undefined;
  if (sslmode === "require" || sslmode === "prefer" || sslmode === "no-verify") {
    return { rejectUnauthorized: false };
  }
  if (sslmode === "verify-ca" || sslmode === "verify-full") return { rejectUnauthorized: true };

  const privateHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".internal") ||
    host.endsWith(".local");

  return privateHost ? undefined : { rejectUnauthorized: false };
}

function createDatabase(): Database {
  const url = process.env.DATABASE_URL?.trim();

  if (url) {
    const pool = new Pool({ connectionString: url, max: 10, ssl: sslFor(url) });
    globalThis.__rbDriver = "postgres";
    return drizzlePg(pool, { schema }) as unknown as Database;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      [
        "DATABASE_URL is not set, and the embedded PGlite database cannot be used in production.",
        "PGlite lives inside a single Node process, so a multi-worker server would give each worker its own database and silently lose writes.",
        "",
        "On Railway, adding the PostgreSQL plugin creates a separate service. Your application service does not inherit its variables automatically.",
        "Open your application service, go to Variables, and add a reference to the database service:",
        "",
        "  DATABASE_URL = ${{Postgres.DATABASE_URL}}",
        "",
        "Replace Postgres with the exact name of your database service, then redeploy.",
      ].join("\n"),
    );
  }

  const client = serialize(new PGlite(localDataDir));
  globalThis.__rbDriver = "pglite";
  return drizzlePglite(client, { schema }) as unknown as Database;
}

function resolveDatabase(): Database {
  if (!globalThis.__rbDb) {
    globalThis.__rbDb = createDatabase();
  }
  return globalThis.__rbDb;
}

export const db: Database = new Proxy({} as Database, {
  get(_target, property, receiver) {
    const instance = resolveDatabase() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(instance, property, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
  has(_target, property) {
    return Reflect.has(resolveDatabase() as unknown as object, property);
  },
});

export function activeDriver(): DriverName {
  resolveDatabase();
  return globalThis.__rbDriver ?? "pglite";
}

export { schema };
export * from "./schema";
