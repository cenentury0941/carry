import type { TastePriority, TastePriorityLabel } from "@/contracts";

export type TastePriorityMeta = {
  priority: TastePriority;
  priorityLabel: TastePriorityLabel;
  /** Instructions for AI / template briefs. */
  briefFocus: string;
};

export function tastePriorityMeta(
  priority: TastePriority,
): TastePriorityMeta {
  switch (priority) {
    case "rhyme":
      return {
        priority: "rhyme",
        priorityLabel: "Keep Similar",
        briefFocus: [
          "The user chose Keep Similar — they want continuity with their current life.",
          "Lead with what overlaps: familiar rituals, shared taste signals, and how day-to-day life would rhyme with home.",
          "Mention differences only briefly as optional flavor, not the headline.",
          "Weight the summary and match explanation toward similarities; keep the difference explanation short.",
        ].join(" "),
      };
    case "depart":
      return {
        priority: "depart",
        priorityLabel: "Change",
        briefFocus: [
          "The user chose Change — they want maximum taste distance from their current life.",
          "Lead with what would feel different: new rhythms, destination-stronger tastes, and how daily life would stretch them.",
          "Mention similarities only briefly so they know they won't be totally at sea.",
          "Weight the summary and difference explanation toward contrasts; keep the familiarity explanation short.",
        ].join(" "),
      };
    default:
      return {
        priority: "balanced",
        priorityLabel: "Balanced",
        briefFocus: [
          "The user chose Balanced — cover both continuity and contrast.",
          "Give roughly equal weight to what would feel familiar and what would feel new.",
        ].join(" "),
      };
  }
}

/** Default boarding-pass focus: highest continuity for Keep Similar, lowest for Change. */
export function pickDefaultDestinationId(
  destinations: Array<{ id: string; continuity: number }>,
  priority: TastePriority,
): string {
  if (destinations.length === 0) return "";
  if (priority === "rhyme") {
    return [...destinations].sort((a, b) => b.continuity - a.continuity)[0].id;
  }
  if (priority === "depart") {
    return [...destinations].sort((a, b) => a.continuity - b.continuity)[0].id;
  }
  return destinations[0].id;
}

export function resolveMovePriority(move: {
  result?: { priority?: TastePriority } | null;
  tastes?: { priorities?: TastePriority[] } | null;
}): TastePriority {
  return (
    move.result?.priority ??
    move.tastes?.priorities?.[0] ??
    "balanced"
  );
}
