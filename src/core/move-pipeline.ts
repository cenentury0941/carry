import type {
  MoveProject,
  MoveStreamEvent,
  RankedDestination,
  RankedMoveResult,
  ResolvedPlace,
  Tag,
  TastePriority,
} from "@/contracts";
import type { Deps } from "./deps";
import { CarryError } from "./deps";
import {
  decodeCenter,
  encodeGeohash,
  groupHeatPoints,
  haversineKm,
} from "./geohash";
import type { ResolvedRegion } from "@/server/photon";
import {
  adjustContinuities,
  ritualCoverage,
  rhymeScore,
  tasteDistance,
  sharedTagScore,
} from "./scoring";
import { tastePriorityMeta } from "./priority-meta";
import { filterUsefulTags, phraseList } from "./humanize-tags";
import { attachVenueEvidence } from "./venue-why";
import {
  filterRelocationVenues,
  isRelocationRelevantVenue,
} from "./venue-filter";
import { entityAddress, entityId } from "@/server/qloo/schemas";
import { isQlooEntityId } from "@/server/photon";
import type { EvidenceEntity } from "@/contracts";

type CandidateSeed = {
  id: string;
  label: string;
  locationQuery: string;
  address?: string;
  lat?: number;
  lon?: number;
  entityIds: string[];
};

/** Ensure seed ids are unique (nearby homes can share a geohash cell). */
function uniquifySeedIds(seeds: CandidateSeed[]): CandidateSeed[] {
  const counts = new Map<string, number>();
  return seeds.map((seed) => {
    const n = counts.get(seed.id) ?? 0;
    counts.set(seed.id, n + 1);
    if (n === 0) return seed;
    return { ...seed, id: `${seed.id}~${n}` };
  });
}

/** Strip uniqueness suffix for geohash decode: `geo:dr4e6k~1` → `dr4e6k`. */
export function rawGeohashFromSeedId(id: string): string | null {
  if (!id.startsWith("geo:")) return null;
  return id.slice(4).split("~")[0] || null;
}

function pickScore(
  priority: TastePriority,
  rhyme: number,
  distance: number,
): number {
  // Change = max taste distance (reverse similarity). Balanced mixes both.
  if (priority === "depart") return distance;
  if (priority === "rhyme") return rhyme;
  return 0.6 * rhyme + 0.4 * distance;
}

function templateDestination(input: {
  label: string;
  continuity: number;
  matches: Tag[];
  mismatches: Tag[];
  venueNames: string[];
  priority: TastePriority;
}): {
  summary: string;
  matchExplanation: string;
  mismatchExplanation: string;
  expect: string[];
} {
  const matchPhrase = phraseList(
    input.matches.map((t) => t.name),
    4,
  );
  const missPhrase = phraseList(
    input.mismatches.map((t) => t.name),
    3,
  );
  const matchExplanation = matchPhrase
    ? input.priority === "depart"
      ? `You’d still recognize a few threads — ${matchPhrase} show up locally, so you wouldn’t be totally at sea.`
      : `You’d still find familiar ground here — ${matchPhrase} show up strongly in the local taste profile.`
    : input.priority === "depart"
      ? "There’s little clear overlap with what you like now — that stretch is the point of a Change move."
      : "There’s less clear overlap with what you like now, so treat this as a fresher change of pace.";
  const mismatchExplanation = missPhrase
    ? input.priority === "rhyme"
      ? `A lighter note of difference: a stronger local pull toward ${missPhrase} than you have now — optional flavor, not the headline.`
      : `What feels different is a stronger pull toward ${missPhrase} than you have now. That can be a welcome change or take a little getting used to.`
    : input.priority === "rhyme"
      ? "Differences are muted here — the day-to-day should rhyme with home."
      : "We didn’t find big lifestyle differences — walk the neighborhood before you decide.";

  const continuityLine =
    input.priority === "rhyme"
      ? `${input.label} scores ${input.continuity} out of 100 for how closely day-to-day taste would rhyme with the places you love.`
      : input.priority === "depart"
        ? `${input.label} scores ${input.continuity} out of 100 for continuity — lower means a clearer change of pace from your current tastes.`
        : `${input.label} scores ${input.continuity} out of 100 for how well it matches the places you love.`;
  const summaryParts =
    input.priority === "rhyme"
      ? [continuityLine, matchExplanation, mismatchExplanation]
      : input.priority === "depart"
        ? [continuityLine, mismatchExplanation, matchExplanation]
        : [continuityLine, matchExplanation, mismatchExplanation];

  const familiarTip = matchPhrase
    ? `Keep a few of your usual habits — seek out ${phraseList(input.matches.map((t) => t.name), 2)} early on so it feels familiar from the start.`
    : "Spend a weekend walking the area before you commit.";
  const stretchTip = missPhrase
    ? `If you want the move to stretch you, deliberately try something more ${phraseList(input.mismatches.map((t) => t.name), 2)} than your usual routine.`
    : "Come back for another look over a weekend before signing anything.";
  const venueTip = input.venueNames[0]
    ? `Start with ${input.venueNames[0]} when you first get there to get a feel for the neighborhood.`
    : "Pick one morning spot and one weeknight hangout on your first visit.";

  const expect =
    input.priority === "depart"
      ? [stretchTip, venueTip, familiarTip]
      : input.priority === "rhyme"
        ? [familiarTip, venueTip, stretchTip]
        : [familiarTip, venueTip, stretchTip];

  return {
    summary: summaryParts.join(" "),
    matchExplanation,
    mismatchExplanation,
    expect,
  };
}

async function expandCandidates(
  project: MoveProject,
  tasteIds: string[],
  deps: Deps,
): Promise<CandidateSeed[]> {
  const target = project.target;
  if (!target) throw new CarryError("invalid_input", "Target scope is required.");

  if (target.kind === "addresses" || target.kind === "areas") {
    return uniquifySeedIds(
      target.places.map((p, index) => {
        const hasCoords =
          typeof p.lat === "number" && typeof p.lon === "number";
        // Prefer Photon/Qloo place id; fall back to coords so blanks never collide.
        const id =
          p.id ||
          (hasCoords
            ? `geo:${encodeGeohash(p.lat!, p.lon!)}:${index}`
            : `place:${index}:${p.name}`);
        return {
          id,
          label: p.name,
          locationQuery: p.address || p.name,
          address: p.address || p.name,
          lat: p.lat,
          lon: p.lon,
          // Photon / free-text homes are locations only — not Qloo taste entities.
          entityIds: isQlooEntityId(p.id) ? [p.id] : [],
        };
      }),
    );
  }

  // ambiguous region → canonicalize, then heatmap / place clusters
  const resolved = await deps.geocodeRegion(target.region);
  const locationQuery = resolved?.query ?? target.region;
  if (resolved && resolved.query !== target.region) {
    deps.log.info(
      { from: target.region, to: resolved.query },
      "region query canonicalized",
    );
  }

  try {
    const heat = await deps.qloo.getHeatmap(tasteIds, locationQuery);
    const inRegion = filterHeatToRegion(heat, resolved);
    if (inRegion.length > 0) {
      const grouped = groupHeatPoints(inRegion)
        .sort((a, b) => b.affinity - a.affinity)
        .slice(0, 8);
      return uniquifySeedIds(
        grouped.map((g) => {
          const center = decodeCenter(g.geohash);
          return {
            id: `geo:${g.geohash}`,
            label: `Area ${g.geohash}`,
            locationQuery,
            address: locationQuery,
            lat: center.lat,
            lon: center.lon,
            entityIds: tasteIds.slice(0, 3),
          };
        }),
      );
    }
  } catch (err) {
    deps.log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "heatmap expand failed",
    );
  }

  const places = await deps.qloo.getPlacesInLocation(
    tasteIds,
    locationQuery,
    30,
  );
  const byHash = new Map<
    string,
    { label: string; ids: string[]; lat?: number; lon?: number; address?: string }
  >();
  for (const p of places) {
    const id = entityId(p);
    if (!id || !p.name) continue;
    const lat = p.location?.lat;
    const lon = p.location?.lon;
    if (
      resolved &&
      typeof lat === "number" &&
      typeof lon === "number" &&
      !withinRegion(lat, lon, resolved)
    ) {
      continue;
    }
    const hash =
      typeof lat === "number" && typeof lon === "number"
        ? encodeGeohash(lat, lon)
        : `place:${id}`;
    const existing = byHash.get(hash);
    if (!existing) {
      byHash.set(hash, {
        label: entityAddress(p)?.split(",").slice(-2).join(",").trim() || p.name,
        ids: [id],
        lat,
        lon,
        address: entityAddress(p) || p.name,
      });
    } else if (existing.ids.length < 5) {
      existing.ids.push(id);
    }
  }

  const seeds = uniquifySeedIds(
    [...byHash.entries()].slice(0, 8).map(([hash, v]) => {
      let lat = v.lat;
      let lon = v.lon;
      if (
        (typeof lat !== "number" || typeof lon !== "number") &&
        !hash.startsWith("place:")
      ) {
        const center = decodeCenter(hash);
        lat = center.lat;
        lon = center.lon;
      }
      return {
        id: hash.startsWith("place:") ? v.ids[0] : `geo:${hash}`,
        label: v.label,
        locationQuery,
        address: v.address || locationQuery,
        lat,
        lon,
        entityIds: v.ids,
      };
    }),
  );

  if (seeds.length === 0) {
    throw new CarryError(
      "no_data",
      `No candidate areas found in ${locationQuery}. Check the region spelling and try again.`,
    );
  }
  return seeds;
}

function withinRegion(
  lat: number,
  lon: number,
  region: ResolvedRegion,
): boolean {
  return (
    haversineKm({ lat, lon }, { lat: region.lat, lon: region.lon }) <=
    region.radiusKm
  );
}

function filterHeatToRegion<
  T extends { geohash: string; lat?: number; lon?: number },
>(points: T[], region: ResolvedRegion | null): T[] {
  if (!region) return points;
  return points.filter((p) => {
    const lat =
      typeof p.lat === "number" ? p.lat : decodeCenter(p.geohash).lat;
    const lon =
      typeof p.lon === "number" ? p.lon : decodeCenter(p.geohash).lon;
    return withinRegion(lat, lon, region);
  });
}

/** City/neighborhood fragment from a Photon-style address for Qloo search. */
function residenceSearchQuery(residence: ResolvedPlace): string {
  const addr = residence.address || residence.name;
  // "347 5th Avenue, Brooklyn, New York, 11215, United States" → "Brooklyn New York"
  const parts = addr.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return `${parts[1]} ${parts[2]}`.replace(/\b\d{5}(-\d{4})?\b/, "").trim();
  }
  return addr;
}

/** Accept a tag search hit only on a clear name match (kit: don't force uncertain tags). */
export function pickClearTagMatch(
  query: string,
  hits: { id: string; name: string }[],
): { id: string; name: string } | null {
  const q = query.trim().toLowerCase();
  if (!q || hits.length === 0) return null;
  const exact = hits.find((h) => h.name.trim().toLowerCase() === q);
  if (exact) return { id: exact.id, name: exact.name };
  const substring = hits.find((h) =>
    h.name.trim().toLowerCase().includes(q),
  );
  if (substring) return { id: substring.id, name: substring.name };
  return null;
}

async function resolvePreferenceTags(
  tags: string[],
  deps: Deps,
): Promise<{ id: string; name: string }[]> {
  const out: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const raw of tags) {
    const query = raw.trim();
    if (!query) continue;
    try {
      const hits = await deps.qloo.searchTags(query, 3);
      const pick = pickClearTagMatch(query, hits);
      if (!pick || seen.has(pick.id)) continue;
      seen.add(pick.id);
      out.push(pick);
    } catch (err) {
      deps.log.warn(
        { tag: query, err: err instanceof Error ? err.message : String(err) },
        "preference tag search failed",
      );
    }
  }
  return out;
}

/**
 * Build Qloo entity ids for taste profiling.
 * Photon residences are locations only — when inferring from residence we
 * seed via Qloo place search + nearby venues at that address.
 */
async function resolveTasteEntityIds(
  project: MoveProject,
  deps: Deps,
): Promise<string[]> {
  const ids: string[] = [];
  for (const p of project.tastes?.places ?? []) {
    if (isQlooEntityId(p.id)) ids.push(p.id);
  }

  const residence = project.residence;
  const infer = project.tastes?.inferredFromResidence ?? false;
  if (infer && residence) {
    if (isQlooEntityId(residence.id)) {
      ids.unshift(residence.id);
    } else {
      try {
        const hits = await deps.qloo.searchPlaces(
          residenceSearchQuery(residence),
          8,
        );
        for (const h of hits) {
          if (isQlooEntityId(h.id)) ids.push(h.id);
        }
      } catch (err) {
        deps.log.warn(
          { err: err instanceof Error ? err.message : String(err) },
          "residence area search failed",
        );
      }

      const seed = ids.filter(isQlooEntityId).slice(0, 3);
      if (seed.length) {
        try {
          let nearby = toVenues([]);
          if (
            typeof residence.lat === "number" &&
            typeof residence.lon === "number"
          ) {
            nearby = toVenues(
              await deps.qloo.getPlacesInGeohash(
                seed,
                encodeGeohash(residence.lat, residence.lon),
                12,
              ),
            );
          }
          if (!nearby.length) {
            const loc = residence.address || residence.name;
            nearby = toVenues(
              await deps.qloo.getPlacesInLocation(seed, loc, 12),
            );
          }
          for (const v of nearby) {
            if (isQlooEntityId(v.id)) ids.push(v.id);
          }
        } catch (err) {
          deps.log.warn(
            { err: err instanceof Error ? err.message : String(err) },
            "residence nearby venues failed",
          );
        }
      }
    }
  }

  return [...new Set(ids.filter(isQlooEntityId))].slice(0, 12);
}

function toVenues(
  entities: {
    entity_id?: string;
    id?: string;
    name?: string;
    type?: string;
    properties?: Record<string, unknown>;
    location?: { lat?: number; lon?: number };
    query?: { affinity?: number };
  }[],
) {
  const out: {
    id: string;
    name: string;
    type?: string;
    address?: string;
    affinity?: number;
    lat?: number;
    lon?: number;
  }[] = [];
  for (const e of entities) {
    const id = entityId(e as never);
    if (!id || !e.name) continue;
    out.push({
      id,
      name: e.name,
      type: e.type,
      address: entityAddress(e as never),
      affinity: e.query?.affinity,
      lat: e.location?.lat,
      lon: e.location?.lon,
    });
  }
  return filterRelocationVenues(out);
}

export async function* runMovePipeline(
  project: MoveProject,
  deps: Deps,
): AsyncGenerator<MoveStreamEvent> {
  try {
    if (!project.residence) {
      throw new CarryError("invalid_input", "Residence is required.");
    }
    if (!project.target) {
      throw new CarryError("invalid_input", "Target scope is required.");
    }
    if (!project.tastes) {
      throw new CarryError("invalid_input", "Taste profile is required.");
    }

    yield { type: "step", step: "profile", status: "start" };

    const tasteIds = await resolveTasteEntityIds(project, deps);
    if (tasteIds.length === 0) {
      throw new CarryError(
        "invalid_input",
        "Add taste places (cafes, venues) or a Qloo-known residence so we can profile cultural tastes.",
      );
    }

    const originTags = await deps.qloo.getTasteTags(tasteIds);
    const resolvedPreferenceTags = await resolvePreferenceTags(
      project.tastes.tags,
      deps,
    );
    yield { type: "step", step: "profile", status: "done" };

    yield { type: "step", step: "candidates", status: "start" };
    const seeds = await expandCandidates(project, tasteIds, deps);
    yield { type: "step", step: "candidates", status: "done" };

    yield { type: "step", step: "score", status: "start" };

    const priority = project.tastes.priorities[0] ?? "balanced";
    const priorityMeta = tastePriorityMeta(priority);
    const destinations: RankedDestination[] = [];

    await Promise.all(
      seeds.map(async (seed) => {
        try {
          // Prefer geohash when we have coordinates (Photon homes); else location query.
          let venues: ReturnType<typeof toVenues> = [];
          const geohash =
            rawGeohashFromSeedId(seed.id) ??
            (typeof seed.lat === "number" && typeof seed.lon === "number"
              ? encodeGeohash(seed.lat, seed.lon)
              : null);
          if (geohash) {
            venues = toVenues(
              await deps.qloo.getPlacesInGeohash(tasteIds, geohash, 24),
            );
          }
          if (!venues.length) {
            venues = toVenues(
              await deps.qloo.getPlacesInLocation(
                tasteIds,
                seed.locationQuery,
                30,
              ),
            );
          }

          // Prefer destination venues for compare — a single mall/landmark
          // entity yields almost no cultural tags vs a pocket of venues.
          const compareIds = [
            ...venues.slice(0, 6).map((v) => v.id),
            ...seed.entityIds.filter(isQlooEntityId),
          ].filter((id, i, arr) => id && arr.indexOf(id) === i);
          let matches: Tag[] = [];
          let mismatches: Tag[] = [];
          if (compareIds.length) {
            const cmp = await deps.qloo.compareEntities(tasteIds, compareIds);
            matches = cmp.shared.map((t) => ({
              id: t.id,
              name: t.name,
              score: t.score,
            }));
            mismatches = cmp.uniqueB.map((t) => ({
              id: t.id,
              name: t.name,
              score: t.score,
            }));
          }

          // Fold Qloo-resolved preference tags (never invent unresolved labels)
          for (const tag of resolvedPreferenceTags) {
            if (
              !matches.some(
                (m) =>
                  m.id === tag.id ||
                  m.name.toLowerCase() === tag.name.toLowerCase(),
              )
            ) {
              matches.push({ id: tag.id, name: tag.name, score: 0.55 });
            }
          }

          matches = filterUsefulTags(matches, 10);
          mismatches = filterUsefulTags(mismatches, 8);

          const shared = sharedTagScore(matches);
          const coverage = ritualCoverage(tasteIds.length, venues.length);
          const affinity = venues[0]?.affinity ?? shared;
          const rhyme = rhymeScore(affinity, shared, coverage);
          const distance = tasteDistance(rhyme);
          const score = pickScore(priority, rhyme, distance);
          const continuity = Math.round(rhyme * 100);
          const label =
            seed.label.startsWith("Area ") && venues[0]
              ? venues[0].address?.split(",").slice(-2).join(",").trim() ||
                venues[0].name
              : seed.label;

          const copy = templateDestination({
            label,
            continuity,
            matches,
            mismatches,
            venueNames: venues.map((v) => v.name),
            priority,
          });

          // Buffer for a second pass after Qloo tags reveal lodging/civic types.
          const topVenues = venues.slice(0, 14);
          const enrichedRaw: EvidenceEntity[] = await Promise.all(
            topVenues.map(async (venue) => {
              let venueShared: Tag[] = [];
              let venueOnly: Tag[] = [];
              try {
                const cmp = await deps.qloo.compareEntities(tasteIds, [
                  venue.id,
                ]);
                venueShared = filterUsefulTags(
                  cmp.shared.map((t) => ({
                    id: t.id,
                    name: t.name,
                    score: t.score,
                  })),
                  5,
                );
                venueOnly = filterUsefulTags(
                  cmp.uniqueB.map((t) => ({
                    id: t.id,
                    name: t.name,
                    score: t.score,
                  })),
                  4,
                );
              } catch (err) {
                deps.log.warn(
                  {
                    venue: venue.id,
                    err: err instanceof Error ? err.message : String(err),
                  },
                  "venue compare failed",
                );
              }
              return attachVenueEvidence({
                venue,
                venueSharedTags: venueShared,
                venueOnlyTags: venueOnly,
                areaMatchTags: matches,
              });
            }),
          );
          const enrichedVenues = enrichedRaw
            .filter((v) =>
              isRelocationRelevantVenue({
                name: v.name,
                type: v.type,
                tags: [...(v.evidenceTags ?? []), ...(v.distinctTags ?? [])],
              }),
            )
            .slice(0, 8);

          let lat = seed.lat;
          let lon = seed.lon;
          if (typeof lat !== "number" || typeof lon !== "number") {
            const gh = rawGeohashFromSeedId(seed.id);
            if (gh) {
              const center = decodeCenter(gh);
              lat = center.lat;
              lon = center.lon;
            }
          }
          if (typeof lat !== "number" || typeof lon !== "number") {
            const withCoords = venues.find(
              (v) => typeof v.lat === "number" && typeof v.lon === "number",
            );
            if (withCoords) {
              lat = withCoords.lat;
              lon = withCoords.lon;
            }
          }

          destinations.push({
            id: seed.id,
            label,
            locationQuery: seed.locationQuery,
            address: seed.address || seed.locationQuery,
            lat,
            lon,
            score,
            continuity,
            matches,
            mismatches,
            summary: copy.summary,
            expect: copy.expect,
            venues: enrichedVenues,
            evidenceEntityIds: enrichedVenues.map((v) => v.id),
          });
        } catch (err) {
          deps.log.warn(
            {
              seed: seed.id,
              err: err instanceof Error ? err.message : String(err),
            },
            "candidate score failed",
          );
        }
      }),
    );

    // Drop accidental duplicate ids (e.g. legacy shared geohash seeds).
    const byId = new Map<string, RankedDestination>();
    for (const d of destinations) {
      const prev = byId.get(d.id);
      if (!prev || d.score > prev.score) byId.set(d.id, d);
    }
    destinations.length = 0;
    destinations.push(...byId.values());
    destinations.sort((a, b) => b.score - a.score);
    if (destinations.length === 0) {
      throw new CarryError(
        "no_data",
        "No destinations could be scored for this move.",
      );
    }

    // Spread continuity away from the batch mean (±10) and apply priority bias.
    const adjusted = adjustContinuities(
      destinations.map((d) => d.continuity),
      priority,
    );
    for (let i = 0; i < destinations.length; i++) {
      destinations[i].continuity = adjusted[i];
      const copy = templateDestination({
        label: destinations[i].label,
        continuity: destinations[i].continuity,
        matches: destinations[i].matches,
        mismatches: destinations[i].mismatches,
        venueNames: destinations[i].venues.map((v) => v.name),
        priority,
      });
      destinations[i].summary = copy.summary;
      destinations[i].expect = copy.expect;
    }

    yield { type: "step", step: "score", status: "done" };

    yield { type: "step", step: "write", status: "start" };
    const residenceName = project.residence?.name ?? "your current home";
    const originNames = [
      ...(project.tastes.inferredFromResidence && project.residence
        ? [project.residence.name]
        : []),
      ...project.tastes.places.map((p) => p.name),
    ].slice(0, 6);

    for (const dest of destinations.slice(0, 5)) {
      if (deps.llm?.writeDestinationCopy) {
        try {
          const polished = await deps.llm.writeDestinationCopy({
            destination: dest.label,
            residenceName,
            priority: priorityMeta.priority,
            priorityLabel: priorityMeta.priorityLabel,
            briefFocus: priorityMeta.briefFocus,
            continuity: dest.continuity,
            originNames,
            matchTags: dest.matches.map((t) => t.name).slice(0, 8),
            mismatchTags: dest.mismatches.map((t) => t.name).slice(0, 8),
            venueNames: dest.venues.map((v) => v.name).slice(0, 8),
            venueAddresses: dest.venues.map((v) => v.address ?? "").slice(0, 8),
          });
          // Order explanations by what the user asked for (similar vs different).
          const ordered =
            priorityMeta.priority === "depart"
              ? [
                  polished.summary,
                  polished.mismatchExplanation,
                  polished.matchExplanation,
                ]
              : [
                  polished.summary,
                  polished.matchExplanation,
                  polished.mismatchExplanation,
                ];
          dest.summary = ordered.filter(Boolean).join(" ");
          dest.expect = polished.expect;
        } catch (err) {
          deps.log.warn(
            {
              dest: dest.id,
              err: err instanceof Error ? err.message : String(err),
            },
            "destination copy failed; keeping template",
          );
        }
      }
    }
    yield { type: "step", step: "write", status: "done" };

    const result: RankedMoveResult = {
      destinations,
      generatedAt: deps.now().toISOString(),
      priority: priorityMeta.priority,
      priorityLabel: priorityMeta.priorityLabel,
      provenance: {
        originEntityCount: tasteIds.length,
        resolvedPreferenceTags,
        surfaces: [
          "taste profile",
          "places/heatmap",
          "compare",
          "venues",
          ...(resolvedPreferenceTags.length ? ["tag search"] : []),
        ],
      },
    };

    const next: MoveProject = {
      ...project,
      status: "ready",
      result,
      errorMessage: null,
      updatedAt: deps.now().toISOString(),
    };

    // silence unused originTags in production path (used for future demog)
    void originTags;

    yield { type: "move", move: next };
  } catch (err) {
    if (err instanceof CarryError) {
      yield { type: "error", kind: err.kind, message: err.message };
      return;
    }
    deps.log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "move pipeline failed",
    );
    yield {
      type: "error",
      kind: "internal",
      message: "Something went wrong ranking destinations.",
    };
  }
}
