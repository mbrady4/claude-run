import { useState, useEffect, useCallback } from "react";
import UsageSummaryCards from "./usage-summary-cards";
import UsageChart from "./usage-chart";
import UsageByModel from "./usage-by-model";
import UsageByProject from "./usage-by-project";
import SessionUsageTable from "./session-usage-table";
import UsageFilters from "./usage-filters";
import type { UsageSummary, DailyUsage, SessionUsage } from "./types";

interface UsageDashboardProps {
  projects: string[];
  onSelectSession?: (sessionId: string) => void;
}

export default function UsageDashboard({
  projects,
  onSelectSession,
}: UsageDashboardProps) {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [sessions, setSessions] = useState<SessionUsage[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<"7" | "30" | "90" | "all">("30");
  const [sortBy, setSortBy] = useState<"cost" | "tokens" | "date">("date");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedProject) {
        params.set("project", selectedProject);
      }
      if (timeRange !== "all") {
        const days = parseInt(timeRange);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        params.set("start", startDate.toISOString());
      }

      const [summaryRes, dailyRes, sessionsRes] = await Promise.all([
        fetch(`/api/usage/summary?${params}`),
        fetch(`/api/usage/daily?days=${timeRange === "all" ? 365 : timeRange}`),
        fetch(`/api/usage/sessions?sortBy=${sortBy}&limit=20&${params}`),
      ]);

      const [summaryData, dailyData, sessionsData] = await Promise.all([
        summaryRes.json(),
        dailyRes.json(),
        sessionsRes.json(),
      ]);

      setSummary(summaryData);
      setDailyUsage(dailyData);
      setSessions(sessionsData.sessions || []);
    } catch (error) {
      console.error("Failed to fetch usage data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedProject, timeRange, sortBy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      onSelectSession?.(sessionId);
    },
    [onSelectSession]
  );

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Usage Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Token usage and cost insights across your Claude sessions
          </p>
        </div>
        <UsageFilters
          projects={projects}
          selectedProject={selectedProject}
          onProjectChange={setSelectedProject}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
        />
      </div>

      <UsageSummaryCards summary={summary} loading={loading} />

      <UsageChart data={dailyUsage} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UsageByModel summary={summary} loading={loading} />
        <UsageByProject summary={summary} loading={loading} />
      </div>

      <SessionUsageTable
        sessions={sessions}
        loading={loading}
        sortBy={sortBy}
        onSortChange={setSortBy}
        onSelectSession={handleSelectSession}
      />
    </div>
  );
}
