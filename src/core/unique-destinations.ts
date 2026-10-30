import type { MoveProject, RankedDestination } from "@/contracts";

/** Nearby homes can share a geohash id in legacy results — make ids unique. */
export function uniquifyDestinations(
  destinations: RankedDestination[],
): RankedDestination[] {
  const counts = new Map<string, number>();
  return destinations.map((d) => {
    const n = counts.get(d.id) ?? 0;
    counts.set(d.id, n + 1);
    if (n === 0) return d;
    return { ...d, id: `${d.id}~${n}` };
  });
}

export function healMoveDestinationIds(move: MoveProject): MoveProject {
  const destinations = move.result?.destinations;
  if (!destinations?.length) return move;
  const next = uniquifyDestinations(destinations);
  const changed = next.some((d, i) => d.id !== destinations[i]?.id);
  if (!changed) return move;
  return {
    ...move,
    result: {
      ...move.result!,
      destinations: next,
    },
  };
}
