"use client";

import type { Mode } from "@/contracts";

type Props = {
  value: Mode;
  onChange: (mode: Mode) => void;
};

export function ModeToggle({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-zinc-700">Next chapter</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange("rhyme")}
          className={`rounded-md border px-3 py-3 text-left text-sm ${
            value === "rhyme"
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-300 bg-white text-zinc-800"
          }`}
        >
          <span className="block font-medium">Rhyme</span>
          <span className="block text-xs opacity-80">
            Keep the same kind of week
          </span>
        </button>
        <button
          type="button"
          onClick={() => onChange("depart")}
          className={`rounded-md border px-3 py-3 text-left text-sm ${
            value === "depart"
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-300 bg-white text-zinc-800"
          }`}
        >
          <span className="block font-medium">Depart</span>
          <span className="block text-xs opacity-80">
            Change daily life on purpose
          </span>
        </button>
      </div>
    </div>
  );
}
