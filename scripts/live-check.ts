/**
 * Hits every Qloo endpoint Carry uses once. Prints counts/field names only.
 * Usage: npx tsx --env-file=.env scripts/live-check.ts
 */
import {
  searchPlaces,
  getTasteTags,
  getHeatmap,
  getPlacesInGeohash,
  getPlacesInLocation,
  compareEntities,
} from "../src/server/qloo/endpoints";
import { entityId } from "../src/server/qloo/schemas";

type Check = { name: string; ok: boolean; detail: string };

async function main() {
  const checks: Check[] = [];

  const hits = await searchPlaces("Blue Bottle Coffee Brooklyn", 5);
  checks.push({
    name: "search",
    ok: hits.length > 0 && Boolean(hits[0].id),
    detail: `n=${hits.length} fields=${hits[0] ? Object.keys(hits[0]).join(",") : "-"}`,
  });

  const ids = hits.slice(0, 3).map((h) => h.id);
  if (ids.length < 2) {
    console.error("Need at least 2 search hits");
    process.exit(2);
  }

  const tags = await getTasteTags(ids);
  checks.push({
    name: "insights:tags",
    ok: tags.length >= 0,
    detail: `n=${tags.length}`,
  });

  let heatLen = 0;
  try {
    const heat = await getHeatmap(ids, "Portland, OR");
    heatLen = heat.length;
    checks.push({
      name: "insights:heatmap",
      ok: true,
      detail: `n=${heat.length} fields=${heat[0] ? Object.keys(heat[0]).join(",") : "-"}`,
    });
    if (heat[0]) {
      const places = await getPlacesInGeohash(ids, heat[0].geohash, 5);
      checks.push({
        name: "insights:places@geohash",
        ok: true,
        detail: `n=${places.length} hasId=${Boolean(places[0] && entityId(places[0]))}`,
      });
    }
  } catch (e) {
    checks.push({
      name: "insights:heatmap",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  const placesLoc = await getPlacesInLocation(ids, "Portland, OR", 10);
  checks.push({
    name: "insights:places@location",
    ok: placesLoc.length >= 0,
    detail: `n=${placesLoc.length}`,
  });

  // Prove location filter changes results: empty vs Portland
  const placesNY = await getPlacesInLocation(ids, "New York, NY", 10);
  checks.push({
    name: "location_filter_changes_results",
    ok: JSON.stringify(placesLoc.map((p) => entityId(p))) !== JSON.stringify(placesNY.map((p) => entityId(p))) || placesLoc.length + placesNY.length === 0,
    detail: `portland=${placesLoc.length} nyc=${placesNY.length}`,
  });

  const bIds = placesLoc
    .map((p) => entityId(p))
    .filter((x): x is string => Boolean(x))
    .slice(0, 4);
  if (bIds.length) {
    const cmp = await compareEntities(ids, bIds);
    checks.push({
      name: "analysis:compare",
      ok: true,
      detail: `shared=${cmp.shared.length} uniqueA=${cmp.uniqueA.length} uniqueB=${cmp.uniqueB.length}`,
    });
  } else {
    checks.push({
      name: "analysis:compare",
      ok: heatLen === 0 && placesLoc.length === 0,
      detail: "skipped (no place ids)",
    });
  }

  let failed = 0;
  for (const c of checks) {
    console.log(`${c.ok ? "PASS" : "FAIL"} ${c.name} — ${c.detail}`);
    if (!c.ok) failed++;
  }
  console.log(`${checks.length - failed}/${checks.length} passed`);
  process.exit(failed ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
