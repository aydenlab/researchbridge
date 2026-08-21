import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { aiRateLimits, db } from "@/db";
import { log } from "@/lib/log";

export type RateWindow = { bucket: string; limit: number; windowMs: number };

const PRUNE_AFTER_MS = 2 * 24 * 60 * 60 * 1000;

function windowStartFor(now: number, windowMs: number): Date {
  return new Date(Math.floor(now / windowMs) * windowMs);
}

/**
 * Fixed-window counters held in the database so every worker shares one budget.
 *
 * Counts are read before they are written: a request that is already over the
 * line is rejected without consuming a slot, so a rejected caller does not push
 * the window further out of reach.
 */
export async function consumeRateLimit(windows: RateWindow[]): Promise<{ allowed: boolean }> {
  if (windows.length === 0) return { allowed: true };

  const now = Date.now();
  const rows = windows.map((window) => ({ ...window, windowStart: windowStartFor(now, window.windowMs) }));

  const existing = await db
    .select({ bucket: aiRateLimits.bucket, windowStart: aiRateLimits.windowStart, count: aiRateLimits.count })
    .from(aiRateLimits)
    .where(inArray(aiRateLimits.bucket, rows.map((row) => row.bucket)));

  const counts = new Map(existing.map((row) => [`${row.bucket}@${row.windowStart.getTime()}`, row.count]));

  for (const row of rows) {
    const used = counts.get(`${row.bucket}@${row.windowStart.getTime()}`) ?? 0;
    if (used >= row.limit) {
      log.warn("ai_rate_limited", { bucket: row.bucket, limit: row.limit, used });
      return { allowed: false };
    }
  }

  for (const row of rows) {
    await db
      .insert(aiRateLimits)
      .values({ bucket: row.bucket, windowStart: row.windowStart, count: 1 })
      .onConflictDoUpdate({
        target: [aiRateLimits.bucket, aiRateLimits.windowStart],
        set: { count: sql`${aiRateLimits.count} + 1` },
      });
  }

  // Windows that have rolled over are dead weight. Clearing them occasionally
  // keeps the table at roughly the number of live buckets.
  if (Math.random() < 0.02) {
    await db
      .delete(aiRateLimits)
      .where(lt(aiRateLimits.windowStart, new Date(now - PRUNE_AFTER_MS)))
      .catch((caught) => log.warn("ai_rate_limit_prune_failed", { error: caught }));
  }

  return { allowed: true };
}

/** Hands a slot back when a call never reached the provider. */
export async function releaseRateLimit(windows: RateWindow[]): Promise<void> {
  const now = Date.now();
  for (const window of windows) {
    await db
      .update(aiRateLimits)
      .set({ count: sql`greatest(${aiRateLimits.count} - 1, 0)` })
      .where(
        and(eq(aiRateLimits.bucket, window.bucket), eq(aiRateLimits.windowStart, windowStartFor(now, window.windowMs))),
      );
  }
}
