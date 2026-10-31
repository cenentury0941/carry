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
          "The user chose Keep Similar — emphasize SIMILARITY at the destination above all else.",
          "Lead hard with overlaps: familiar rituals, shared taste signals, and how day-to-day life would rhyme with home.",
          "matchExplanation should be the longest, richest part (2 sentences); mismatchExplanation must be one short sentence of optional flavor only — never the headline.",
          "Summary must open on what stays the same at this destination, not what changes.",
        ].join(" "),
      };
    case "depart":
      return {
        priority: "depart",
        priorityLabel: "Change",
        briefFocus: [
          "The user chose Change — emphasize DIFFERENCE at the destination above all else.",
          "Lead hard with contrasts: new rhythms, destination-stronger tastes, and how daily life would stretch them.",
          "mismatchExplanation should be the longest, richest part (2 sentences); matchExplanation must be one short sentence so they know they won't be totally at sea.",
          "Summary must open on what would feel new at this destination, not what stays familiar.",
        ].join(" "),
      };
    default:
      return {
        priority: "balanced",
        priorityLabel: "Balanced",
        briefFocus: [
          "The user chose Balanced — cover both continuity and contrast at the destination.",
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
