import type { Area, BriefCopy, BriefInput, PlanItem } from "@/contracts";

export function templateCopy(input: {
  destination: string;
  mode: "rhyme" | "depart";
  continuity: number;
  originNames: string[];
  rhyme: Area[];
  depart: Area | null;
}): BriefCopy {
  const top = input.rhyme[0];
  const shared =
    top?.sharedTags.slice(0, 3).map((t) => t.name).join(", ") || "shared tastes";
  const venues =
    top?.venues.slice(0, 2).map((v) => v.name).join(" and ") || "local places";

  return {
    headline:
      input.mode === "rhyme"
        ? `Keep your week in ${input.destination}`
        : `A different chapter in ${input.destination}`,
    summary: `Your rituals around ${input.originNames.slice(0, 3).join(", ")} map to a continuity score of ${input.continuity}. ${
      top
        ? `${top.label} is the strongest rhyme, grounded in ${venues}.`
        : `We could not find a strong rhyme yet — try different origin places.`
    }`,
    rhymeNote: top
      ? `${top.label} shares ${shared} with your current week. Start there if you want the next chapter to feel familiar.`
      : `No rhyme area yet. Add more specific places from your current week.`,
    departNote: input.depart
      ? `${input.depart.label} is lively but culturally farther from your origin. Use it when you want daily life to change.`
      : null,
  };
}

export function templateFirstWeek(
  input: BriefInput,
  rhyme: Area[],
  depart: Area | null,
): PlanItem[] {
  const top = rhyme[0];
  const venues = top?.venues ?? [];
  const items: PlanItem[] = [
    {
      day: "Saturday",
      title: "Settle the morning ritual",
      detail: venues[0]
        ? `Start at ${venues[0].name}${venues[0].address ? ` (${venues[0].address})` : ""} — the closest echo of your origin week.`
        : `Walk the top rhyme area and pick a morning spot that feels familiar.`,
      entityIds: venues[0] ? [venues[0].id] : [],
    },
    {
      day: "Wednesday",
      title: "Weeknight room",
      detail: venues[1]
        ? `Try ${venues[1].name} midweek — a place that over-indexes with people who also love your origin set.`
        : `Find a midweek hangout inside the rhyme area.`,
      entityIds: venues[1] ? [venues[1].id] : [],
    },
    {
      day: "Sunday",
      title: input.mode === "depart" && depart ? "One deliberate departure" : "Confirm the fit",
      detail:
        input.mode === "depart" && depart
          ? `Spend an afternoon in ${depart.label} to feel what changes if you choose the farther street.`
          : `Revisit ${top?.label ?? input.destination} and decide which street you would actually sign on.`,
      entityIds: [],
    },
  ];
  return items;
}
