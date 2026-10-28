import {
  CompareResponse,
  InsightsResponse,
  QlooEntity,
  SearchResponse,
  entityAddress,
  entityId,
} from "./schemas";
import { qlooGet } from "./client";

export type PlaceHit = {
  id: string;
  name: string;
  type?: string;
  address?: string;
};

export async function searchPlaces(
  query: string,
  take = 8,
): Promise<PlaceHit[]> {
  const json = await qlooGet("search", {
    query,
    types: "urn:entity:place",
    take,
  });
  const parsed = SearchResponse.parse(json);
  const list = parsed.results ?? parsed.entities ?? [];
  const out: PlaceHit[] = [];
  for (const e of list) {
    const id = entityId(e);
    if (!id || !e.name) continue;
    out.push({
      id,
      name: e.name,
      type: e.type ?? e.subtype,
      address: entityAddress(e),
    });
  }
  return out;
}

export async function getTasteTags(entityIds: string[]): Promise<
  { id: string; name: string; affinity?: number }[]
> {
  const json = await qlooGet("v2/insights", {
    "filter.type": "urn:tag",
    "signal.interests.entities": entityIds.join(","),
    take: 20,
  });
  const parsed = InsightsResponse.parse(json);
  const tags = parsed.results?.tags ?? [];
  const out: { id: string; name: string; affinity?: number }[] = [];
  for (const t of tags) {
    if (!t.id || !t.name) continue;
    out.push({
      id: t.id,
      name: t.name,
      affinity: t.query?.affinity,
    });
  }
  return out;
}

export type HeatPoint = {
  geohash: string;
  affinity: number;
  affinityRank: number;
  popularity: number;
  lat?: number;
  lon?: number;
};

export async function getHeatmap(
  entityIds: string[],
  locationQuery: string,
): Promise<HeatPoint[]> {
  const json = await qlooGet("v2/insights", {
    "filter.type": "urn:heatmap",
    "signal.interests.entities": entityIds.join(","),
    "filter.location.query": locationQuery,
    take: 50,
  });
  const parsed = InsightsResponse.parse(json);
  const points = parsed.results?.heatmap ?? [];
  const out: HeatPoint[] = [];
  for (const p of points) {
    const geohash = p.location?.geohash;
    if (!geohash) continue;
    out.push({
      geohash,
      affinity: p.query?.affinity ?? 0,
      affinityRank: p.query?.affinity_rank ?? 0,
      popularity: p.query?.popularity ?? 0,
      lat: p.location?.latitude,
      lon: p.location?.longitude,
    });
  }
  return out;
}

export async function getPlacesInGeohash(
  entityIds: string[],
  geohash: string,
  take = 8,
): Promise<QlooEntity[]> {
  const json = await qlooGet("v2/insights", {
    "filter.type": "urn:entity:place",
    "signal.interests.entities": entityIds.join(","),
    "filter.location.geohash": geohash,
    take,
  });
  const parsed = InsightsResponse.parse(json);
  return parsed.results?.entities ?? [];
}

export async function getPlacesInLocation(
  entityIds: string[],
  locationQuery: string,
  take = 30,
): Promise<QlooEntity[]> {
  const json = await qlooGet("v2/insights", {
    "filter.type": "urn:entity:place",
    "signal.interests.entities": entityIds.join(","),
    "filter.location.query": locationQuery,
    take,
  });
  const parsed = InsightsResponse.parse(json);
  return parsed.results?.entities ?? [];
}

export type CompareTags = {
  shared: { id: string; name: string; score: number }[];
  uniqueA: { id: string; name: string; score: number }[];
  uniqueB: { id: string; name: string; score: number }[];
};

export async function compareEntities(
  aIds: string[],
  bIds: string[],
): Promise<CompareTags> {
  const json = await qlooGet("v2/analysis/compare", {
    "a.signal.interests.entities": aIds.join(","),
    "b.signal.interests.entities": bIds.join(","),
  });
  const parsed = CompareResponse.parse(json);
  const tags = parsed.results?.tags ?? [];
  const shared: CompareTags["shared"] = [];
  const uniqueA: CompareTags["uniqueA"] = [];
  const uniqueB: CompareTags["uniqueB"] = [];

  for (const t of tags) {
    if (!t.id || !t.name) continue;
    const a = t.query?.a_affinity ?? 0;
    const b = t.query?.b_affinity ?? 0;
    const score = t.query?.affinity ?? Math.min(a, b);
    if (a > 0.1 && b > 0.1) {
      shared.push({ id: t.id, name: t.name, score });
    } else if (a > b) {
      uniqueA.push({ id: t.id, name: t.name, score: a });
    } else if (b > a) {
      uniqueB.push({ id: t.id, name: t.name, score: b });
    }
  }

  shared.sort((x, y) => y.score - x.score);
  uniqueA.sort((x, y) => y.score - x.score);
  uniqueB.sort((x, y) => y.score - x.score);
  return {
    shared: shared.slice(0, 10),
    uniqueA: uniqueA.slice(0, 8),
    uniqueB: uniqueB.slice(0, 8),
  };
}

export type QlooClient = {
  searchPlaces: typeof searchPlaces;
  getTasteTags: typeof getTasteTags;
  getHeatmap: typeof getHeatmap;
  getPlacesInGeohash: typeof getPlacesInGeohash;
  getPlacesInLocation: typeof getPlacesInLocation;
  compareEntities: typeof compareEntities;
};

export const liveQloo: QlooClient = {
  searchPlaces,
  getTasteTags,
  getHeatmap,
  getPlacesInGeohash,
  getPlacesInLocation,
  compareEntities,
};
