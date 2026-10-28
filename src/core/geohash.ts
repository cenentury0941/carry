import ngeohash from "ngeohash";

export const AREA_PRECISION = 6;

export function prefixGeohash(geohash: string, precision = AREA_PRECISION): string {
  return geohash.slice(0, precision);
}

export function decodeCenter(geohash: string): { lat: number; lon: number } {
  const { latitude, longitude } = ngeohash.decode(geohash);
  return { lat: latitude, lon: longitude };
}

export function encodeGeohash(lat: number, lon: number, precision = AREA_PRECISION): string {
  return ngeohash.encode(lat, lon, precision);
}

export type HeatAgg = {
  geohash: string;
  affinity: number;
  affinityRank: number;
  popularity: number;
  count: number;
};

export function groupHeatPoints(
  points: {
    geohash: string;
    affinity: number;
    affinityRank: number;
    popularity: number;
  }[],
  precision = AREA_PRECISION,
): HeatAgg[] {
  const map = new Map<string, HeatAgg>();
  for (const p of points) {
    const key = prefixGeohash(p.geohash, precision);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        geohash: key,
        affinity: p.affinity,
        affinityRank: p.affinityRank,
        popularity: p.popularity,
        count: 1,
      });
    } else {
      existing.affinity =
        (existing.affinity * existing.count + p.affinity) / (existing.count + 1);
      existing.affinityRank =
        (existing.affinityRank * existing.count + p.affinityRank) /
        (existing.count + 1);
      existing.popularity =
        (existing.popularity * existing.count + p.popularity) /
        (existing.count + 1);
      existing.count += 1;
    }
  }
  return [...map.values()];
}
