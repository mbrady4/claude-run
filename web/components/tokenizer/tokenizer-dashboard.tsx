import { useState, useMemo } from "react";
import TokenizerInput from "./tokenizer-input";
import TokenizerStats from "./tokenizer-stats";
import TokenVisualization from "./token-visualization";
import ModelSelector, { DEFAULT_MODEL } from "./model-selector";
import type { ModelOption } from "./types";
import { tokenizeText, calculateCostEstimate } from "./tokenizer-utils";

export default function TokenizerDashboard() {
  const [text, setText] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelOption>(DEFAULT_MODEL);

  const result = useMemo(() => {
    if (!text.trim()) return null;
    return tokenizeText(text);
  }, [text]);

  const costEstimate = useMemo(() => {
    if (!result) return null;
    return calculateCostEstimate(result.tokenCount, selectedModel);
  }, [result, selectedModel]);

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Token Counter</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Analyze text tokenization and estimate API costs
          </p>
        </div>
        <ModelSelector selected={selectedModel} onChange={setSelectedModel} />
      </div>

      {/* Stats Cards */}
      <TokenizerStats result={result} costEstimate={costEstimate} />

      {/* Input and Visualization Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TokenizerInput value={text} onChange={setText} />
        <TokenVisualization tokens={result?.tokens || []} />
      </div>

      {/* Disclaimer */}
      <div className="text-xs text-zinc-600 text-center">
        Token counts are approximate. Claude 3+ models use a proprietary
        tokenizer that may produce different results.
      </div>
    </div>
  );
}
