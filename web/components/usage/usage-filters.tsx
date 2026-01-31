import { Calendar, Filter } from "lucide-react";

interface UsageFiltersProps {
  projects: string[];
  selectedProject: string | null;
  onProjectChange: (project: string | null) => void;
  timeRange: "7" | "30" | "90" | "all";
  onTimeRangeChange: (range: "7" | "30" | "90" | "all") => void;
}

export default function UsageFilters({
  projects,
  selectedProject,
  onProjectChange,
  timeRange,
  onTimeRangeChange,
}: UsageFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-zinc-500" />
        <select
          value={timeRange}
          onChange={(e) =>
            onTimeRangeChange(e.target.value as "7" | "30" | "90" | "all")
          }
          className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-700 cursor-pointer"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-zinc-500" />
        <select
          value={selectedProject || ""}
          onChange={(e) => onProjectChange(e.target.value || null)}
          className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-700 cursor-pointer max-w-[200px]"
        >
          <option value="">All Projects</option>
          {projects.map((project) => {
            const name = project.split("/").pop() || project;
            return (
              <option key={project} value={project}>
                {name}
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
}
