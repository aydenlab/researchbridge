import { rerunApplicationAnalyses } from "@/lib/criteria/rerun";
import { rescoreDeterministicCriteria } from "@/lib/criteria/rescore";
import { log } from "@/lib/log";
import { refreshStaleEvidence } from "./refresh";

/**
 * Reads resumes the model has not read yet, and re-runs written-response
 * analysis whose inputs have changed, in the server process, a batch an hour. Startup only does the quick plain-text reading so a deploy is never
 * held up by model calls; this catches up afterwards, inside the same rate
 * limits and spend caps as every other model call, and stops for the hour at
 * the first sign of throttling or an exhausted budget.
 */
const INTERVAL_MS = 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 2 * 60 * 1000;
const BATCH = 40;

let running = false;
let timer: ReturnType<typeof setInterval> | null = null;

export async function runEvidenceBackfill(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const result = await refreshStaleEvidence({ useModel: true, limit: BATCH });
    if (result.updated > 0) await rescoreDeterministicCriteria();
    log.info("evidence_backfill_completed", result);
    // Written-response analysis whose inputs changed (new resume readings,
    // edited criteria, a new prompt) is re-run here too, a batch at a time.
    const analyses = await rerunApplicationAnalyses({ limit: BATCH });
    log.info("analysis_backfill_completed", analyses);
  } catch (error) {
    log.error("evidence_backfill_failed", { error: String(error) });
  } finally {
    running = false;
  }
}

export function startEvidenceScheduler(): void {
  if (timer) return;
  setTimeout(() => void runEvidenceBackfill(), FIRST_RUN_DELAY_MS).unref?.();
  timer = setInterval(() => void runEvidenceBackfill(), INTERVAL_MS);
  timer.unref?.();
}
