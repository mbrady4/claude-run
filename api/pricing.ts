import type { TokenUsage } from "./storage.js";

export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  cacheWriteMultiplier: number;
  cacheReadMultiplier: number;
}

// Claude API pricing as of January 2026 (USD per million tokens)
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Opus 4.5 (latest)
  "claude-opus-4-5-20251101": {
    inputPerMillion: 5,
    outputPerMillion: 25,
    cacheWriteMultiplier: 1.25,
    cacheReadMultiplier: 0.1,
  },
  // Opus 4
  "claude-opus-4-20250514": {
    inputPerMillion: 15,
    outputPerMillion: 75,
    cacheWriteMultiplier: 1.25,
    cacheReadMultiplier: 0.1,
  },
  // Sonnet 4.5
  "claude-sonnet-4-5-20241022": {
    inputPerMillion: 3,
    outputPerMillion: 15,
    cacheWriteMultiplier: 1.25,
    cacheReadMultiplier: 0.1,
  },
  // Sonnet 4
  "claude-sonnet-4-20250514": {
    inputPerMillion: 3,
    outputPerMillion: 15,
    cacheWriteMultiplier: 1.25,
    cacheReadMultiplier: 0.1,
  },
  // Haiku 4.5
  "claude-haiku-4-5-20251101": {
    inputPerMillion: 1,
    outputPerMillion: 5,
    cacheWriteMultiplier: 1.25,
    cacheReadMultiplier: 0.1,
  },
  // Haiku 3.5
  "claude-3-5-haiku-20241022": {
    inputPerMillion: 0.8,
    outputPerMillion: 4,
    cacheWriteMultiplier: 1.25,
    cacheReadMultiplier: 0.1,
  },
  // Haiku 3
  "claude-3-haiku-20240307": {
    inputPerMillion: 0.25,
    outputPerMillion: 1.25,
    cacheWriteMultiplier: 1.25,
    cacheReadMultiplier: 0.1,
  },
  // Sonnet 3.5 v2
  "claude-3-5-sonnet-20241022": {
    inputPerMillion: 3,
    outputPerMillion: 15,
    cacheWriteMultiplier: 1.25,
    cacheReadMultiplier: 0.1,
  },
  // Sonnet 3.5 v1
  "claude-3-5-sonnet-20240620": {
    inputPerMillion: 3,
    outputPerMillion: 15,
    cacheWriteMultiplier: 1.25,
    cacheReadMultiplier: 0.1,
  },
};

// Default pricing for unknown models (use Sonnet 4.5 as baseline)
const DEFAULT_PRICING: ModelPricing = {
  inputPerMillion: 3,
  outputPerMillion: 15,
  cacheWriteMultiplier: 1.25,
  cacheReadMultiplier: 0.1,
};

/**
 * Get pricing for a model, with fallback to default
 */
export function getModelPricing(model?: string): ModelPricing {
  if (!model) return DEFAULT_PRICING;

  // Direct match
  if (MODEL_PRICING[model]) {
    return MODEL_PRICING[model];
  }

  // Try to match by model family
  const modelLower = model.toLowerCase();
  if (modelLower.includes("opus-4-5") || modelLower.includes("opus-4.5")) {
    return MODEL_PRICING["claude-opus-4-5-20251101"];
  }
  if (modelLower.includes("opus-4") || modelLower.includes("opus4")) {
    return MODEL_PRICING["claude-opus-4-20250514"];
  }
  if (modelLower.includes("sonnet-4-5") || modelLower.includes("sonnet-4.5")) {
    return MODEL_PRICING["claude-sonnet-4-5-20241022"];
  }
  if (modelLower.includes("sonnet-4") || modelLower.includes("sonnet4")) {
    return MODEL_PRICING["claude-sonnet-4-20250514"];
  }
  if (modelLower.includes("haiku-4-5") || modelLower.includes("haiku-4.5")) {
    return MODEL_PRICING["claude-haiku-4-5-20251101"];
  }
  if (modelLower.includes("haiku-3-5") || modelLower.includes("haiku-3.5")) {
    return MODEL_PRICING["claude-3-5-haiku-20241022"];
  }
  if (modelLower.includes("haiku")) {
    return MODEL_PRICING["claude-3-haiku-20240307"];
  }
  if (modelLower.includes("sonnet-3-5") || modelLower.includes("sonnet-3.5")) {
    return MODEL_PRICING["claude-3-5-sonnet-20241022"];
  }
  if (modelLower.includes("sonnet")) {
    return MODEL_PRICING["claude-sonnet-4-20250514"];
  }

  return DEFAULT_PRICING;
}

/**
 * Calculate the cost for a given token usage
 * @returns Cost in USD
 */
export function calculateCost(usage: TokenUsage, model?: string): number {
  const pricing = getModelPricing(model);

  const inputCost = (usage.input_tokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost =
    (usage.output_tokens / 1_000_000) * pricing.outputPerMillion;

  // Cache costs
  const cacheWriteCost = usage.cache_creation_input_tokens
    ? (usage.cache_creation_input_tokens / 1_000_000) *
      pricing.inputPerMillion *
      pricing.cacheWriteMultiplier
    : 0;

  const cacheReadCost = usage.cache_read_input_tokens
    ? (usage.cache_read_input_tokens / 1_000_000) *
      pricing.inputPerMillion *
      pricing.cacheReadMultiplier
    : 0;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

/**
 * Format a cost value for display
 * @param cost Cost in USD
 * @returns Formatted string like "$1.23" or "<$0.01"
 */
export function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.01) return "<$0.01";
  if (cost < 1) return `$${cost.toFixed(2)}`;
  if (cost < 10) return `$${cost.toFixed(2)}`;
  if (cost < 100) return `$${cost.toFixed(1)}`;
  return `$${Math.round(cost)}`;
}

/**
 * Format token count for display
 * @param tokens Number of tokens
 * @returns Formatted string like "1.2K" or "1.5M"
 */
export function formatTokens(tokens: number): string {
  if (tokens === 0) return "0";
  if (tokens < 1000) return tokens.toString();
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1_000_000).toFixed(2)}M`;
}

/**
 * Get a display name for a model
 */
export function getModelDisplayName(model?: string): string {
  if (!model) return "Unknown";

  const modelLower = model.toLowerCase();
  if (modelLower.includes("opus-4-5") || modelLower.includes("opus-4.5"))
    return "Opus 4.5";
  if (modelLower.includes("opus-4") || modelLower.includes("opus4"))
    return "Opus 4";
  if (modelLower.includes("sonnet-4-5") || modelLower.includes("sonnet-4.5"))
    return "Sonnet 4.5";
  if (modelLower.includes("sonnet-4") || modelLower.includes("sonnet4"))
    return "Sonnet 4";
  if (modelLower.includes("haiku-4-5") || modelLower.includes("haiku-4.5"))
    return "Haiku 4.5";
  if (modelLower.includes("haiku-3-5") || modelLower.includes("haiku-3.5"))
    return "Haiku 3.5";
  if (modelLower.includes("haiku")) return "Haiku 3";
  if (modelLower.includes("sonnet-3-5") || modelLower.includes("sonnet-3.5"))
    return "Sonnet 3.5";
  if (modelLower.includes("sonnet")) return "Sonnet";
  if (modelLower.includes("opus")) return "Opus";

  // Return the model name cleaned up
  return model.replace(/^claude-/, "").replace(/-\d{8}$/, "");
}
