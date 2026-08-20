import { eq } from "drizzle-orm";
import { db, featureFlags } from "@/db";
import { featureDefaults, type FeatureFlagKey } from "./env";

let cache: Map<string, boolean> | null = null;
let cacheStamp = 0;
const TTL_MS = 30_000;

async function load(): Promise<Map<string, boolean>> {
  const now = Date.now();
  if (cache && now - cacheStamp < TTL_MS) return cache;
  const next = new Map<string, boolean>();
  try {
    const rows = await db.select().from(featureFlags);
    for (const row of rows) next.set(row.key, row.enabled);
  } catch {
    return new Map(Object.entries(featureDefaults));
  }
  cache = next;
  cacheStamp = now;
  return next;
}

export async function isEnabled(key: FeatureFlagKey): Promise<boolean> {
  const flags = await load();
  return flags.get(key) ?? featureDefaults[key];
}

export async function allFlags(): Promise<Record<FeatureFlagKey, boolean>> {
  const flags = await load();
  const entries = Object.keys(featureDefaults) as FeatureFlagKey[];
  return Object.fromEntries(entries.map((key) => [key, flags.get(key) ?? featureDefaults[key]])) as Record<FeatureFlagKey, boolean>;
}

export async function setFlag(key: FeatureFlagKey, enabled: boolean) {
  await db
    .insert(featureFlags)
    .values({ key, enabled, updatedAt: new Date() })
    .onConflictDoUpdate({ target: featureFlags.key, set: { enabled, updatedAt: new Date() } });
  cache = null;
}

export function invalidateFlagCache() {
  cache = null;
}

export { type FeatureFlagKey };
