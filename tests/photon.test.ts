import { describe, expect, it } from "vitest";
import {
  formatPhotonAddress,
  isPhotonPlaceId,
  isQlooEntityId,
} from "../src/server/photon";
import { haversineKm } from "../src/core/geohash";

describe("photon helpers", () => {
  it("detects photon vs qloo ids", () => {
    expect(isPhotonPlaceId("photon:N:123")).toBe(true);
    expect(isQlooEntityId("photon:N:123")).toBe(false);
    expect(
      isQlooEntityId("A9E80F62-A5A1-4B2C-9D3E-1234567890AB"),
    ).toBe(true);
    expect(isQlooEntityId("geo:dr5ru7")).toBe(false);
    expect(isQlooEntityId("r1")).toBe(true);
  });

  it("formats street addresses", () => {
    expect(
      formatPhotonAddress({
        housenumber: "347",
        street: "5th Avenue",
        city: "Brooklyn",
        state: "New York",
        postcode: "11215",
        country: "United States",
      }),
    ).toBe("347 5th Avenue, Brooklyn, New York, 11215, United States");
  });
});

describe("haversineKm", () => {
  it("puts Paris far outside Washington state", () => {
    const wa = { lat: 47.29, lon: -120.21 };
    const paris = { lat: 48.87, lon: 2.78 };
    expect(haversineKm(wa, paris)).toBeGreaterThan(7000);
  });
});
