import type { Brief, BriefInput, StreamEvent } from "@/contracts";
import type { Deps } from "./deps";
import { CarryError } from "./deps";
import { profileOrigin } from "./steps/profile";
import { findCandidates } from "./steps/candidates";
import { gatherEvidence } from "./steps/evidence";
import { compareAreas } from "./steps/compare";
import {
  continuityFromRhyme,
  pickDepartArea,
  pickRhymeAreas,
  scoreAreas,
} from "./scoring";
import { writeBrief } from "./steps/write";

export async function* runPipeline(
  input: BriefInput,
  deps: Deps,
): AsyncGenerator<StreamEvent> {
  try {
    yield { type: "step", step: "profile", status: "start" };
    const profile = await profileOrigin(input, deps);
    yield { type: "step", step: "profile", status: "done" };

    yield { type: "step", step: "candidates", status: "start" };
    const { heat } = await findCandidates(input, profile.entityIds, deps);
    yield { type: "step", step: "candidates", status: "done" };

    yield { type: "step", step: "evidence", status: "start" };
    const evidence = await gatherEvidence(
      profile.entityIds,
      heat,
      input.destination,
      deps,
    );
    yield { type: "step", step: "evidence", status: "done" };

    yield { type: "step", step: "compare", status: "start" };
    const compares = await compareAreas(profile.entityIds, evidence, deps);
    yield { type: "step", step: "compare", status: "done" };

    yield { type: "step", step: "score", status: "start" };
    const byGeohash = new Map(
      evidence.map((e) => {
        const cmp = compares.find((c) => c.geohash === e.geohash);
        return [
          e.geohash,
          {
            venues: e.venues,
            sharedTags: cmp?.sharedTags ?? [],
            changedTags: cmp?.changedTags ?? [],
          },
        ] as const;
      }),
    );
    const scored = scoreAreas(heat, byGeohash, input.origin.length);
    const rhyme = pickRhymeAreas(scored, 3);
    const depart = pickDepartArea(scored);
    const continuity = continuityFromRhyme(rhyme);

    if (rhyme.length === 0 && !depart) {
      throw new CarryError(
        "no_data",
        `No matching areas found in ${input.destination} for those places.`,
      );
    }
    yield { type: "step", step: "score", status: "done" };

    yield { type: "step", step: "write", status: "start" };
    const { copy, firstWeek } = await writeBrief(
      input,
      continuity,
      rhyme,
      depart,
      deps,
    );
    yield { type: "step", step: "write", status: "done" };

    const brief: Brief = {
      id: deps.id(),
      version: 1,
      input,
      continuity,
      rhyme,
      depart,
      firstWeek,
      copy,
      createdAt: deps.now().toISOString(),
    };

    yield { type: "brief", brief };
  } catch (err) {
    if (err instanceof CarryError) {
      yield { type: "error", kind: err.kind, message: err.message };
      return;
    }
    deps.log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "pipeline failed",
    );
    yield {
      type: "error",
      kind: "internal",
      message: "Something went wrong building the brief.",
    };
  }
}
