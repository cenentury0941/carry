import { describe, expect, it } from "vitest";
import {
  healMoveDestinationIds,
  uniquifyDestinations,
} from "../src/core/unique-destinations";
import type { MoveProject, RankedDestination } from "../src/contracts";

function dest(id: string, label: string): RankedDestination {
  return {
    id,
    label,
    locationQuery: label,
    score: 0.5,
    continuity: 50,
    matches: [],
    mismatches: [],
    summary: "s",
    expect: ["a", "b"],
    venues: [],
    evidenceEntityIds: [],
  };
}

describe("uniquifyDestinations", () => {
  it("suffixes duplicate geo ids", () => {
    const out = uniquifyDestinations([
      dest("geo:dr4e6k", "1416 Frankford"),
      dest("geo:dr4e6k", "1301 Frankford"),
      dest("photon:N:1", "Chicago"),
    ]);
    expect(out.map((d) => d.id)).toEqual([
      "geo:dr4e6k",
      "geo:dr4e6k~1",
      "photon:N:1",
    ]);
  });

  it("heals move results in place", () => {
    const move = {
      id: "m1",
      userId: "u1",
      residence: null,
      target: null,
      tastes: null,
      status: "ready",
      result: {
        destinations: [
          dest("geo:dr4e6k", "A"),
          dest("geo:dr4e6k", "B"),
        ],
        generatedAt: "2026-01-01T00:00:00Z",
      },
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    } as MoveProject;
    const healed = healMoveDestinationIds(move);
    expect(healed.result?.destinations.map((d) => d.id)).toEqual([
      "geo:dr4e6k",
      "geo:dr4e6k~1",
    ]);
  });
});
