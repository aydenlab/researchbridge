import { aiCostControls } from "@/lib/env";
import { log } from "@/lib/log";

type BreakerState = { consecutiveFailures: number; openedAt: number | null };

const breakers = new Map<string, BreakerState>();

function stateFor(feature: string): BreakerState {
  const existing = breakers.get(feature);
  if (existing) return existing;
  const fresh: BreakerState = { consecutiveFailures: 0, openedAt: null };
  breakers.set(feature, fresh);
  return fresh;
}

/**
 * Stops calling a provider that is currently failing.
 *
 * A run of provider errors normally means an outage, an exhausted account, or a
 * bad key. Retrying through it burns money and latency for responses that will
 * not arrive, so the breaker holds calls back until a cooldown passes.
 */
export function breakerOpen(feature: string): boolean {
  const state = stateFor(feature);
  if (state.openedAt === null) return false;

  if (Date.now() - state.openedAt >= aiCostControls.breakerCooldownMs) {
    // Half open: let the next call through and judge the provider on its result.
    state.openedAt = null;
    state.consecutiveFailures = 0;
    log.info("ai_breaker_half_open", { feature });
    return false;
  }
  return true;
}

export function recordBreakerSuccess(feature: string): void {
  const state = stateFor(feature);
  if (state.consecutiveFailures > 0 || state.openedAt !== null) {
    log.info("ai_breaker_closed", { feature });
  }
  state.consecutiveFailures = 0;
  state.openedAt = null;
}

export function recordBreakerFailure(feature: string): void {
  const state = stateFor(feature);
  state.consecutiveFailures += 1;
  if (state.consecutiveFailures >= aiCostControls.breakerFailureThreshold && state.openedAt === null) {
    state.openedAt = Date.now();
    log.warn("ai_breaker_opened", { feature, consecutiveFailures: state.consecutiveFailures });
  }
}

export function resetBreakers(): void {
  breakers.clear();
}

export function breakerSnapshot(): Array<{ feature: string; open: boolean; consecutiveFailures: number }> {
  return [...breakers.entries()].map(([feature, state]) => ({
    feature,
    open: state.openedAt !== null,
    consecutiveFailures: state.consecutiveFailures,
  }));
}
