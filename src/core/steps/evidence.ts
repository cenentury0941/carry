import type { EvidenceEntity } from "@/contracts";
import type { Deps } from "../deps";
import type { HeatAgg } from "../geohash";
import { entityAddress, entityId } from "@/server/qloo/schemas";

export type AreaEvidence = {
  geohash: string;
  venues: EvidenceEntity[];
};

function toVenue(e: {
  entity_id?: string;
  id?: string;
  name?: string;
  type?: string;
  properties?: Record<string, unknown>;
  query?: { affinity?: number };
}): EvidenceEntity | null {
  const id = entityId(e as never);
  if (!id || !e.name) return null;
  return {
    id,
    name: e.name,
    type: e.type,
    address: entityAddress(e as never),
    affinity: e.query?.affinity,
  };
}

export async function gatherEvidence(
  entityIds: string[],
  heat: HeatAgg[],
  destination: string,
  deps: Deps,
): Promise<AreaEvidence[]> {
  const top = [...heat]
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, 8);

  const results: AreaEvidence[] = [];

  await Promise.all(
    top.map(async (h) => {
      try {
        let venues: EvidenceEntity[] = [];
        if (h.geohash === "fallback") {
          const places = await deps.qloo.getPlacesInLocation(
            entityIds,
            destination,
            12,
          );
          venues = places
            .map(toVenue)
            .filter((v): v is EvidenceEntity => Boolean(v));
        } else {
          const places = await deps.qloo.getPlacesInGeohash(
            entityIds,
            h.geohash,
            8,
          );
          venues = places
            .map(toVenue)
            .filter((v): v is EvidenceEntity => Boolean(v));

          // If geohash filter returns empty, fall back to destination search
          if (venues.length === 0) {
            const places2 = await deps.qloo.getPlacesInLocation(
              entityIds,
              destination,
              12,
            );
            venues = places2
              .map(toVenue)
              .filter((v): v is EvidenceEntity => Boolean(v))
              .slice(0, 6);
          }
        }
        results.push({ geohash: h.geohash, venues });
      } catch (err) {
        deps.log.warn(
          {
            geohash: h.geohash,
            err: err instanceof Error ? err.message : String(err),
          },
          "evidence area failed",
        );
        results.push({ geohash: h.geohash, venues: [] });
      }
    }),
  );

  return results;
}
