import { sql } from "drizzle-orm";
import { aiUsageEvents, db } from "@/db";
import { aiCostControls } from "@/lib/env";
import { log } from "@/lib/log";
import { estimateCostUsd, type TokenUsage } from "./pricing";

export type SpendSummary = {
  dayUsd: number;
  monthUsd: number;
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
  exceeded: false | "daily" | "monthly";
  callsThisMonth: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheHitRate: number;
};

/** Records one completed call and returns what it cost. */
export async function recordUsage(input: {
  feature: string;
  model: string | null;
  outcome: "ok" | "error" | "served_from_cache";
  errorCode?: string;
  subjectKey?: string;
  usage?: TokenUsage;
  latencyMs?: number;
}): Promise<number> {
  const usage = input.usage ?? { inputTokens: 0, outputTokens: 0 };
  const costUsd = input.outcome === "ok" ? estimateCostUsd(input.model, usage) : 0;

  try {
    await db.insert(aiUsageEvents).values({
      feature: input.feature,
      model: input.model,
      outcome: input.outcome,
      errorCode: input.errorCode ?? null,
      subjectKey: input.subjectKey ?? null,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheCreationInputTokens: usage.cacheCreationInputTokens ?? 0,
      cacheReadInputTokens: usage.cacheReadInputTokens ?? 0,
      costUsd: costUsd.toFixed(6),
      latencyMs: input.latencyMs ?? null,
    });
  } catch (caught) {
    // Accounting must never take down the feature it is measuring.
    log.error("ai_usage_record_failed", { feature: input.feature, error: caught });
  }

  return costUsd;
}

/**
 * Spend and token totals for the current UTC day and month.
 *
 * One indexed pass over the usage events. The daily call ceiling bounds how many
 * rows a month can hold, so a rollup table would only duplicate this.
 */
export async function spendSummary(): Promise<SpendSummary> {
  const day = sql`date_trunc('day', now() at time zone 'utc')`;
  const month = sql`date_trunc('month', now() at time zone 'utc')`;
  const at = sql`${aiUsageEvents.createdAt} at time zone 'utc'`;

  const [totals] = await db
    .select({
      dayUsd: sql<string>`coalesce(sum(${aiUsageEvents.costUsd}) filter (where ${at} >= ${day}), 0)`,
      monthUsd: sql<string>`coalesce(sum(${aiUsageEvents.costUsd}) filter (where ${at} >= ${month}), 0)`,
      calls: sql<number>`count(*) filter (where ${at} >= ${month} and ${aiUsageEvents.outcome} = 'ok')::int`,
      inputTokens: sql<number>`coalesce(sum(${aiUsageEvents.inputTokens}) filter (where ${at} >= ${month}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${aiUsageEvents.outputTokens}) filter (where ${at} >= ${month}), 0)::int`,
      cacheWrite: sql<number>`coalesce(sum(${aiUsageEvents.cacheCreationInputTokens}) filter (where ${at} >= ${month}), 0)::int`,
      cacheRead: sql<number>`coalesce(sum(${aiUsageEvents.cacheReadInputTokens}) filter (where ${at} >= ${month}), 0)::int`,
    })
    .from(aiUsageEvents);

  const dayUsd = Number(totals.dayUsd);
  const monthUsd = Number(totals.monthUsd);
  const promptTokens = totals.inputTokens + totals.cacheWrite + totals.cacheRead;

  return {
    dayUsd,
    monthUsd,
    dailyLimitUsd: aiCostControls.dailyBudgetUsd,
    monthlyLimitUsd: aiCostControls.monthlyBudgetUsd,
    exceeded:
      monthUsd >= aiCostControls.monthlyBudgetUsd
        ? "monthly"
        : dayUsd >= aiCostControls.dailyBudgetUsd
          ? "daily"
          : false,
    callsThisMonth: totals.calls,
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    cacheReadInputTokens: totals.cacheRead,
    cacheHitRate: promptTokens === 0 ? 0 : totals.cacheRead / promptTokens,
  };
}
