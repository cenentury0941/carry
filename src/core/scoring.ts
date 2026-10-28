import type { Area, EvidenceEntity, Tag } from "@/contracts";
import type { HeatAgg } from "./geohash";

export type ScoredCandidate = {
  geohash: string;
  affinity: number;
  affinityRank: number;
  popularity: number;
  venues: EvidenceEntity[];
  sharedTags: Tag[];
  changedTags: Tag[];
  label: string;
  rhymeScore: number;
  departScore: number;
  ritualCoverage: number;
  sharedTagScore: number;
};

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function sharedTagScore(tags: Tag[]): number {
  if (tags.length === 0) return 0;
  const top = tags.slice(0, 5);
  const avg =
    top.reduce((sum, t) => sum + (t.score ?? 0), 0) / Math.max(top.length, 1);
  return clamp01(avg);
}

export function ritualCoverage(
  originCount: number,
  venueCount: number,
): number {
  if (originCount <= 0) return 0;
  return clamp01(venueCount / Math.max(originCount, 3));
}

export function rhymeScore(
  affinity: number,
  shared: number,
  coverage: number,
): number {
  return clamp01(0.5 * affinity + 0.3 * shared + 0.2 * coverage);
}

export function departScore(popularity: number, affinityRank: number): number {
  return clamp01(popularity * (1 - affinityRank));
}

export function labelFromVenues(venues: EvidenceEntity[], fallback: string): string {
  for (const v of venues) {
    if (v.address) {
      const parts = v.address.split(",").map((s) => s.trim());
      if (parts.length >= 2) return parts[parts.length - 2] || parts[0];
      return parts[0];
    }
  }
  if (venues[0]?.name) return `Near ${venues[0].name}`;
  return fallback;
}

export function scoreAreas(
  heat: HeatAgg[],
  byGeohash: Map<
    string,
    {
      venues: EvidenceEntity[];
      sharedTags: Tag[];
      changedTags: Tag[];
    }
  >,
  originCount: number,
): ScoredCandidate[] {
  return heat.map((h) => {
    const data = byGeohash.get(h.geohash) ?? {
      venues: [],
      sharedTags: [],
      changedTags: [],
    };
    const shared = sharedTagScore(data.sharedTags);
    const coverage = ritualCoverage(originCount, data.venues.length);
    return {
      geohash: h.geohash,
      affinity: h.affinity,
      affinityRank: h.affinityRank,
      popularity: h.popularity,
      venues: data.venues,
      sharedTags: data.sharedTags,
      changedTags: data.changedTags,
      label: labelFromVenues(data.venues, `Area ${h.geohash}`),
      rhymeScore: rhymeScore(h.affinity, shared, coverage),
      departScore: departScore(h.popularity, h.affinityRank),
      ritualCoverage: coverage,
      sharedTagScore: shared,
    };
  });
}

export function pickRhymeAreas(candidates: ScoredCandidate[], n = 3): Area[] {
  return [...candidates]
    .filter((c) => c.venues.length > 0)
    .sort((a, b) => b.rhymeScore - a.rhymeScore)
    .slice(0, n)
    .map(toArea);
}

export function pickDepartArea(candidates: ScoredCandidate[]): Area | null {
  const eligible = candidates.filter((c) => c.venues.length >= 3);
  if (eligible.length === 0) return null;
  const best = [...eligible].sort((a, b) => b.departScore - a.departScore)[0];
  if (!best || best.departScore <= 0) return null;
  return toArea(best);
}

export function continuityFromRhyme(rhyme: Area[]): number {
  if (rhyme.length === 0) return 0;
  return Math.round(clamp01(rhyme[0].score) * 100);
}

function toArea(c: ScoredCandidate): Area {
  return {
    geohash: c.geohash,
    label: c.label,
    score: c.rhymeScore,
    affinity: c.affinity,
    popularity: c.popularity,
    venues: c.venues,
    sharedTags: c.sharedTags,
    changedTags: c.changedTags,
  };
}
