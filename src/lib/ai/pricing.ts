/**
 * Published Anthropic list prices in US dollars per million tokens.
 *
 * Prompt caching is billed off the same base input rate: writing a cache entry
 * costs a premium, reading one is close to free. Those multipliers are what make
 * a cached prefix worth designing around.
 */
export type ModelPricing = {
  inputPerMTok: number;
  outputPerMTok: number;
};

export const CACHE_WRITE_MULTIPLIER = 1.25;
export const CACHE_READ_MULTIPLIER = 0.1;

const PRICING: Record<string, ModelPricing> = {
  "claude-fable-5": { inputPerMTok: 10, outputPerMTok: 50 },
  "claude-opus-5": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-opus-4-8": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-opus-4-7": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-opus-4-6": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-sonnet-5": { inputPerMTok: 3, outputPerMTok: 15 },
  "claude-sonnet-4-6": { inputPerMTok: 3, outputPerMTok: 15 },
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5 },
};

/** Used when the configured model is not in the table, so a budget still binds. */
const UNKNOWN_MODEL_PRICING: ModelPricing = { inputPerMTok: 5, outputPerMTok: 25 };

export function pricingFor(model: string | null | undefined): ModelPricing {
  if (!model) return UNKNOWN_MODEL_PRICING;
  const exact = PRICING[model];
  if (exact) return exact;
  // Dated snapshots such as claude-sonnet-5-20260101 price like their base model.
  const base = Object.keys(PRICING).find((key) => model.startsWith(key));
  return base ? PRICING[base] : UNKNOWN_MODEL_PRICING;
}

export function isPricedModel(model: string | null | undefined): boolean {
  if (!model) return false;
  return Boolean(PRICING[model] ?? Object.keys(PRICING).find((key) => model.startsWith(key)));
}

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
};

export function estimateCostUsd(model: string | null | undefined, usage: TokenUsage): number {
  const price = pricingFor(model);
  const perInputToken = price.inputPerMTok / 1_000_000;
  const perOutputToken = price.outputPerMTok / 1_000_000;

  const cost =
    usage.inputTokens * perInputToken +
    usage.outputTokens * perOutputToken +
    (usage.cacheCreationInputTokens ?? 0) * perInputToken * CACHE_WRITE_MULTIPLIER +
    (usage.cacheReadInputTokens ?? 0) * perInputToken * CACHE_READ_MULTIPLIER;

  return Math.round(cost * 1_000_000) / 1_000_000;
}

/**
 * Rough local estimate used to size a request before it is sent. English prose
 * runs near four characters per token; this deliberately reads a little high so
 * the guard trips before the provider bills for the oversized request.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.6);
}

export function formatUsd(value: number): string {
  if (value === 0) return "$0.00";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}
