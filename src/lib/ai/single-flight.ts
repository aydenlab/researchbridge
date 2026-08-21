import { log } from "@/lib/log";

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Collapses concurrent identical work onto one promise.
 *
 * Two researchers opening the same applicant at the same moment, or a double
 * form submission, would otherwise pay for the same analysis twice. This only
 * spans one process; the database cache covers the cross-worker case.
 */
export async function singleFlight<T>(key: string, work: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) {
    log.debug("ai_call_joined_in_flight", { key });
    return existing as Promise<T>;
  }

  const pending = work().finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, pending);
  return pending;
}

export function inFlightCount(): number {
  return inFlight.size;
}

export function resetSingleFlight(): void {
  inFlight.clear();
}
