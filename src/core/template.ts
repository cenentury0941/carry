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
        ? `Stay close to what you love in ${input.destination}`
        : `A fresh change of pace in ${input.destination}`,
    summary: `Based on places like ${input.originNames.slice(0, 3).join(", ")}, your cultural fit score is ${input.continuity}. ${
      top
        ? `${top.label} is the strongest match, with spots like ${venues}.`
        : `We could not find a strong match yet — try a few more of your favorite places.`
    }`,
    rhymeNote: top
      ? `${top.label} has a lot in common with the places you already love (${shared}). Start there if you want things to feel familiar.`
      : `No strong match yet. Add a few more of your favorite places.`,
    departNote: input.depart
      ? `${input.depart.label} is lively but feels farther from what you know. Pick it when you want a fresh change of pace.`
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
      title: "Ease into the morning",
      detail: venues[0]
        ? `Start at ${venues[0].name}${venues[0].address ? ` (${venues[0].address})` : ""} — the closest match to places you already like.`
        : `Take a walk through the top-matched area and find a morning spot that feels right.`,
      entityIds: venues[0] ? [venues[0].id] : [],
    },
    {
      day: "Wednesday",
      title: "An evening hangout",
      detail: venues[1]
        ? `Try ${venues[1].name} on a weeknight — people who love your usual spots tend to like it too.`
        : `Find a friendly weeknight hangout in the matched area.`,
      entityIds: venues[1] ? [venues[1].id] : [],
    },
    {
      day: "Sunday",
      title: input.mode === "depart" && depart ? "Try something different" : "See if it feels like home",
      detail:
        input.mode === "depart" && depart
          ? `Spend an afternoon in ${depart.label} to feel what a fresher pace would be like.`
          : `Swing back through ${top?.label ?? input.destination} and notice which streets you’d actually want to call home.`,
      entityIds: [],
    },
  ];
  return items;
}
