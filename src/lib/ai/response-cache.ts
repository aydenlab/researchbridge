import crypto from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { aiResponseCache, db } from "@/db";
import { log } from "@/lib/log";

export type CachedResponse =
  | { status: "ok"; result: Record<string, unknown>; model: string | null }
  | { status: "error" };

/**
 * Deterministic JSON, so two structurally identical inputs always hash the same.
 * Plain JSON.stringify keeps insertion order, which would scatter cache entries
 * across keys that mean the same thing.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(",")}}`;
}

export function cacheKeyFor(namespace: string, payload: unknown): string {
  return `${namespace}:${crypto.createHash("sha256").update(stableStringify(payload)).digest("hex")}`;
}

export async function readResponseCache(cacheKey: string): Promise<CachedResponse | null> {
  const [row] = await db.select().from(aiResponseCache).where(eq(aiResponseCache.cacheKey, cacheKey)).limit(1);
  if (!row) return null;

  if (row.expiresAt.getTime() <= Date.now()) {
    await db.delete(aiResponseCache).where(eq(aiResponseCache.cacheKey, cacheKey));
    return null;
  }

  await db
    .update(aiResponseCache)
    .set({ hits: sql`${aiResponseCache.hits} + 1` })
    .where(eq(aiResponseCache.cacheKey, cacheKey));

  if (row.status === "ok" && row.result) return { status: "ok", result: row.result, model: row.model };
  return { status: "error" };
}

export async function writeResponseCache(input: {
  cacheKey: string;
  feature: string;
  model: string | null;
  ttlMs: number;
  result?: Record<string, unknown>;
  errorCode?: string;
}): Promise<void> {
  const row = {
    feature: input.feature,
    model: input.model,
    status: input.errorCode ? "error" : "ok",
    errorCode: input.errorCode ?? null,
    result: input.result ?? null,
    hits: 0,
    expiresAt: new Date(Date.now() + input.ttlMs),
    createdAt: new Date(),
  };

  try {
    await db
      .insert(aiResponseCache)
      .values({ cacheKey: input.cacheKey, ...row })
      .onConflictDoUpdate({ target: aiResponseCache.cacheKey, set: row });
  } catch (caught) {
    log.error("ai_cache_write_failed", { feature: input.feature, error: caught });
  }
}
