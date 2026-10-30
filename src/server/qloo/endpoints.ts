import {
  CompareResponse,
  CompareTagRow,
  InsightsResponse,
  QlooEntity,
  SearchResponse,
  compareTagId,
  entityAddress,
  entityId,
} from "./schemas";
import { qlooGet } from "./client";

export type PlaceHit = {
  id: string;
  name: string;
  type?: string;
  address?: string;
  lat?: number;
  lon?: number;
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
      lat: e.location?.lat,
      lon: e.location?.lon,
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

/** Drop ultra-generic tags that appear on nearly every place. */
const NOISE_TAG_IDS = new Set([
  "urn:tag:genre:place",
  "urn:tag:category:place",
]);

function isUsefulTag(id: string, name: string): boolean {
  if (NOISE_TAG_IDS.has(id)) return false;
  if (name.trim().toLowerCase() === "place") return false;
  return true;
}

function tagScore(t: CompareTagRow, fallback = 0.5): number {
  const q = t.query;
  if (!q) return t.popularity ?? fallback;
  if (typeof q.score === "number") return q.score;
  if (typeof q.affinity === "number") return q.affinity;
  if (typeof q.a_affinity === "number" && typeof q.b_affinity === "number") {
    return Math.min(q.a_affinity, q.b_affinity);
  }
  if (typeof q.a_affinity === "number") return q.a_affinity;
  if (typeof q.b_affinity === "number") return q.b_affinity;
  const count =
    typeof q.count === "number"
      ? q.count
      : typeof q.count === "string"
        ? Number(q.count)
        : NaN;
  if (!Number.isNaN(count) && count > 0) {
    return Math.min(1, 0.35 + count * 0.1);
  }
  return t.popularity ?? fallback;
}

/**
 * Normalize /v2/analysis/compare JSON into shared / uniqueA / uniqueB.
 * Supports both the legacy a_affinity/b_affinity shape and the current
 * hackathon shape: results.tags (shared) + results.a / results.b.
 */
export function parseCompareResponse(json: unknown): CompareTags {
  const parsed = CompareResponse.parse(json);
  const results = parsed.results ?? {};
  const sharedRows = results.tags ?? [];
  const aRows = results.a ?? [];
  const bRows = results.b ?? [];

  const shared: CompareTags["shared"] = [];
  const uniqueA: CompareTags["uniqueA"] = [];
  const uniqueB: CompareTags["uniqueB"] = [];
  const seenShared = new Set<string>();
  const seenA = new Set<string>();
  const seenB = new Set<string>();

  // Path 1: current API — shared in tags[], side lists in a[] / b[]
  if (aRows.length > 0 || bRows.length > 0 || sharedRows.some((t) => t.tag_id)) {
    for (const t of sharedRows) {
      const id = compareTagId(t);
      if (!id || !t.name || !isUsefulTag(id, t.name)) continue;
      if (seenShared.has(id)) continue;
      seenShared.add(id);
      shared.push({ id, name: t.name, score: tagScore(t) });
    }

    for (const t of aRows) {
      const id = compareTagId(t);
      if (!id || !t.name || !isUsefulTag(id, t.name)) continue;
      if (seenShared.has(id) || seenA.has(id)) continue;
      seenA.add(id);
      uniqueA.push({ id, name: t.name, score: tagScore(t, 0.45) });
    }

    for (const t of bRows) {
      const id = compareTagId(t);
      if (!id || !t.name || !isUsefulTag(id, t.name)) continue;
      if (seenShared.has(id) || seenB.has(id)) continue;
      seenB.add(id);
      uniqueB.push({ id, name: t.name, score: tagScore(t, 0.45) });
    }
  } else {
    // Path 2: legacy affinity fields on a single tags[] list
    for (const t of sharedRows) {
      const id = compareTagId(t);
      if (!id || !t.name || !isUsefulTag(id, t.name)) continue;
      const a = t.query?.a_affinity ?? 0;
      const b = t.query?.b_affinity ?? 0;
      const score = t.query?.affinity ?? Math.min(a, b);
      if (a > 0.1 && b > 0.1) {
        shared.push({ id, name: t.name, score });
      } else if (a > b) {
        uniqueA.push({ id, name: t.name, score: a });
      } else if (b > a) {
        uniqueB.push({ id, name: t.name, score: b });
      }
    }
  }

  shared.sort((x, y) => y.score - x.score);
  uniqueA.sort((x, y) => y.score - x.score);
  uniqueB.sort((x, y) => y.score - x.score);

  // Qloo often returns genre + category tags with the same display name.
  const byName = <T extends { name: string }>(
    rows: T[],
    excludeNames?: Set<string>,
  ): T[] => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const row of rows) {
      const key = row.name.trim().toLowerCase();
      if (excludeNames?.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
    return out;
  };

  const sharedClean = byName(shared);
  const sharedNames = new Set(
    sharedClean.map((t) => t.name.trim().toLowerCase()),
  );

  return {
    shared: sharedClean.slice(0, 10),
    uniqueA: byName(uniqueA, sharedNames).slice(0, 8),
    uniqueB: byName(uniqueB, sharedNames).slice(0, 8),
  };
}

export async function compareEntities(
  aIds: string[],
  bIds: string[],
): Promise<CompareTags> {
  const json = await qlooGet("v2/analysis/compare", {
    "a.signal.interests.entities": aIds.join(","),
    "b.signal.interests.entities": bIds.join(","),
  });
  return parseCompareResponse(json);
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
