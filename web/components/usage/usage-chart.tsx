import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatTokens, formatCost, formatDate, type DailyUsage } from "./types";

interface UsageChartProps {
  data: DailyUsage[];
  loading: boolean;
}

interface ChartDataPoint {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  cost: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
    payload: ChartDataPoint;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  // Get the full data point from the first payload item
  const dataPoint = payload[0]?.payload;
  if (!dataPoint) return null;

  const inputTokens = dataPoint.inputTokens || 0;
  const outputTokens = dataPoint.outputTokens || 0;
  const cacheTokens = dataPoint.cacheTokens || 0;
  const totalTokens = inputTokens + outputTokens + cacheTokens;
  const cost = dataPoint.cost || 0;

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-lg">
      <div className="text-sm font-medium text-zinc-300 mb-2">{label}</div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Input:</span>
          <span className="text-blue-400">{formatTokens(inputTokens)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Output:</span>
          <span className="text-emerald-400">{formatTokens(outputTokens)}</span>
        </div>
        {cacheTokens > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Cache:</span>
            <span className="text-violet-400">{formatTokens(cacheTokens)}</span>
          </div>
        )}
        <div className="flex justify-between gap-4 border-t border-zinc-700 pt-1 mt-1">
          <span className="text-zinc-500">Total:</span>
          <span className="text-zinc-300">{formatTokens(totalTokens)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Cost:</span>
          <span className="text-amber-400">{formatCost(cost)}</span>
        </div>
      </div>
    </div>
  );
}

export default function UsageChart({ data, loading }: UsageChartProps) {
  if (loading) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-lg p-4">
        <div className="h-4 w-48 bg-zinc-800 rounded animate-pulse mb-4" />
        <div className="h-64 bg-zinc-800/50 rounded animate-pulse" />
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    date: formatDate(d.date),
    cacheTokens: d.cacheCreationTokens + d.cacheReadTokens,
  }));

  const hasData = data.some((d) => d.inputTokens > 0 || d.outputTokens > 0 || d.cacheCreationTokens > 0 || d.cacheReadTokens > 0);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-lg p-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-4">
        Token Usage Over Time
      </h3>
      {!hasData ? (
        <div className="h-64 flex items-center justify-center text-zinc-500 text-sm">
          No usage data for this period
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="inputGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="outputGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cacheGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="date"
                stroke="#52525b"
                tick={{ fill: "#71717a", fontSize: 11 }}
                tickLine={{ stroke: "#3f3f46" }}
              />
              <YAxis
                stroke="#52525b"
                tick={{ fill: "#71717a", fontSize: 11 }}
                tickLine={{ stroke: "#3f3f46" }}
                tickFormatter={(value) => formatTokens(value)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: 12 }}
                formatter={(value) => (
                  <span className="text-xs text-zinc-400">
                    {value === "inputTokens" ? "Input" : value === "outputTokens" ? "Output" : "Cache"}
                  </span>
                )}
              />
              <Area
                type="monotone"
                dataKey="cacheTokens"
                stackId="1"
                stroke="#8b5cf6"
                fill="url(#cacheGradient)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="inputTokens"
                stackId="1"
                stroke="#3b82f6"
                fill="url(#inputGradient)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="outputTokens"
                stackId="1"
                stroke="#10b981"
                fill="url(#outputGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
