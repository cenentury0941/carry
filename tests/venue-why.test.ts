import { describe, expect, it } from "vitest";
import { attachVenueEvidence } from "../src/core/venue-why";

describe("attachVenueEvidence", () => {
  it("stores Qloo tags without a narrative why", () => {
    const result = attachVenueEvidence({
      venue: {
        id: "v1",
        name: "Heart Coffee",
        address: "Portland, OR",
        affinity: 0.86,
      },
      venueSharedTags: [
        { id: "t1", name: "Coffee" },
        { id: "t2", name: "Casual" },
      ],
      venueOnlyTags: [{ id: "t3", name: "Baking" }],
      areaMatchTags: [{ id: "t4", name: "Tourist Attraction" }],
    });

    expect(result.why).toBeUndefined();
    expect(result.evidenceTags).toEqual(["Coffee", "Casual"]);
    expect(result.distinctTags).toEqual(["Baking"]);
  });

  it("falls back to area match tags when venue compare shared is empty", () => {
    const result = attachVenueEvidence({
      venue: { id: "v2", name: "Alcatraz", affinity: 0.7 },
      venueSharedTags: [],
      venueOnlyTags: [],
      areaMatchTags: [{ id: "t1", name: "Tourist Attraction" }],
    });
    expect(result.evidenceTags).toEqual(["Tourist Attraction"]);
  });
});
