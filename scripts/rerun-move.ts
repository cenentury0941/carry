import { getMove, saveMove } from "../src/server/move-store";
import { createDeps } from "../src/server/deps";
import { runMovePipeline } from "../src/core/move-pipeline";

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error("Usage: tsx --env-file=.env scripts/rerun-move.ts <moveId>");
    process.exit(1);
  }
  const move = await getMove(id);
  if (!move) {
    console.error("move not found");
    process.exit(1);
  }
  const deps = createDeps("rerun");
  for await (const e of runMovePipeline(move, deps)) {
    if (e.type === "step") console.log(e.step, e.status);
    if (e.type === "error") {
      console.error(e);
      process.exit(1);
    }
    if (e.type === "move") {
      await saveMove(e.move);
      for (const d of e.move.result?.destinations ?? []) {
        console.log("---", d.label);
        console.log(
          "matches:",
          d.matches.map((t) => t.name).join(", ") || "(none)",
        );
        console.log(
          "mismatches:",
          d.mismatches.map((t) => t.name).join(", ") || "(none)",
        );
      }
      console.log("saved");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
