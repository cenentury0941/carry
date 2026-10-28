import { z } from "zod";

export const PlaceSearchQuery = z.object({
  q: z.string().min(1).max(100),
  take: z.coerce.number().int().min(1).max(20).default(8),
});
export type PlaceSearchQuery = z.infer<typeof PlaceSearchQuery>;

export const PlaceHit = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().optional(),
  address: z.string().optional(),
});
export type PlaceHit = z.infer<typeof PlaceHit>;

export const PlaceSearchResponse = z.object({
  results: z.array(PlaceHit),
});
export type PlaceSearchResponse = z.infer<typeof PlaceSearchResponse>;
