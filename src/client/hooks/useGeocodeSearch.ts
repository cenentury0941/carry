"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { PlaceHit } from "@/contracts";

class GeocodeError extends Error {
  constructor(public status: number) {
    super("Geocode failed");
  }
}

export function useGeocodeSearch(query: string) {
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  return useQuery({
    queryKey: ["geocode", debounced],
    enabled: debounced.length >= 2,
    queryFn: async (): Promise<PlaceHit[]> => {
      const res = await fetch(
        `/api/geocode?q=${encodeURIComponent(debounced)}&take=8`,
      );
      if (!res.ok) throw new GeocodeError(res.status);
      const json = (await res.json()) as { results: PlaceHit[] };
      return json.results ?? [];
    },
    retry: (failureCount, err) =>
      !(err instanceof GeocodeError && err.status === 429) && failureCount < 2,
  });
}
