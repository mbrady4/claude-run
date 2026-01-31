import { Clipboard, X } from "lucide-react";

interface TokenizerInputProps {
  value: string;
  onChange: (value: string) => void;
}

export default function TokenizerInput({
  value,
  onChange,
}: TokenizerInputProps) {
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onChange(text);
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }
  };

  const handleClear = () => onChange("");

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-lg p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-zinc-300">Input Text</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePaste}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors cursor-pointer"
          >
            <Clipboard className="w-3.5 h-3.5" />
            Paste
          </button>
          {value && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste or type text here to analyze tokens..."
        className="flex-1 min-h-[300px] bg-zinc-800/50 border border-zinc-700/50 rounded-md p-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 resize-none font-mono"
      />
    </div>
  );
}
