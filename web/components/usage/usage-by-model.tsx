import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { formatTokens, formatCost, type UsageSummary } from "./types";

interface UsageByModelProps {
  summary: UsageSummary | null;
  loading: boolean;
}

const COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: {
      name: string;
      inputTokens: number;
      outputTokens: number;
      cost: number;
      count: number;
    };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-lg">
      <div className="text-sm font-medium text-zinc-300 mb-2">{data.name}</div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Input:</span>
          <span className="text-zinc-300">{formatTokens(data.inputTokens)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Output:</span>
          <span className="text-zinc-300">{formatTokens(data.outputTokens)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Cost:</span>
          <span className="text-amber-400">{formatCost(data.cost)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Requests:</span>
          <span className="text-zinc-300">{data.count}</span>
        </div>
      </div>
    </div>
  );
}

export default function UsageByModel({ summary, loading }: UsageByModelProps) {
  if (loading) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-lg p-4">
        <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse mb-4" />
        <div className="h-48 bg-zinc-800/50 rounded animate-pulse" />
      </div>
    );
  }

  const data = summary
    ? Object.entries(summary.byModel).map(([name, stats]) => ({
        name,
        value: stats.inputTokens + stats.outputTokens,
        ...stats,
      }))
    : [];

  const hasData = data.length > 0;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-lg p-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-4">Usage by Model</h3>
      {!hasData ? (
        <div className="h-48 flex items-center justify-center text-zinc-500 text-sm">
          No model data available
        </div>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                formatter={(value) => (
                  <span className="text-xs text-zinc-400">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
