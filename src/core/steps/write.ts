import type { Area, BriefCopy, BriefInput, PlanItem } from "@/contracts";
import type { Deps } from "../deps";
import { templateCopy, templateFirstWeek } from "../template";

function entityNamesAllowed(rhyme: Area[], depart: Area | null): Set<string> {
  const names = new Set<string>();
  for (const a of [...rhyme, ...(depart ? [depart] : [])]) {
    names.add(a.label.toLowerCase());
    for (const v of a.venues) names.add(v.name.toLowerCase());
    for (const t of a.sharedTags) names.add(t.name.toLowerCase());
    for (const t of a.changedTags) names.add(t.name.toLowerCase());
  }
  return names;
}

/** Reject copy that invents proper nouns not in evidence (simple heuristic). */
export function copyMentionsOnlyEvidence(
  copy: BriefCopy,
  allowed: Set<string>,
  originNames: string[],
  destination: string,
): boolean {
  for (const n of originNames) allowed.add(n.toLowerCase());
  allowed.add(destination.toLowerCase());

  const text = [copy.headline, copy.summary, copy.rhymeNote, copy.departNote ?? ""]
    .join(" ");
  // Extract Title Case / quoted sequences as potential entity names
  const candidates = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\b/g) ?? [];
  const stop = new Set([
    "Your",
    "Keep",
    "Stay",
    "Start",
    "Try",
    "Spend",
    "Based",
    "Add",
    "Pick",
    "Swing",
    "Come",
    "Find",
    "Walk",
    "Take",
    "Ease",
    "See",
    "The",
    "This",
    "That",
    "With",
    "From",
    "Near",
    "Area",
    "Saturday",
    "Sunday",
    "Wednesday",
    "Continuity",
    "Score",
    "Rhyme",
    "Depart",
    "Chapter",
    "Week",
    "Fresh",
  ]);
  for (const c of candidates) {
    if (stop.has(c.split(" ")[0])) continue;
    if (c.length < 4) continue;
    const lower = c.toLowerCase();
    let ok = false;
    for (const a of allowed) {
      if (a.includes(lower) || lower.includes(a)) {
        ok = true;
        break;
      }
    }
    if (!ok) return false;
  }
  return true;
}

export async function writeBrief(
  input: BriefInput,
  continuity: number,
  rhyme: Area[],
  depart: Area | null,
  deps: Deps,
): Promise<{ copy: BriefCopy; firstWeek: PlanItem[] }> {
  const firstWeek = templateFirstWeek(input, rhyme, depart);
  const fallback = templateCopy({
    destination: input.destination,
    mode: input.mode,
    continuity,
    originNames: input.origin.map((o) => o.name),
    rhyme,
    depart,
  });

  if (!deps.llm) {
    return { copy: fallback, firstWeek };
  }

  try {
    const venueNames = rhyme.flatMap((a) => a.venues.map((v) => v.name)).slice(0, 12);
    const sharedTagNames = rhyme
      .flatMap((a) => a.sharedTags.map((t) => t.name))
      .slice(0, 10);
    const copy = await deps.llm.writeBriefCopy({
      destination: input.destination,
      mode: input.mode,
      continuity,
      originNames: input.origin.map((o) => o.name),
      rhymeLabels: rhyme.map((a) => a.label),
      departLabel: depart?.label ?? null,
      sharedTagNames,
      venueNames,
    });
    const allowed = entityNamesAllowed(rhyme, depart);
    if (
      !copyMentionsOnlyEvidence(
        copy,
        allowed,
        input.origin.map((o) => o.name),
        input.destination,
      )
    ) {
      deps.log.warn({}, "llm copy failed evidence check; using template");
      return { copy: fallback, firstWeek };
    }
    return { copy, firstWeek };
  } catch (err) {
    deps.log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "llm writer failed; using template",
    );
    return { copy: fallback, firstWeek };
  }
}
