"use client";

import { useQuery } from "@tanstack/react-query";
import type { Brief } from "@/contracts";

export function useBrief(id: string | undefined) {
  return useQuery({
    queryKey: ["brief", id],
    enabled: Boolean(id),
    queryFn: async (): Promise<Brief> => {
      const res = await fetch(`/api/briefs/${id}`);
      if (!res.ok) throw new Error("Brief not found");
      return (await res.json()) as Brief;
    },
  });
}
