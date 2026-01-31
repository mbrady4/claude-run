import { ChevronUp, ChevronDown } from "lucide-react";
import {
  formatTokens,
  formatCost,
  formatDateTime,
  type SessionUsage,
} from "./types";

interface SessionUsageTableProps {
  sessions: SessionUsage[];
  loading: boolean;
  sortBy: "cost" | "tokens" | "date";
  onSortChange: (sort: "cost" | "tokens" | "date") => void;
  onSelectSession?: (sessionId: string) => void;
}

interface SortHeaderProps {
  label: string;
  field: "cost" | "tokens" | "date";
  currentSort: "cost" | "tokens" | "date";
  onSort: (field: "cost" | "tokens" | "date") => void;
}

function SortHeader({ label, field, currentSort, onSort }: SortHeaderProps) {
  const isActive = currentSort === field;

  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-1 text-xs font-medium uppercase tracking-wide cursor-pointer hover:text-zinc-300 transition-colors ${
        isActive ? "text-zinc-300" : "text-zinc-500"
      }`}
    >
      {label}
      {isActive ? (
        <ChevronDown className="w-3 h-3" />
      ) : (
        <ChevronUp className="w-3 h-3 opacity-0 group-hover:opacity-50" />
      )}
    </button>
  );
}

export default function SessionUsageTable({
  sessions,
  loading,
  sortBy,
  onSortChange,
  onSelectSession,
}: SessionUsageTableProps) {
  if (loading) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-lg p-4">
        <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse mb-4" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-zinc-800/50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const hasData = sessions.length > 0;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-zinc-800/60">
        <h3 className="text-sm font-medium text-zinc-300">Session Details</h3>
      </div>
      {!hasData ? (
        <div className="h-48 flex items-center justify-center text-zinc-500 text-sm">
          No session data available
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800/60">
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">
                  Session
                </th>
                <th className="text-left px-4 py-3">
                  <SortHeader
                    label="Tokens"
                    field="tokens"
                    currentSort={sortBy}
                    onSort={onSortChange}
                  />
                </th>
                <th className="text-left px-4 py-3">
                  <SortHeader
                    label="Cost"
                    field="cost"
                    currentSort={sortBy}
                    onSort={onSortChange}
                  />
                </th>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium text-xs uppercase tracking-wide">
                  Model
                </th>
                <th className="text-left px-4 py-3">
                  <SortHeader
                    label="Date"
                    field="date"
                    currentSort={sortBy}
                    onSort={onSortChange}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr
                  key={session.sessionId}
                  onClick={() => onSelectSession?.(session.sessionId)}
                  className="border-b border-zinc-800/40 hover:bg-zinc-800/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="max-w-xs">
                      <div className="text-zinc-300 truncate">
                        {session.display}
                      </div>
                      <div className="text-xs text-zinc-600 truncate">
                        {session.projectName}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-zinc-300">
                      {formatTokens(
                        session.totalInputTokens + session.totalOutputTokens + session.cacheReadTokens + session.cacheCreationTokens
                      )}
                    </div>
                    <div className="text-xs text-zinc-600">
                      {formatTokens(session.totalInputTokens)} in / {formatTokens(session.totalOutputTokens)} out
                      {(session.cacheReadTokens > 0 || session.cacheCreationTokens > 0) && (
                        <span className="text-zinc-700"> + {formatTokens(session.cacheReadTokens + session.cacheCreationTokens)} cache</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-amber-400">
                      {formatCost(session.estimatedCost)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{session.model}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">
                    {formatDateTime(session.lastMessageAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
