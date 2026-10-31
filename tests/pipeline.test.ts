import { describe, expect, it } from "vitest";
import { runPipeline } from "../src/core/pipeline";
import type { Deps } from "../src/core/deps";
import type { QlooClient } from "../src/server/qloo/endpoints";
import type { BriefInput } from "../src/contracts";

function fakeQloo(): QlooClient {
  return {
    searchPlaces: async () => [],
    searchTags: async () => [],
    getTasteTags: async () => [
      { id: "tag:indie", name: "indie coffee", affinity: 0.8 },
      { id: "tag:live", name: "live music", affinity: 0.6 },
    ],
    getHeatmap: async () => [
      {
        geohash: "c20g0pxxxx",
        affinity: 0.85,
        affinityRank: 0.8,
        popularity: 0.5,
      },
      {
        geohash: "c20g1qyyyy",
        affinity: 0.2,
        affinityRank: 0.15,
        popularity: 0.9,
      },
    ],
    getPlacesInGeohash: async (_ids, geohash) => {
      if (geohash.startsWith("c20g0p")) {
        return [
          {
            entity_id: "p1",
            name: "Heart Coffee",
            type: "urn:entity:place",
            properties: { address: "Pearl District, Portland, OR" },
            query: { affinity: 0.9 },
          },
          {
            entity_id: "p2",
            name: "Mississippi Studios",
            properties: { address: "Boise, Portland, OR" },
            query: { affinity: 0.7 },
          },
        ];
      }
      return [
        { entity_id: "p3", name: "Sports Bar", query: { affinity: 0.3 } },
        { entity_id: "p4", name: "Stadium Grill", query: { affinity: 0.2 } },
        { entity_id: "p5", name: "Arena Cafe", query: { affinity: 0.2 } },
      ];
    },
    getPlacesInLocation: async () => [],
    compareEntities: async () => ({
      shared: [{ id: "tag:indie", name: "indie coffee", score: 0.7 }],
      uniqueA: [],
      uniqueB: [{ id: "tag:sports", name: "sports bars", score: 0.6 }],
    }),
  };
}

function deps(): Deps {
  return {
    qloo: fakeQloo(),
    llm: null,
    geocodeRegion: async () => null,
    log: { info: () => {}, warn: () => {}, error: () => {} },
    now: () => new Date("2026-10-28T12:00:00Z"),
    id: () => "testid1234",
  };
}

const input: BriefInput = {
  origin: [
    { id: "o1", name: "Blue Bottle" },
    { id: "o2", name: "Brooklyn Bowl" },
    { id: "o3", name: "Marlow & Sons" },
  ],
  destination: "Portland, OR",
  mode: "rhyme",
};

describe("pipeline", () => {
  it("emits step events then a brief", async () => {
    const events = [];
    for await (const e of runPipeline(input, deps())) {
      events.push(e);
    }
    const steps = events.filter((e) => e.type === "step");
    expect(steps.length).toBeGreaterThanOrEqual(10);
    const briefEvent = events.find((e) => e.type === "brief");
    expect(briefEvent?.type).toBe("brief");
    if (briefEvent?.type === "brief") {
      expect(briefEvent.brief.id).toBe("testid1234");
      expect(briefEvent.brief.rhyme.length).toBeGreaterThan(0);
      expect(briefEvent.brief.copy.headline).toContain("Portland");
      expect(briefEvent.brief.firstWeek.length).toBe(3);
    }
  });

  it("falls back to template without llm", async () => {
    const events = [];
    for await (const e of runPipeline(input, deps())) events.push(e);
    const brief = events.find((e) => e.type === "brief");
    expect(brief?.type).toBe("brief");
    if (brief?.type === "brief") {
      expect(brief.brief.copy.summary).toContain("cultural fit score");
    }
  });
});
