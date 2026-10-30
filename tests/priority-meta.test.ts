import { describe, expect, it } from "vitest";
import {
  pickDefaultDestinationId,
  tastePriorityMeta,
} from "../src/core/priority-meta";

describe("tastePriorityMeta", () => {
  it("maps rhyme to Keep Similar with similarity-focused brief", () => {
    const meta = tastePriorityMeta("rhyme");
    expect(meta.priorityLabel).toBe("Keep Similar");
    expect(meta.briefFocus.toLowerCase()).toContain("similar");
  });

  it("maps depart to Change with difference-focused brief", () => {
    const meta = tastePriorityMeta("depart");
    expect(meta.priorityLabel).toBe("Change");
    expect(meta.briefFocus.toLowerCase()).toContain("difference");
  });

  it("maps balanced to Balanced covering both", () => {
    const meta = tastePriorityMeta("balanced");
    expect(meta.priorityLabel).toBe("Balanced");
    expect(meta.briefFocus.toLowerCase()).toMatch(/both|equal/);
  });
});

describe("pickDefaultDestinationId", () => {
  const dests = [
    { id: "high", continuity: 84 },
    { id: "mid", continuity: 78 },
    { id: "low", continuity: 72 },
  ];

  it("picks highest continuity for Keep Similar", () => {
    expect(pickDefaultDestinationId(dests, "rhyme")).toBe("high");
  });

  it("picks lowest continuity for Change", () => {
    expect(pickDefaultDestinationId(dests, "depart")).toBe("low");
  });

  it("keeps ranked order for Balanced", () => {
    expect(pickDefaultDestinationId(dests, "balanced")).toBe("high");
  });
});
