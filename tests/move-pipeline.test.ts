import { describe, expect, it } from "vitest";
import {
  pickClearTagMatch,
  runMovePipeline,
} from "../src/core/move-pipeline";
import type { Deps } from "../src/core/deps";
import type { MoveProject } from "../src/contracts";
import type { QlooClient } from "../src/server/qloo/endpoints";

function fakeQloo(overrides?: Partial<QlooClient>): QlooClient {
  return {
    searchPlaces: async () => [],
    searchTags: async (query) => {
      if (query.toLowerCase() === "indie") {
        return [{ id: "urn:tag:genre:place:indie", name: "Indie" }];
      }
      return [];
    },
    getTasteTags: async () => [
      { id: "tag:coffee", name: "specialty coffee", affinity: 0.8 },
    ],
    getHeatmap: async () => [
      {
        geohash: "c20g0pxxxx",
        affinity: 0.8,
        affinityRank: 0.7,
        popularity: 0.5,
      },
    ],
    getPlacesInGeohash: async () => [
      {
        entity_id: "v1",
        name: "Heart Coffee",
        properties: { address: "Pearl, Portland, OR" },
        query: { affinity: 0.9 },
      },
    ],
    getPlacesInLocation: async () => [
      {
        entity_id: "v1",
        name: "Heart Coffee",
        properties: { address: "Pearl, Portland, OR" },
        query: { affinity: 0.9 },
      },
      {
        entity_id: "v2",
        name: "Powell's Books",
        query: { affinity: 0.7 },
      },
    ],
    compareEntities: async () => ({
      shared: [{ id: "tag:coffee", name: "specialty coffee", score: 0.8 }],
      uniqueA: [],
      uniqueB: [{ id: "tag:rain", name: "rainy walks", score: 0.5 }],
    }),
    ...overrides,
  };
}

function deps(): Deps {
  return {
    qloo: fakeQloo(),
    llm: null,
    log: { info: () => {}, warn: () => {}, error: () => {} },
    now: () => new Date("2026-10-29T12:00:00Z"),
    id: () => "move-test",
  };
}

const base: MoveProject = {
  id: "m1",
  userId: "u1",
  residence: { id: "r1", name: "Park Slope" },
  target: {
    kind: "areas",
    places: [{ id: "d1", name: "Portland, OR" }],
  },
  tastes: {
    places: [{ id: "t1", name: "Blue Bottle" }],
    tags: ["indie"],
    priorities: ["balanced"],
    inferredFromResidence: true,
  },
  status: "draft",
  result: null,
  errorMessage: null,
  createdAt: "2026-10-29T12:00:00Z",
  updatedAt: "2026-10-29T12:00:00Z",
};

describe("runMovePipeline", () => {
  it("ranks destinations for area targets", async () => {
    const events = [];
    for await (const e of runMovePipeline(base, deps())) events.push(e);
    const moveEvent = events.find((e) => e.type === "move");
    expect(moveEvent?.type).toBe("move");
    if (moveEvent?.type === "move") {
      expect(moveEvent.move.result?.destinations.length).toBeGreaterThan(0);
      expect(moveEvent.move.status).toBe("ready");
      expect(moveEvent.move.result?.priority).toBe("balanced");
      expect(moveEvent.move.result?.priorityLabel).toBe("Balanced");
      const top = moveEvent.move.result!.destinations[0];
      expect(top.matches.length).toBeGreaterThan(0);
      expect(top.summary.length).toBeGreaterThan(10);
    }
  });

  it("expands ambiguous regions", async () => {
    const project: MoveProject = {
      ...base,
      target: { kind: "ambiguous", region: "Oregon, USA" },
    };
    const events = [];
    for await (const e of runMovePipeline(project, deps())) events.push(e);
    expect(events.some((e) => e.type === "move")).toBe(true);
  });

  it("folds resolved preference tags into matches and provenance", async () => {
    const events = [];
    for await (const e of runMovePipeline(base, deps())) events.push(e);
    const moveEvent = events.find((e) => e.type === "move");
    expect(moveEvent?.type).toBe("move");
    if (moveEvent?.type !== "move") return;
    const result = moveEvent.move.result!;
    expect(result.provenance?.originEntityCount).toBeGreaterThan(0);
    expect(result.provenance?.resolvedPreferenceTags).toEqual([
      { id: "urn:tag:genre:place:indie", name: "Indie" },
    ]);
    expect(result.provenance?.surfaces).toContain("tag search");
    const top = result.destinations[0];
    expect(
      top.matches.some((m) => m.id === "urn:tag:genre:place:indie"),
    ).toBe(true);
  });

  it("biases continuity higher for Keep Similar and lower for Change", async () => {
    async function continuityFor(
      priority: "rhyme" | "depart" | "balanced",
    ): Promise<number> {
      const project: MoveProject = {
        ...base,
        tastes: { ...base.tastes!, priorities: [priority] },
      };
      const events = [];
      for await (const e of runMovePipeline(project, deps())) events.push(e);
      const moveEvent = events.find((e) => e.type === "move");
      expect(moveEvent?.type).toBe("move");
      if (moveEvent?.type !== "move") throw new Error("expected move");
      return moveEvent.move.result!.destinations[0].continuity;
    }

    const balanced = await continuityFor("balanced");
    const rhyme = await continuityFor("rhyme");
    const depart = await continuityFor("depart");
    expect(rhyme).toBe(balanced + 10);
    expect(depart).toBe(balanced - 10);
  });

  it("skips unresolved preference tags", async () => {
    const project: MoveProject = {
      ...base,
      tastes: {
        ...base.tastes!,
        tags: ["zzzznotarealtag"],
      },
    };
    const d = deps();
    d.qloo = fakeQloo({ searchTags: async () => [] });
    const events = [];
    for await (const e of runMovePipeline(project, d)) events.push(e);
    const moveEvent = events.find((e) => e.type === "move");
    expect(moveEvent?.type).toBe("move");
    if (moveEvent?.type !== "move") return;
    expect(moveEvent.move.result?.provenance?.resolvedPreferenceTags).toEqual(
      [],
    );
    const top = moveEvent.move.result!.destinations[0];
    expect(top.matches.some((m) => m.id.startsWith("user:"))).toBe(false);
    expect(
      top.matches.some((m) => m.name.toLowerCase() === "zzzznotarealtag"),
    ).toBe(false);
  });
});

describe("pickClearTagMatch", () => {
  it("accepts exact and substring names only", () => {
    expect(
      pickClearTagMatch("indie", [
        { id: "a", name: "Indie" },
        { id: "b", name: "Indie Bookstore" },
      ]),
    ).toEqual({ id: "a", name: "Indie" });
    expect(
      pickClearTagMatch("indie", [{ id: "b", name: "Indie Bookstore" }]),
    ).toEqual({ id: "b", name: "Indie Bookstore" });
    expect(
      pickClearTagMatch("indie", [{ id: "c", name: "Live Music" }]),
    ).toBeNull();
  });
});
