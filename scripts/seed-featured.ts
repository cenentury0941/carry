/**
 * Build and store two featured briefs, then register their ids.
 * Usage: npx tsx --env-file=.env scripts/seed-featured.ts
 */
import { nanoid } from "nanoid";
import { runPipeline } from "../src/core/pipeline";
import type { Deps } from "../src/core/deps";
import { liveQloo } from "../src/server/qloo/endpoints";
import { createOpenAIWriter } from "../src/server/llm/openai";
import { saveBrief, setFeaturedIds } from "../src/server/store";
import { searchPlaces } from "../src/server/qloo/endpoints";
import type { BriefInput } from "../src/contracts";

async function resolveSeeds(queries: string[]) {
  const origin = [];
  for (const q of queries) {
    const hits = await searchPlaces(q, 3);
    if (hits[0]) origin.push({ id: hits[0].id, name: hits[0].name });
  }
  return origin;
}

function deps(): Deps {
  return {
    qloo: liveQloo,
    llm: createOpenAIWriter(),
    log: {
      info: (o, m) => console.log(m, o),
      warn: (o, m) => console.warn(m, o),
      error: (o, m) => console.error(m, o),
    },
    now: () => new Date(),
    id: () => nanoid(10),
  };
}

async function build(input: BriefInput) {
  for await (const event of runPipeline(input, deps())) {
    if (event.type === "brief") {
      await saveBrief(event.brief);
      console.log("saved", event.brief.id, event.brief.copy.headline);
      return event.brief.id;
    }
    if (event.type === "error") {
      throw new Error(`${event.kind}: ${event.message}`);
    }
  }
  throw new Error("no brief");
}

async function main() {
  const aOrigin = await resolveSeeds([
    "Blue Bottle Coffee Brooklyn",
    "Brooklyn Bowl",
    "Marlow & Sons",
  ]);
  const bOrigin = await resolveSeeds([
    "Franklin Barbecue",
    "Hotel Vegas Austin",
    "BookPeople Austin",
  ]);

  if (aOrigin.length < 3 || bOrigin.length < 3) {
    console.error("Could not resolve enough seed places", { aOrigin, bOrigin });
    process.exit(1);
  }

  const id1 = await build({
    origin: aOrigin.slice(0, 3),
    destination: "Portland, OR",
    mode: "rhyme",
  });
  const id2 = await build({
    origin: bOrigin.slice(0, 3),
    destination: "Denver, CO",
    mode: "depart",
  });

  await setFeaturedIds([id1, id2]);
  console.log("featured:", [id1, id2]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
