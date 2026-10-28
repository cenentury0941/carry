"use client";

import { useState } from "react";
import type { OriginPlace } from "@/contracts";
import { usePlaceSearch } from "../hooks/usePlaceSearch";

type Props = {
  selected: OriginPlace[];
  onChange: (places: OriginPlace[]) => void;
  max?: number;
};

export function PlacePicker({ selected, onChange, max = 6 }: Props) {
  const [query, setQuery] = useState("");
  const { data, isFetching, isError } = usePlaceSearch(query);

  function add(place: OriginPlace) {
    if (selected.some((s) => s.id === place.id)) return;
    if (selected.length >= max) return;
    onChange([...selected, place]);
    setQuery("");
  }

  function remove(id: string) {
    onChange(selected.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-700">
        Places from your week (3–6)
      </label>
      <div className="flex flex-wrap gap-2">
        {selected.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => remove(p.id)}
            className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-sm text-zinc-800 hover:bg-zinc-100"
          >
            {p.name} ×
          </button>
        ))}
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search cafes, venues, shops…"
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
        disabled={selected.length >= max}
      />
      {query.length >= 2 && (
        <ul className="max-h-48 overflow-auto rounded-md border border-zinc-200 bg-white shadow-sm">
          {isFetching && (
            <li className="px-3 py-2 text-sm text-zinc-500">Searching…</li>
          )}
          {isError && (
            <li className="px-3 py-2 text-sm text-red-600">Search failed</li>
          )}
          {!isFetching && data?.length === 0 && (
            <li className="px-3 py-2 text-sm text-zinc-500">No matches</li>
          )}
          {data?.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-zinc-50"
                onClick={() => add({ id: hit.id, name: hit.name })}
              >
                <span className="font-medium text-zinc-900">{hit.name}</span>
                {hit.address && (
                  <span className="text-xs text-zinc-500">{hit.address}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
