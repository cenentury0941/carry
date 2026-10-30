"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { PlaceHit } from "@/contracts";

class SearchError extends Error {
  constructor(public status: number) {
    super("Search failed");
  }
}

export function usePlaceSearch(query: string) {
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  return useQuery({
    queryKey: ["places", debounced],
    enabled: debounced.length >= 2,
    queryFn: async (): Promise<PlaceHit[]> => {
      const res = await fetch(
        `/api/places/search?q=${encodeURIComponent(debounced)}&take=8`,
      );
      if (!res.ok) throw new SearchError(res.status);
      const json = (await res.json()) as { results: PlaceHit[] };
      return json.results ?? [];
    },
    retry: (failureCount, err) =>
      !(err instanceof SearchError && err.status === 429) && failureCount < 2,
  });
}
