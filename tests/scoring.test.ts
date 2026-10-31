import { describe, expect, it } from "vitest";
import {
  adjustContinuities,
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

  it("spreads continuity away from the mean by up to ±10", () => {
    // mean 80; maxAbsDeviation 10 → extremes ±10, mid unchanged before bias
    // high extreme 100 clamps to 98
    const balanced = adjustContinuities([70, 80, 90], "balanced");
    expect(balanced).toEqual([60, 80, 98]);
  });

  it("skips mean-spread for a single destination", () => {
    expect(adjustContinuities([72], "balanced")).toEqual([72]);
    expect(adjustContinuities([72], "rhyme")).toEqual([82]);
    expect(adjustContinuities([72], "depart")).toEqual([62]);
  });

  it("applies Keep Similar / Change priority bias after spread", () => {
    const rhyme = adjustContinuities([70, 80, 90], "rhyme");
    const depart = adjustContinuities([70, 80, 90], "depart");
    // balanced extremes 60/98 → rhyme +10 → 70/98 (clamped); mid 90
    expect(rhyme[0]).toBe(70);
    expect(rhyme[1]).toBe(90);
    expect(rhyme[2]).toBe(98);
    // depart −10 → 50/70/90
    expect(depart[0]).toBe(50);
    expect(depart[1]).toBe(70);
    expect(depart[2]).toBe(90);
    // Keep Similar reads higher than Change for the same raw inputs
    expect(rhyme.every((v, i) => v >= depart[i])).toBe(true);
  });

  it("clamps adjusted continuity to 0–98", () => {
    expect(adjustContinuities([5, 95], "rhyme")).toEqual([5, 98]);
    expect(adjustContinuities([5, 95], "depart")).toEqual([0, 95]);
    expect(adjustContinuities([100], "balanced")).toEqual([98]);
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
