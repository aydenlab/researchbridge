import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { runWeeklyDigest } from "./digest";

/**
 * Schedules the weekly digest inside the server process.
 *
 * The usual objection to a timer here is that a restart drops it and a second
 * worker duplicates it. Duplication is impossible because the run claims its
 * ISO week with one atomic insert, so any number of processes ticking at the
 * same moment still produce exactly one send. A dropped timer costs nothing
 * either: the next tick after a restart finds the week unclaimed and sends it,
 * and the window stays open all week rather than only at the send moment.
 *
 * This runs from instrumentation.ts, never from a request. It used to hang off
 * the health check, which was a mistake: that endpoint decides whether Railway
 * accepts a deployment, and nothing optional should be able to influence it.
 *
 * Set DIGEST_AUTORUN=false to turn this off and drive the endpoint yourself.
 */

/** Monday, to match the workflow. */
const SEND_WEEKDAY = 1;
const SEND_HOUR_UTC = 13;
/** How often one process is willing to ask the database. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
/** Long enough after boot that startup migrations have settled. */
const FIRST_CHECK_DELAY_MS = 60 * 1000;

let lastCheckedAt = 0;
let running = false;
let timer: ReturnType<typeof setInterval> | null = null;

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
 * Returns immediately. The digest, if one is owed, runs detached and swallows
 * its own failures, so nothing calling this can be slowed down or broken by it.
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

/**
 * Starts the once-per-process ticker. Safe to call more than once; the second
 * call is a no-op rather than a second timer.
 */
export function startDigestScheduler(): void {
  if (timer) return;
  if (!env.DIGEST_AUTORUN) {
    log.info("digest_scheduler_disabled", {});
    return;
  }

  const tick = () => {
    try {
      maybeRunWeeklyDigest();
    } catch (error) {
      // maybeRunWeeklyDigest is already defensive; this is the belt to its
      // braces, because an exception escaping a timer would take the process
      // down and a digest is never worth that.
      log.error("digest_scheduler_tick_failed", { error });
    }
  };

  timer = setInterval(tick, CHECK_INTERVAL_MS);
  // Never hold the process open on shutdown for the sake of a digest.
  timer.unref?.();

  const first = setTimeout(tick, FIRST_CHECK_DELAY_MS);
  first.unref?.();

  log.info("digest_scheduler_started", { intervalMinutes: CHECK_INTERVAL_MS / 60000 });
}

export function stopDigestSchedulerForTests() {
  if (timer) clearInterval(timer);
  timer = null;
}
