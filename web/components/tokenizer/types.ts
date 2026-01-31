export interface TokenizerResult {
  tokens: string[];
  tokenCount: number;
  wordCount: number;
  charCount: number;
}

export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  model: string;
  modelDisplayName: string;
}

export interface ModelOption {
  id: string;
  displayName: string;
  inputPerMillion: number;
  outputPerMillion: number;
}

export function formatTokens(tokens: number): string {
  if (tokens === 0) return "0";
  if (tokens < 1000) return tokens.toString();
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1_000_000).toFixed(2)}M`;
}

export function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.01) return "<$0.01";
  if (cost < 1) return `$${cost.toFixed(2)}`;
  if (cost < 10) return `$${cost.toFixed(2)}`;
  if (cost < 100) return `$${cost.toFixed(1)}`;
  return `$${Math.round(cost)}`;
}
