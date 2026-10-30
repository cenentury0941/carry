"use client";

import { useState } from "react";
import type { ResolvedPlace } from "@/contracts";
import { useGeocodeSearch } from "../hooks/useGeocodeSearch";

type Props = {
  selected: ResolvedPlace[];
  onChange: (places: ResolvedPlace[]) => void;
  max?: number;
  label?: string;
  placeholder?: string;
};

export function AddressPicker({
  selected,
  onChange,
  max = 6,
  label = "Addresses",
  placeholder = "Street address, city…",
}: Props) {
  const [query, setQuery] = useState("");
  const { data, isFetching, isError } = useGeocodeSearch(query);

  function add(place: ResolvedPlace) {
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
      <label className="block text-sm font-medium text-zinc-700">{label}</label>
      <p className="text-xs text-zinc-500">
        Type a residential address. We geocode it, then find nearby cultural
        matches with Qloo.
      </p>
      <div className="flex flex-wrap gap-2">
        {selected.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => remove(p.id)}
            className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-sm text-zinc-800 hover:bg-zinc-100"
            title={p.address}
          >
            {p.name} ×
          </button>
        ))}
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
        disabled={selected.length >= max}
        autoComplete="street-address"
      />
      {query.length >= 2 && (
        <ul className="max-h-48 overflow-auto rounded-md border border-zinc-200 bg-white shadow-sm">
          {isFetching && (
            <li className="px-3 py-2 text-sm text-zinc-500">Geocoding…</li>
          )}
          {isError && (
            <li className="px-3 py-2 text-sm text-red-600">Geocode failed</li>
          )}
          {!isFetching && data?.length === 0 && (
            <li className="px-3 py-2 text-sm text-zinc-500">No addresses found</li>
          )}
          {data?.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-zinc-50"
                onClick={() =>
                  add({
                    id: hit.id,
                    name: hit.name,
                    address: hit.address,
                    type: hit.type,
                    lat: hit.lat,
                    lon: hit.lon,
                  })
                }
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
