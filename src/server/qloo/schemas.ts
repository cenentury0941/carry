import { z } from "zod";

export const QlooEntity = z
  .object({
    entity_id: z.string().optional(),
    id: z.string().optional(),
    name: z.string().optional(),
    type: z.string().optional(),
    subtype: z.string().optional(),
    properties: z.record(z.string(), z.unknown()).optional(),
    location: z
      .object({
        lat: z.number().optional(),
        lon: z.number().optional(),
      })
      .optional(),
    query: z
      .object({
        affinity: z.number().optional(),
        rank: z.number().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type QlooEntity = z.infer<typeof QlooEntity>;

export const SearchResponse = z
  .object({
    results: z.array(QlooEntity).optional(),
    entities: z.array(QlooEntity).optional(),
  })
  .passthrough();

export const InsightsResponse = z
  .object({
    results: z
      .object({
        entities: z.array(QlooEntity).optional(),
        tags: z
          .array(
            z
              .object({
                id: z.string().optional(),
                name: z.string().optional(),
                type: z.string().optional(),
                query: z
                  .object({ affinity: z.number().optional() })
                  .passthrough()
                  .optional(),
              })
              .passthrough(),
          )
          .optional(),
        heatmap: z
          .array(
            z
              .object({
                location: z
                  .object({
                    geohash: z.string().optional(),
                    latitude: z.number().optional(),
                    longitude: z.number().optional(),
                  })
                  .passthrough()
                  .optional(),
                query: z
                  .object({
                    affinity: z.number().optional(),
                    affinity_rank: z.number().optional(),
                    popularity: z.number().optional(),
                  })
                  .passthrough()
                  .optional(),
              })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough()
      .optional(),
    duration: z.number().optional(),
  })
  .passthrough();

export type InsightsResponse = z.infer<typeof InsightsResponse>;

export const CompareResponse = z
  .object({
    results: z
      .object({
        tags: z
          .array(
            z
              .object({
                id: z.string().optional(),
                name: z.string().optional(),
                type: z.string().optional(),
                query: z
                  .object({
                    affinity: z.number().optional(),
                    a_affinity: z.number().optional(),
                    b_affinity: z.number().optional(),
                  })
                  .passthrough()
                  .optional(),
              })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type CompareResponse = z.infer<typeof CompareResponse>;

export function entityId(e: QlooEntity): string | undefined {
  return e.entity_id ?? e.id;
}

export function entityAddress(e: QlooEntity): string | undefined {
  const props = e.properties ?? {};
  const candidates = [
    props.address,
    props.formatted_address,
    props.neighborhood,
    props.locality,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }
  return undefined;
}
