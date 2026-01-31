import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatTokens, formatCost, type UsageSummary } from "./types";

interface UsageByProjectProps {
  summary: UsageSummary | null;
  loading: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: {
      name: string;
      fullName: string;
      inputTokens: number;
      outputTokens: number;
      cost: number;
      sessionCount: number;
    };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-lg">
      <div className="text-sm font-medium text-zinc-300 mb-2">{data.fullName}</div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Total:</span>
          <span className="text-zinc-300">
            {formatTokens(data.inputTokens + data.outputTokens)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Cost:</span>
          <span className="text-amber-400">{formatCost(data.cost)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Sessions:</span>
          <span className="text-zinc-300">{data.sessionCount}</span>
        </div>
      </div>
    </div>
  );
}

export default function UsageByProject({
  summary,
  loading,
}: UsageByProjectProps) {
  if (loading) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-lg p-4">
        <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse mb-4" />
        <div className="h-48 bg-zinc-800/50 rounded animate-pulse" />
      </div>
    );
  }

  const data = summary
    ? Object.entries(summary.byProject)
        .map(([key, stats]) => ({
          name: stats.projectName.length > 15
            ? stats.projectName.slice(0, 15) + "..."
            : stats.projectName,
          fullName: stats.projectName,
          value: stats.inputTokens + stats.outputTokens,
          ...stats,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)
    : [];

  const hasData = data.length > 0;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-lg p-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-4">
        Usage by Project
      </h3>
      {!hasData ? (
        <div className="h-48 flex items-center justify-center text-zinc-500 text-sm">
          No project data available
        </div>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                type="number"
                stroke="#52525b"
                tick={{ fill: "#71717a", fontSize: 10 }}
                tickLine={{ stroke: "#3f3f46" }}
                tickFormatter={(value) => formatTokens(value)}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#52525b"
                tick={{ fill: "#71717a", fontSize: 10 }}
                tickLine={{ stroke: "#3f3f46" }}
                width={100}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="value"
                fill="#3b82f6"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
