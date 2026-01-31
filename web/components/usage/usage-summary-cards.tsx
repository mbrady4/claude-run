import { Coins, MessageSquare, Hash, Layers } from "lucide-react";
import { formatTokens, formatCost, type UsageSummary } from "./types";

interface UsageSummaryCardsProps {
  summary: UsageSummary | null;
  loading: boolean;
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  loading: boolean;
}

function StatCard({ title, value, subtitle, icon, loading }: StatCardProps) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-lg p-4">
      <div className="flex items-center gap-2 text-zinc-500 mb-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">
          {title}
        </span>
      </div>
      {loading ? (
        <div className="h-8 bg-zinc-800 rounded animate-pulse" />
      ) : (
        <>
          <div className="text-2xl font-semibold text-zinc-100">{value}</div>
          {subtitle && (
            <div className="text-xs text-zinc-500 mt-1">{subtitle}</div>
          )}
        </>
      )}
    </div>
  );
}

export default function UsageSummaryCards({
  summary,
  loading,
}: UsageSummaryCardsProps) {
  const totalTokens = summary
    ? summary.totalInputTokens + summary.totalOutputTokens + summary.totalCacheCreationTokens + summary.totalCacheReadTokens
    : 0;

  const avgCostPerSession =
    summary && summary.sessionCount > 0
      ? summary.totalEstimatedCost / summary.sessionCount
      : 0;

  const hasCacheTokens = summary && (summary.totalCacheCreationTokens > 0 || summary.totalCacheReadTokens > 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total Tokens"
        value={formatTokens(totalTokens)}
        subtitle={
          summary
            ? `${formatTokens(summary.totalInputTokens)} in / ${formatTokens(summary.totalOutputTokens)} out${hasCacheTokens ? ` + ${formatTokens(summary.totalCacheCreationTokens + summary.totalCacheReadTokens)} cache` : ''}`
            : undefined
        }
        icon={<Hash className="w-4 h-4" />}
        loading={loading}
      />
      <StatCard
        title="Estimated Cost"
        value={summary ? formatCost(summary.totalEstimatedCost) : "$0.00"}
        subtitle={
          summary
            ? `Avg ${formatCost(avgCostPerSession)} per session`
            : undefined
        }
        icon={<Coins className="w-4 h-4" />}
        loading={loading}
      />
      <StatCard
        title="Sessions"
        value={summary?.sessionCount.toString() || "0"}
        subtitle={summary ? `${summary.messageCount} total messages` : undefined}
        icon={<Layers className="w-4 h-4" />}
        loading={loading}
      />
      <StatCard
        title="Messages"
        value={summary?.messageCount.toString() || "0"}
        subtitle={
          summary && summary.sessionCount > 0
            ? `Avg ${Math.round(summary.messageCount / summary.sessionCount)} per session`
            : undefined
        }
        icon={<MessageSquare className="w-4 h-4" />}
        loading={loading}
      />
    </div>
  );
}
