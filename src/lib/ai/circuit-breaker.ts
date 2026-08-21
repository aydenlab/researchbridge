import { aiCostControls } from "@/lib/env";
import { log } from "@/lib/log";

type BreakerState = { failures: number; openedAt: number | null };

const breakers = new Map<string, BreakerState>();

function stateFor(feature: string): BreakerState {
  const existing = breakers.get(feature) ?? { failures: 0, openedAt: null };
  breakers.set(feature, existing);
  return existing;
}

/**
 * Stops calling a provider that is currently failing.
 *
 * A run of provider errors normally means an outage, an exhausted account, or a
 * bad key. Retrying through it burns money and latency for responses that will
 * not arrive, so calls are held back until a cooldown passes and one probe is
 * allowed through to test recovery.
 */
export function breakerOpen(feature: string): boolean {
  const state = stateFor(feature);
  if (state.openedAt === null) return false;
  if (Date.now() - state.openedAt < aiCostControls.breakerCooldownMs) return true;

  state.openedAt = null;
  state.failures = 0;
  log.info("ai_breaker_half_open", { feature });
  return false;
}

export function recordBreakerSuccess(feature: string): void {
  const state = stateFor(feature);
  state.failures = 0;
  state.openedAt = null;
}

export function recordBreakerFailure(feature: string): void {
  const state = stateFor(feature);
  state.failures += 1;
  if (state.failures >= aiCostControls.breakerFailureThreshold && state.openedAt === null) {
    state.openedAt = Date.now();
    log.warn("ai_breaker_opened", { feature, failures: state.failures });
  }
}

export function resetBreakers(): void {
  breakers.clear();
}

export function breakerSnapshot(): Array<{ feature: string; open: boolean; failures: number }> {
  return [...breakers].map(([feature, state]) => ({
    feature,
    open: state.openedAt !== null,
    failures: state.failures,
  }));
}
