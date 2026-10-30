import { describe, expect, it } from "vitest";
import {
  filterUsefulTags,
  phraseList,
} from "../src/core/humanize-tags";

describe("humanize-tags", () => {
  it("drops amenity noise", () => {
    const tags = filterUsefulTags([
      { id: "1", name: "Coffee" },
      { id: "2", name: "Free Wi-Fi" },
      { id: "3", name: "Private bathroom" },
      { id: "4", name: "Beachfront" },
    ]);
    expect(tags.map((t) => t.name)).toEqual(["Coffee", "Beachfront"]);
  });

  it("phrases lists naturally", () => {
    expect(phraseList(["Coffee"])).toBe("coffee");
    expect(phraseList(["Coffee", "Lunch"])).toBe("coffee and lunch");
    expect(phraseList(["Casual", "Restaurant", "Lunch"])).toBe(
      "casual, restaurant, and lunch",
    );
    expect(phraseList(["Tourist Attraction", "Four Star"])).toBe(
      "tourist attraction and four star",
    );
  });
});
