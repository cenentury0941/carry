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

/** Great-circle distance in kilometers. */
export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
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
