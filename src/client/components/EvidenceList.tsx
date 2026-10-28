"use client";

import type { Area } from "@/contracts";

export function EvidenceList({ area }: { area: Area }) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="font-medium text-zinc-800">Venues</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-zinc-600">
          {area.venues.length === 0 && <li>No venues returned</li>}
          {area.venues.map((v) => (
            <li key={v.id}>
              {v.name}
              {v.address ? ` — ${v.address}` : ""}
              {typeof v.affinity === "number"
                ? ` (affinity ${v.affinity.toFixed(2)})`
                : ""}
            </li>
          ))}
        </ul>
      </div>
      {area.sharedTags.length > 0 && (
        <div>
          <p className="font-medium text-zinc-800">Shared taste tags</p>
          <p className="mt-1 text-zinc-600">
            {area.sharedTags.map((t) => t.name).join(", ")}
          </p>
        </div>
      )}
      {area.changedTags.length > 0 && (
        <div>
          <p className="font-medium text-zinc-800">What changes here</p>
          <p className="mt-1 text-zinc-600">
            {area.changedTags.map((t) => t.name).join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}
