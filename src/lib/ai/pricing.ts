/**
 * Published Anthropic list prices in US dollars per million tokens.
 *
 * Prompt caching is billed off the same base input rate: writing a cache entry
 * costs a premium, reading one is close to free. Those multipliers are what make
 * a cached prefix worth designing around.
 */
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-fable-5": { input: 10, output: 50 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

/** Used when the configured model is not in the table, so a budget still binds. */
const UNKNOWN_MODEL = { input: 5, output: 25 };

function pricingFor(model: string | null | undefined) {
  if (!model) return UNKNOWN_MODEL;
  // Dated snapshots such as claude-sonnet-5-20260101 price like their base model.
  const key = PRICING[model] ? model : Object.keys(PRICING).find((name) => model.startsWith(name));
  return key ? PRICING[key] : UNKNOWN_MODEL;
}

export function isPricedModel(model: string | null | undefined): boolean {
  return Boolean(model) && pricingFor(model) !== UNKNOWN_MODEL;
}

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
};

export function estimateCostUsd(model: string | null | undefined, usage: TokenUsage): number {
  const price = pricingFor(model);
  const perInput = price.input / 1_000_000;

  const cost =
    usage.inputTokens * perInput +
    usage.outputTokens * (price.output / 1_000_000) +
    (usage.cacheCreationInputTokens ?? 0) * perInput * CACHE_WRITE_MULTIPLIER +
    (usage.cacheReadInputTokens ?? 0) * perInput * CACHE_READ_MULTIPLIER;

  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function formatUsd(value: number): string {
  if (value === 0) return "$0.00";
  return value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}
