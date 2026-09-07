import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { runWeeklyDigest } from "./digest";

/**
 * Runs the weekly digest off ordinary traffic instead of a configured cron.
 *
 * The obvious objection to a timer inside the web process is that a restart
 * drops it and a second worker duplicates it. Neither applies here. There is no
 * timer: every heartbeat asks the database whether this week has been claimed,
 * and the claim is atomic, so any number of workers hitting this at the same
 * moment still produce exactly one send. A restart loses nothing because
 * nothing was being held in memory.
 *
 * What it does depend on is the site receiving some traffic during the week.
 * Railway's health check alone satisfies that, and a platform with no traffic
 * for a week has no applications to report on anyway.
 *
 * Set DIGEST_AUTORUN=false to turn this off and drive the endpoint yourself.
 */

/** Monday, to match the workflow. */
const SEND_WEEKDAY = 1;
const SEND_HOUR_UTC = 13;
/** How often one process is willing to ask the database. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

let lastCheckedAt = 0;
let running = false;

/** The moment this week's digest becomes due, in UTC. */
export function dueAt(now: Date): Date {
  const due = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), SEND_HOUR_UTC, 0, 0, 0),
  );
  // Step back to this week's Monday. getUTCDay is 0 for Sunday, which ISO
  // counts as the last day of the previous week rather than the first of this.
  const weekday = now.getUTCDay() === 0 ? 7 : now.getUTCDay();
  due.setUTCDate(due.getUTCDate() - (weekday - SEND_WEEKDAY));
  return due;
}

export function isDue(now: Date): boolean {
  return now.getTime() >= dueAt(now).getTime();
}

/**
 * Cheap enough to call on every heartbeat. Returns immediately; the digest, if
 * one is owed, runs detached so it can never slow down or fail the caller.
 */
export function maybeRunWeeklyDigest(now: Date = new Date()): void {
  if (!env.DIGEST_AUTORUN) return;
  if (running) return;
  if (!isDue(now)) return;
  if (now.getTime() - lastCheckedAt < CHECK_INTERVAL_MS) return;

  lastCheckedAt = now.getTime();
  running = true;

  void runWeeklyDigest({ now })
    .then((result) => {
      if (result.skipped) return;
      log.info("weekly_digest_autorun", {
        periodKey: result.periodKey,
        researchersNotified: result.researchersNotified,
        studentsNotified: result.studentsNotified,
        failures: result.failures,
      });
    })
    .catch((error) => {
      // Never rethrow: this is riding on a health check, and a failed digest
      // must not be able to make the service look unhealthy.
      log.error("weekly_digest_autorun_failed", { error });
    })
    .finally(() => {
      running = false;
    });
}

/** Test seam. The throttle is per process and would otherwise leak between cases. */
export function resetDigestScheduleForTests() {
  lastCheckedAt = 0;
  running = false;
}
