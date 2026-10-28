import { describe, expect, it } from "vitest";
import { templateCopy, templateFirstWeek } from "../src/core/template";
import { copyMentionsOnlyEvidence } from "../src/core/steps/write";
import type { Area } from "../src/contracts";

const area: Area = {
  geohash: "abc",
  label: "Pearl District",
  score: 0.8,
  venues: [{ id: "1", name: "Heart Coffee", address: "Pearl District, Portland" }],
  sharedTags: [{ id: "t", name: "indie coffee", score: 0.7 }],
  changedTags: [],
};

describe("template", () => {
  it("builds copy from evidence", () => {
    const copy = templateCopy({
      destination: "Portland, OR",
      mode: "rhyme",
      continuity: 72,
      originNames: ["Blue Bottle", "Brooklyn Bowl", "Marlow"],
      rhyme: [area],
      depart: null,
    });
    expect(copy.headline).toContain("Portland");
    expect(copy.summary).toContain("72");
    expect(copy.rhymeNote).toContain("Pearl");
  });

  it("builds a 3-item first week", () => {
    const week = templateFirstWeek(
      {
        origin: [
          { id: "1", name: "A" },
          { id: "2", name: "B" },
          { id: "3", name: "C" },
        ],
        destination: "Portland, OR",
        mode: "rhyme",
      },
      [area],
      null,
    );
    expect(week).toHaveLength(3);
  });

  it("rejects invented entity names in copy", () => {
    const ok = copyMentionsOnlyEvidence(
      {
        headline: "Keep your week in Portland",
        summary: "Start at Heart Coffee in Pearl District.",
        rhymeNote: "Indie coffee carries over.",
        departNote: null,
      },
      new Set(["heart coffee", "pearl district", "indie coffee"]),
      ["Blue Bottle"],
      "Portland",
    );
    expect(ok).toBe(true);

    const bad = copyMentionsOnlyEvidence(
      {
        headline: "Visit Invented Palace Tonight",
        summary: "Go to Invented Palace.",
        rhymeNote: "Nope",
        departNote: null,
      },
      new Set(["heart coffee"]),
      ["Blue Bottle"],
      "Portland",
    );
    expect(bad).toBe(false);
  });
});
