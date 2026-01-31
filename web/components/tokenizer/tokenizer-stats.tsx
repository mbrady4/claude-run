import { Hash, Type, Coins, FileText } from "lucide-react";
import { formatTokens, formatCost } from "./types";
import type { TokenizerResult, CostEstimate } from "./types";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
}

function StatCard({ title, value, subtitle, icon }: StatCardProps) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-lg p-4">
      <div className="flex items-center gap-2 text-zinc-500 mb-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">
          {title}
        </span>
      </div>
      <div className="text-2xl font-semibold text-zinc-100">{value}</div>
      {subtitle && <div className="text-xs text-zinc-500 mt-1">{subtitle}</div>}
    </div>
  );
}

interface TokenizerStatsProps {
  result: TokenizerResult | null;
  costEstimate: CostEstimate | null;
}

export default function TokenizerStats({
  result,
  costEstimate,
}: TokenizerStatsProps) {
  const tokensPerWord =
    result && result.wordCount > 0
      ? (result.tokenCount / result.wordCount).toFixed(1)
      : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Tokens"
        value={result ? formatTokens(result.tokenCount) : "0"}
        subtitle={tokensPerWord ? `~${tokensPerWord} tokens/word` : undefined}
        icon={<Hash className="w-4 h-4" />}
      />
      <StatCard
        title="Words"
        value={result?.wordCount.toLocaleString() || "0"}
        icon={<Type className="w-4 h-4" />}
      />
      <StatCard
        title="Characters"
        value={result?.charCount.toLocaleString() || "0"}
        icon={<FileText className="w-4 h-4" />}
      />
      <StatCard
        title="Est. Cost (Input)"
        value={costEstimate ? formatCost(costEstimate.inputCost) : "$0.00"}
        subtitle={
          costEstimate
            ? `Output: ${formatCost(costEstimate.outputCost)}`
            : undefined
        }
        icon={<Coins className="w-4 h-4" />}
      />
    </div>
  );
}
