import type { Tag } from "@/contracts";
import type { Deps } from "../deps";
import type { AreaEvidence } from "./evidence";

export type AreaCompare = {
  geohash: string;
  sharedTags: Tag[];
  changedTags: Tag[];
};

export async function compareAreas(
  originIds: string[],
  evidence: AreaEvidence[],
  deps: Deps,
): Promise<AreaCompare[]> {
  const withVenues = evidence.filter((e) => e.venues.length > 0);
  const out: AreaCompare[] = [];

  await Promise.all(
    withVenues.map(async (area) => {
      try {
        const bIds = area.venues.slice(0, 5).map((v) => v.id);
        const cmp = await deps.qloo.compareEntities(originIds, bIds);
        out.push({
          geohash: area.geohash,
          sharedTags: cmp.shared.map((t) => ({
            id: t.id,
            name: t.name,
            score: t.score,
          })),
          changedTags: cmp.uniqueB.map((t) => ({
            id: t.id,
            name: t.name,
            score: t.score,
          })),
        });
      } catch (err) {
        deps.log.warn(
          {
            geohash: area.geohash,
            err: err instanceof Error ? err.message : String(err),
          },
          "compare failed",
        );
        out.push({
          geohash: area.geohash,
          sharedTags: [],
          changedTags: [],
        });
      }
    }),
  );

  // Areas with no venues get empty tags
  for (const e of evidence) {
    if (!out.find((o) => o.geohash === e.geohash)) {
      out.push({ geohash: e.geohash, sharedTags: [], changedTags: [] });
    }
  }

  return out;
}
