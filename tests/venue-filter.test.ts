import { describe, expect, it } from "vitest";
import {
  filterRelocationVenues,
  isRelocationRelevantVenue,
} from "../src/core/venue-filter";

describe("isRelocationRelevantVenue", () => {
  it("keeps everyday ritual places", () => {
    expect(
      isRelocationRelevantVenue({ name: "Heart Coffee" }),
    ).toBe(true);
    expect(
      isRelocationRelevantVenue({ name: "Golden Gate Park" }),
    ).toBe(true);
    expect(
      isRelocationRelevantVenue({ name: "The Curran Theatre" }),
    ).toBe(true);
    expect(
      isRelocationRelevantVenue({ name: "David Barton Gym" }),
    ).toBe(true);
  });

  it("drops lodging", () => {
    expect(
      isRelocationRelevantVenue({ name: "Ocean View Hotel" }),
    ).toBe(false);
    expect(
      isRelocationRelevantVenue({ name: "Hyatt Centric Fisherman's Wharf" }),
    ).toBe(false);
    expect(
      isRelocationRelevantVenue({ name: "Marriott Marquis" }),
    ).toBe(false);
  });

  it("drops factories and government buildings", () => {
    expect(
      isRelocationRelevantVenue({ name: "Acme Widget Factory" }),
    ).toBe(false);
    expect(
      isRelocationRelevantVenue({ name: "San Francisco City Hall" }),
    ).toBe(false);
    expect(
      isRelocationRelevantVenue({ name: "County Courthouse" }),
    ).toBe(false);
    expect(
      isRelocationRelevantVenue({ name: "Central Police Station" }),
    ).toBe(false);
  });

  it("drops by type/tag metadata", () => {
    expect(
      isRelocationRelevantVenue({
        name: "The Grand",
        type: "urn:entity:place:hotel",
      }),
    ).toBe(false);
    expect(
      isRelocationRelevantVenue({
        name: "Harbor View",
        tags: ["Hotel", "Four Star"],
      }),
    ).toBe(false);
  });
});

describe("filterRelocationVenues", () => {
  it("preserves order and limit", () => {
    const filtered = filterRelocationVenues(
      [
        { name: "Cafe A" },
        { name: "Hilton Downtown" },
        { name: "Park B" },
        { name: "City Hall" },
        { name: "Bookstore C" },
      ],
      2,
    );
    expect(filtered.map((v) => v.name)).toEqual(["Cafe A", "Park B"]);
  });
});
