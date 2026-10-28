"use client";

import type { Area } from "@/contracts";
import { EvidenceList } from "./EvidenceList";

type Props = {
  area: Area;
  kind: "rhyme" | "depart";
  selected?: boolean;
  onSelect?: () => void;
};

export function AreaCard({ area, kind, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-4 text-left transition ${
        selected
          ? "border-zinc-900 bg-zinc-50"
          : "border-zinc-200 bg-white hover:border-zinc-400"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            {kind}
          </p>
          <h3 className="text-lg font-semibold text-zinc-900">{area.label}</h3>
        </div>
        <div className="text-right text-sm text-zinc-600">
          <p>Score {(area.score * 100).toFixed(0)}</p>
          {typeof area.affinity === "number" && (
            <p className="text-xs">Affinity {area.affinity.toFixed(2)}</p>
          )}
        </div>
      </div>
      {selected && (
        <div className="mt-4 border-t border-zinc-200 pt-3">
          <EvidenceList area={area} />
        </div>
      )}
    </button>
  );
}
