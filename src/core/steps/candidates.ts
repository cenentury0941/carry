import type { BriefInput } from "@/contracts";
import type { Deps } from "../deps";
import { CarryError } from "../deps";
import { encodeGeohash, groupHeatPoints, type HeatAgg } from "../geohash";
import { entityId } from "@/server/qloo/schemas";

export type CandidatesResult = {
  heat: HeatAgg[];
  usedFallback: boolean;
};

export async function findCandidates(
  input: BriefInput,
  entityIds: string[],
  deps: Deps,
): Promise<CandidatesResult> {
  try {
    const points = await deps.qloo.getHeatmap(entityIds, input.destination);
    if (points.length > 0) {
      return { heat: groupHeatPoints(points), usedFallback: false };
    }
  } catch (err) {
    deps.log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "heatmap failed, trying place fallback",
    );
  }

  // Fallback: places in destination, grouped by geohash of their coordinates
  try {
    const places = await deps.qloo.getPlacesInLocation(
      entityIds,
      input.destination,
      40,
    );
    const synthetic = places
      .map((p) => {
        const lat = p.location?.lat;
        const lon = p.location?.lon;
        if (typeof lat !== "number" || typeof lon !== "number") return null;
        const affinity = p.query?.affinity ?? 0.5;
        return {
          geohash: encodeGeohash(lat, lon),
          affinity,
          affinityRank: affinity,
          popularity: 0.5,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    if (synthetic.length === 0) {
      // Still try to group by any entity id presence — last resort empty
      deps.log.warn({ placeCount: places.length }, "no geocoded places");
      // Create a single synthetic bucket if we have places without coords
      if (places.length > 0) {
        return {
          heat: [
            {
              geohash: "fallback",
              affinity: 0.5,
              affinityRank: 0.5,
              popularity: 0.5,
              count: places.length,
            },
          ],
          usedFallback: true,
        };
      }
      throw new CarryError(
        "no_data",
        `No neighborhood signals for ${input.destination}. Try another city.`,
      );
    }

    return { heat: groupHeatPoints(synthetic), usedFallback: true };
  } catch (err) {
    if (err instanceof CarryError) throw err;
    deps.log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "candidates failed",
    );
    throw new CarryError(
      "upstream",
      "Could not find candidate areas in the destination.",
    );
  }
}

export function placeIds(places: { entity_id?: string; id?: string }[]): string[] {
  return places
    .map((p) => entityId(p as never))
    .filter((id): id is string => Boolean(id));
}
