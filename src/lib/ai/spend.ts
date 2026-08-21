import { gte, sql } from "drizzle-orm";
import { aiSpendDaily, aiUsageEvents, db } from "@/db";
import { aiCostControls } from "@/lib/env";
import { log } from "@/lib/log";
import { estimateCostUsd, type TokenUsage } from "./pricing";

export type UsageOutcome = "ok" | "error" | "blocked" | "served_from_cache";

export type SpendRecord = {
  feature: string;
  model: string | null;
  outcome: UsageOutcome;
  errorCode?: string | null;
  subjectKey?: string | null;
  usage?: TokenUsage;
  latencyMs?: number;
};

export type BudgetStatus = {
  dayUsd: number;
  monthUsd: number;
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
  exceeded: false | "daily" | "monthly";
};

function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function utcMonthStart(now = new Date()): string {
  return `${now.toISOString().slice(0, 7)}-01`;
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Writes one usage event and rolls the same numbers into a per-day total.
 *
 * The rollup exists so the budget check stays a single small read no matter how
 * many calls the pilot has made.
 */
export async function recordUsage(record: SpendRecord): Promise<number> {
  const usage: TokenUsage = record.usage ?? { inputTokens: 0, outputTokens: 0 };
  const costUsd = record.outcome === "ok" ? estimateCostUsd(record.model, usage) : 0;
  const cost = costUsd.toFixed(6);
  const billable = record.outcome === "ok" ? 1 : 0;

  try {
    await db.insert(aiUsageEvents).values({
      feature: record.feature,
      model: record.model,
      outcome: record.outcome,
      errorCode: record.errorCode ?? null,
      subjectKey: record.subjectKey ?? null,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheCreationInputTokens: usage.cacheCreationInputTokens ?? 0,
      cacheReadInputTokens: usage.cacheReadInputTokens ?? 0,
      costUsd: cost,
      latencyMs: record.latencyMs ?? null,
    });

    await db
      .insert(aiSpendDaily)
      .values({
        day: utcDay(),
        calls: billable,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheCreationInputTokens: usage.cacheCreationInputTokens ?? 0,
        cacheReadInputTokens: usage.cacheReadInputTokens ?? 0,
        costUsd: cost,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: aiSpendDaily.day,
        set: {
          calls: sql`${aiSpendDaily.calls} + ${billable}`,
          inputTokens: sql`${aiSpendDaily.inputTokens} + ${usage.inputTokens}`,
          outputTokens: sql`${aiSpendDaily.outputTokens} + ${usage.outputTokens}`,
          cacheCreationInputTokens: sql`${aiSpendDaily.cacheCreationInputTokens} + ${usage.cacheCreationInputTokens ?? 0}`,
          cacheReadInputTokens: sql`${aiSpendDaily.cacheReadInputTokens} + ${usage.cacheReadInputTokens ?? 0}`,
          costUsd: sql`${aiSpendDaily.costUsd} + cast(${cost} as numeric)`,
          updatedAt: new Date(),
        },
      });
  } catch (caught) {
    // Accounting must never take down the feature it is measuring.
    log.error("ai_usage_record_failed", { feature: record.feature, error: caught });
  }

  return costUsd;
}

export async function budgetStatus(): Promise<BudgetStatus> {
  const { dailyBudgetUsd, monthlyBudgetUsd } = aiCostControls;

  const rows = await db
    .select({ day: aiSpendDaily.day, costUsd: aiSpendDaily.costUsd })
    .from(aiSpendDaily)
    .where(gte(aiSpendDaily.day, utcMonthStart()));

  const today = utcDay();
  let dayUsd = 0;
  let monthUsd = 0;
  for (const row of rows) {
    const cost = toNumber(row.costUsd);
    monthUsd += cost;
    if (row.day === today) dayUsd += cost;
  }

  const exceeded = monthUsd >= monthlyBudgetUsd ? "monthly" : dayUsd >= dailyBudgetUsd ? "daily" : false;

  return {
    dayUsd: Math.round(dayUsd * 1_000_000) / 1_000_000,
    monthUsd: Math.round(monthUsd * 1_000_000) / 1_000_000,
    dailyLimitUsd: dailyBudgetUsd,
    monthlyLimitUsd: monthlyBudgetUsd,
    exceeded,
  };
}

export type SpendSummary = BudgetStatus & {
  callsThisMonth: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheHitRate: number;
};

/** Everything the admin system page needs about spend, in one read. */
export async function spendSummary(): Promise<SpendSummary> {
  const status = await budgetStatus();

  const rows = await db
    .select({
      calls: sql<number>`coalesce(sum(${aiSpendDaily.calls}), 0)::int`,
      inputTokens: sql<number>`coalesce(sum(${aiSpendDaily.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${aiSpendDaily.outputTokens}), 0)::int`,
      cacheCreationInputTokens: sql<number>`coalesce(sum(${aiSpendDaily.cacheCreationInputTokens}), 0)::int`,
      cacheReadInputTokens: sql<number>`coalesce(sum(${aiSpendDaily.cacheReadInputTokens}), 0)::int`,
    })
    .from(aiSpendDaily)
    .where(gte(aiSpendDaily.day, utcMonthStart()));

  const totals = rows[0] ?? {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  };

  const promptTokens = totals.inputTokens + totals.cacheCreationInputTokens + totals.cacheReadInputTokens;

  return {
    ...status,
    callsThisMonth: totals.calls,
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    cacheCreationInputTokens: totals.cacheCreationInputTokens,
    cacheReadInputTokens: totals.cacheReadInputTokens,
    cacheHitRate: promptTokens === 0 ? 0 : totals.cacheReadInputTokens / promptTokens,
  };
}
