/**
 * Go/no-go spike against the live Qloo hackathon API.
 * Prints counts and field names only — never dumps full Qloo payloads to disk.
 *
 * Usage: npx tsx --env-file=.env scripts/spike.ts
 */
import { searchPlaces, getTasteTags, getHeatmap, getPlacesInGeohash, getPlacesInLocation, compareEntities } from "../src/server/qloo/endpoints";
import { entityId } from "../src/server/qloo/schemas";

const ROUTES = [
  {
    name: "Brooklyn → Portland",
    seeds: ["Blue Bottle Coffee Brooklyn", "Brooklyn Bowl", "Marlow & Sons"],
    destination: "Portland, OR",
  },
  {
    name: "Austin → Denver",
    seeds: ["Franklin Barbecue", "Hotel Vegas Austin", "BookPeople"],
    destination: "Denver, CO",
  },
  {
    name: "London → Berlin",
    seeds: ["Dishoom Covent Garden", "Rough Trade East", "Borough Market"],
    destination: "Berlin, Germany",
  },
];

async function runRoute(route: (typeof ROUTES)[number]) {
  console.log(`\n=== ${route.name} ===`);
  const ids: string[] = [];
  for (const seed of route.seeds) {
    const hits = await searchPlaces(seed, 3);
    console.log(`search "${seed}": ${hits.length} hits`, hits[0] ? `{id,name,type}` : "");
    if (hits[0]) ids.push(hits[0].id);
  }
  if (ids.length < 2) {
    console.log("SKIP: not enough resolved entities");
    return { name: route.name, ok: false };
  }

  const tags = await getTasteTags(ids);
  console.log(`tags: ${tags.length}`, tags[0] ? "fields: id,name,affinity" : "");

  let heat: Awaited<ReturnType<typeof getHeatmap>> = [];
  try {
    heat = await getHeatmap(ids, route.destination);
    console.log(
      `heatmap: ${heat.length}`,
      heat[0] ? `fields: ${Object.keys(heat[0]).join(",")}` : "",
    );
  } catch (e) {
    console.log(`heatmap ERROR: ${e instanceof Error ? e.message : e}`);
  }

  let venueCount = 0;
  if (heat[0]) {
    const places = await getPlacesInGeohash(ids, heat[0].geohash, 8);
    venueCount = places.length;
    console.log(
      `places@geohash: ${places.length}`,
      places[0] ? `id=${Boolean(entityId(places[0]))} name=${Boolean(places[0].name)}` : "",
    );
  } else {
    const places = await getPlacesInLocation(ids, route.destination, 20);
    venueCount = places.length;
    console.log(`places@location fallback: ${places.length}`);
  }

  if (venueCount > 0) {
    const places = heat[0]
      ? await getPlacesInGeohash(ids, heat[0].geohash, 5)
      : await getPlacesInLocation(ids, route.destination, 5);
    const bIds = places
      .map((p) => entityId(p))
      .filter((x): x is string => Boolean(x))
      .slice(0, 4);
    if (bIds.length) {
      const cmp = await compareEntities(ids, bIds);
      console.log(
        `compare: shared=${cmp.shared.length} uniqueA=${cmp.uniqueA.length} uniqueB=${cmp.uniqueB.length}`,
      );
    }
  }

  const ok = ids.length >= 2 && (heat.length > 0 || venueCount > 0);
  console.log(ok ? "PASS" : "FAIL");
  return { name: route.name, ok, heat: heat.length, venues: venueCount };
}

async function main() {
  if (!process.env.QLOO_API_KEY) {
    console.error("Set QLOO_API_KEY (and optional QLOO_BASE_URL) in .env");
    process.exit(1);
  }
  const results = [];
  for (const route of ROUTES) {
    try {
      results.push(await runRoute(route));
    } catch (e) {
      console.log(`ROUTE ERROR: ${e instanceof Error ? e.message : e}`);
      results.push({ name: route.name, ok: false });
    }
  }
  console.log("\n--- summary ---");
  for (const r of results) console.log(r);
  const pass = results.filter((r) => r.ok).length;
  console.log(`${pass}/${results.length} routes usable`);
  process.exit(pass > 0 ? 0 : 2);
}

main();
