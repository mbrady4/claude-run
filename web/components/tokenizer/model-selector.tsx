import type { ModelOption } from "./types";

// Model options with pricing from api/pricing.ts
export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "claude-opus-4-5-20251101",
    displayName: "Opus 4.5",
    inputPerMillion: 5,
    outputPerMillion: 25,
  },
  {
    id: "claude-opus-4-20250514",
    displayName: "Opus 4",
    inputPerMillion: 15,
    outputPerMillion: 75,
  },
  {
    id: "claude-sonnet-4-5-20241022",
    displayName: "Sonnet 4.5",
    inputPerMillion: 3,
    outputPerMillion: 15,
  },
  {
    id: "claude-sonnet-4-20250514",
    displayName: "Sonnet 4",
    inputPerMillion: 3,
    outputPerMillion: 15,
  },
  {
    id: "claude-haiku-4-5-20251101",
    displayName: "Haiku 4.5",
    inputPerMillion: 1,
    outputPerMillion: 5,
  },
  {
    id: "claude-3-5-haiku-20241022",
    displayName: "Haiku 3.5",
    inputPerMillion: 0.8,
    outputPerMillion: 4,
  },
  {
    id: "claude-3-5-sonnet-20241022",
    displayName: "Sonnet 3.5",
    inputPerMillion: 3,
    outputPerMillion: 15,
  },
];

export const DEFAULT_MODEL = MODEL_OPTIONS[2]; // Sonnet 4.5

interface ModelSelectorProps {
  selected: ModelOption;
  onChange: (model: ModelOption) => void;
}

export default function ModelSelector({
  selected,
  onChange,
}: ModelSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-500">Model:</span>
      <select
        value={selected.id}
        onChange={(e) => {
          const model = MODEL_OPTIONS.find((m) => m.id === e.target.value);
          if (model) onChange(model);
        }}
        className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-700 cursor-pointer"
      >
        {MODEL_OPTIONS.map((model) => (
          <option key={model.id} value={model.id}>
            {model.displayName} (${model.inputPerMillion}/M in, $
            {model.outputPerMillion}/M out)
          </option>
        ))}
      </select>
    </div>
  );
}
