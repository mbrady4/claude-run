import { encode, decode } from "gpt-tokenizer";
import type { TokenizerResult, CostEstimate, ModelOption } from "./types";

/**
 * Tokenize text and return both the token strings and statistics.
 * Uses gpt-tokenizer (o200k_base encoding) as an approximation.
 * Note: Claude uses a different tokenizer, so counts are approximate.
 */
export function tokenizeText(text: string): TokenizerResult {
  if (!text) {
    return {
      tokens: [],
      tokenCount: 0,
      wordCount: 0,
      charCount: 0,
    };
  }

  const tokenIds = encode(text);
  const tokens = tokenIds.map((id) => decode([id]));
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  return {
    tokens,
    tokenCount: tokenIds.length,
    wordCount,
    charCount: text.length,
  };
}

/**
 * Calculate estimated API cost based on token count and model pricing.
 */
export function calculateCostEstimate(
  tokenCount: number,
  model: ModelOption
): CostEstimate {
  const inputCost = (tokenCount / 1_000_000) * model.inputPerMillion;
  const outputCost = (tokenCount / 1_000_000) * model.outputPerMillion;

  return {
    inputCost,
    outputCost,
    model: model.id,
    modelDisplayName: model.displayName,
  };
}
