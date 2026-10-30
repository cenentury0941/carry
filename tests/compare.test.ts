import { describe, expect, it } from "vitest";
import { parseCompareResponse } from "../src/server/qloo/endpoints";

describe("parseCompareResponse", () => {
  it("parses hackathon shape: tags + a + b with tag_id", () => {
    const result = parseCompareResponse({
      results: {
        tags: [
          {
            tag_id: "urn:tag:genre:place",
            name: "Place",
            query: { score: 0.9 },
          },
          {
            tag_id: "urn:tag:category:place:tourist_attraction",
            name: "Tourist Attraction",
            query: { score: 0.73 },
          },
          {
            tag_id: "urn:tag:genre:place:performing_arts_theater",
            name: "Performing Arts Theater",
            query: { score: 0.7 },
          },
        ],
        a: [
          {
            tag_id: "urn:tag:genre:place",
            name: "Place",
            query: { count: "5" },
          },
          {
            tag_id: "urn:tag:inclusivity:place:lgbtq_friendly",
            name: "LGBTQ+ friendly",
            query: { count: "3" },
          },
          {
            tag_id: "urn:tag:category:place:hotel",
            name: "Hotel",
            query: { count: "1" },
          },
        ],
        b: [
          {
            tag_id: "urn:tag:genre:place:performing_arts_theater",
            name: "Performing Arts Theater",
            query: { count: "2" },
          },
          {
            tag_id: "urn:tag:category:place:museum",
            name: "Museum",
            query: { count: "2" },
          },
          {
            tag_id: "urn:tag:category:place:historical_place",
            name: "Historical Place",
            query: { count: "1" },
          },
        ],
      },
    });

    expect(result.shared.map((t) => t.name)).toEqual([
      "Tourist Attraction",
      "Performing Arts Theater",
    ]);
    expect(result.uniqueA.map((t) => t.name)).toContain("LGBTQ+ friendly");
    expect(result.uniqueA.map((t) => t.name)).toContain("Hotel");
    expect(result.uniqueB.map((t) => t.name)).toContain("Museum");
    expect(result.uniqueB.map((t) => t.name)).toContain("Historical Place");
    // Shared tags should not also appear as mismatches
    expect(result.uniqueB.map((t) => t.name)).not.toContain(
      "Performing Arts Theater",
    );
  });

  it("still supports legacy a_affinity / b_affinity tags", () => {
    const result = parseCompareResponse({
      results: {
        tags: [
          {
            id: "tag:indie",
            name: "indie coffee",
            query: { a_affinity: 0.8, b_affinity: 0.7 },
          },
          {
            id: "tag:sports",
            name: "sports bars",
            query: { a_affinity: 0.05, b_affinity: 0.9 },
          },
        ],
      },
    });
    expect(result.shared[0]?.name).toBe("indie coffee");
    expect(result.uniqueB[0]?.name).toBe("sports bars");
  });
});
