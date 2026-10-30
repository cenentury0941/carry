import { describe, expect, it } from "vitest";
import {
  continuityFromRhyme,
  departScore,
  pickDepartArea,
  pickRhymeAreas,
  rhymeScore,
  ritualCoverage,
  scoreAreas,
  sharedTagScore,
  tasteDistance,
} from "../src/core/scoring";
import { groupHeatPoints } from "../src/core/geohash";

describe("scoring", () => {
  it("computes rhyme score weights", () => {
    expect(rhymeScore(1, 1, 1)).toBeCloseTo(1);
    expect(rhymeScore(0, 0, 0)).toBe(0);
    expect(rhymeScore(1, 0, 0)).toBeCloseTo(0.5);
  });

  it("computes depart score as popularity * (1 - affinity_rank)", () => {
    expect(departScore(0.8, 0.2)).toBeCloseTo(0.64);
    expect(departScore(1, 1)).toBe(0);
  });

  it("computes taste distance as reverse similarity", () => {
    expect(tasteDistance(1)).toBe(0);
    expect(tasteDistance(0)).toBe(1);
    expect(tasteDistance(0.7)).toBeCloseTo(0.3);
  });

  it("scores ritual coverage", () => {
    expect(ritualCoverage(3, 3)).toBe(1);
    expect(ritualCoverage(3, 0)).toBe(0);
  });

  it("averages shared tag scores", () => {
    expect(sharedTagScore([{ id: "1", name: "a", score: 0.8 }])).toBeCloseTo(0.8);
    expect(sharedTagScore([])).toBe(0);
  });

  it("groups heat points by geohash prefix", () => {
    const grouped = groupHeatPoints([
      { geohash: "9q8yy1abc", affinity: 0.8, affinityRank: 0.7, popularity: 0.5 },
      { geohash: "9q8yy1xyz", affinity: 0.4, affinityRank: 0.3, popularity: 0.9 },
      { geohash: "9q8zz9999", affinity: 0.2, affinityRank: 0.1, popularity: 0.2 },
    ]);
    expect(grouped).toHaveLength(2);
    const a = grouped.find((g) => g.geohash === "9q8yy1");
    expect(a?.count).toBe(2);
    expect(a?.affinity).toBeCloseTo(0.6);
  });

  it("picks rhyme and depart areas", () => {
    const heat = [
      { geohash: "aaaaaa", affinity: 0.9, affinityRank: 0.9, popularity: 0.4, count: 2 },
      { geohash: "bbbbbb", affinity: 0.2, affinityRank: 0.1, popularity: 0.9, count: 2 },
    ];
    const byGeohash = new Map([
      [
        "aaaaaa",
        {
          venues: [
            { id: "1", name: "Cafe A", address: "Pearl District, Portland, OR" },
            { id: "2", name: "Bar A" },
          ],
          sharedTags: [{ id: "t1", name: "indie", score: 0.7 }],
          changedTags: [],
        },
      ],
      [
        "bbbbbb",
        {
          venues: [
            { id: "3", name: "Cafe B" },
            { id: "4", name: "Bar B" },
            { id: "5", name: "Shop B" },
          ],
          sharedTags: [],
          changedTags: [{ id: "t2", name: "sports", score: 0.6 }],
        },
      ],
    ]);
    const scored = scoreAreas(heat, byGeohash, 3);
    const rhyme = pickRhymeAreas(scored, 2);
    expect(rhyme[0].geohash).toBe("aaaaaa");
    expect(rhyme[0].label).toContain("Portland");
    const depart = pickDepartArea(scored);
    expect(depart?.geohash).toBe("bbbbbb");
    expect(continuityFromRhyme(rhyme)).toBeGreaterThan(0);
  });
});
