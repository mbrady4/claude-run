import { useMemo } from "react";

interface TokenVisualizationProps {
  tokens: string[];
}

// Color palette for token boundaries (cycling through)
const TOKEN_COLORS = [
  "bg-blue-500/20 border-blue-500/40",
  "bg-emerald-500/20 border-emerald-500/40",
  "bg-amber-500/20 border-amber-500/40",
  "bg-violet-500/20 border-violet-500/40",
  "bg-pink-500/20 border-pink-500/40",
  "bg-cyan-500/20 border-cyan-500/40",
  "bg-rose-500/20 border-rose-500/40",
  "bg-lime-500/20 border-lime-500/40",
];

export default function TokenVisualization({
  tokens,
}: TokenVisualizationProps) {
  const tokenElements = useMemo(() => {
    return tokens.map((token, index) => {
      const colorClass = TOKEN_COLORS[index % TOKEN_COLORS.length];

      // Transform whitespace characters for visibility
      let displayToken = token;
      let isWhitespaceOnly = false;

      if (/^[\s\n\t]+$/.test(token)) {
        isWhitespaceOnly = true;
        displayToken = token
          .replace(/\n/g, "↵\n")
          .replace(/\t/g, "→")
          .replace(/ /g, "·");
      }

      return (
        <span
          key={index}
          className={`inline border rounded px-0.5 ${colorClass} ${
            isWhitespaceOnly ? "text-zinc-500" : "text-zinc-200"
          } hover:ring-1 hover:ring-zinc-400 transition-all cursor-default`}
          title={`Token ${index + 1}: "${token.replace(/\n/g, "\\n").replace(/\t/g, "\\t")}" (${token.length} char${token.length !== 1 ? "s" : ""})`}
        >
          <span className="whitespace-pre-wrap font-mono text-sm">
            {displayToken}
          </span>
        </span>
      );
    });
  }, [tokens]);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-lg p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-zinc-300">
          Token Visualization
        </h3>
        <span className="text-xs text-zinc-500">
          {tokens.length} token{tokens.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex-1 min-h-[300px] bg-zinc-800/50 border border-zinc-700/50 rounded-md p-3 overflow-auto">
        {tokens.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
            Enter text to see token boundaries
          </div>
        ) : (
          <div className="leading-relaxed">{tokenElements}</div>
        )}
      </div>
      {tokens.length > 0 && (
        <div className="mt-3 text-xs text-zinc-600">
          Hover over tokens to see details. · = space, ↵ = newline, → = tab
        </div>
      )}
    </div>
  );
}
