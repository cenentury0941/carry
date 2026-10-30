import type OpenAI from "openai";
import type {
  MoveChatResult,
  MoveProject,
  ResolvedPlace,
  TastePriority,
  TasteProfile,
  TargetScope,
} from "@/contracts";
import { hasOpenAI } from "@/server/env";
import { createOpenAIClient, openAIModel } from "@/server/llm/client";
import { searchPhoton } from "@/server/photon";
import { encodeGeohash } from "./geohash";
import type { Deps } from "./deps";
import { CarryError } from "./deps";
import { runMovePipeline } from "./move-pipeline";

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "answer",
      description:
        "Answer a question about the move, residence, tastes, destinations, venues, or Qloo signals without changing inputs.",
      parameters: {
        type: "object",
        properties: { message: { type: "string" } },
        required: ["message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_priority",
      description:
        "Change continuity priority: rhyme (keep similar), depart (change), or balanced. Triggers a Qloo rebuild.",
      parameters: {
        type: "object",
        properties: {
          priority: { type: "string", enum: ["rhyme", "depart", "balanced"] },
        },
        required: ["priority"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_taste_tag",
      description: "Add a freeform taste/preference tag, then rebuild.",
      parameters: {
        type: "object",
        properties: { tag: { type: "string" } },
        required: ["tag"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_taste_tag",
      description: "Remove a taste tag (case-insensitive match), then rebuild.",
      parameters: {
        type: "object",
        properties: { tag: { type: "string" } },
        required: ["tag"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_region",
      description:
        "Switch target scope to an ambiguous region string (country/state) and rebuild candidates via Qloo.",
      parameters: {
        type: "object",
        properties: { region: { type: "string" } },
        required: ["region"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_target_place",
      description:
        "Add an extra target destination (does not remove existing ones), then rebuild. Prefer replace_target_place when the user wants to change/switch the focused or named destination.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          kind: { type: "string", enum: ["areas", "addresses"] },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "replace_target_place",
      description:
        "Replace an existing target with a new address/place, then rebuild. Use when the user says change/switch/replace a destination (e.g. swap the Philly home for a different Philly street). Defaults to replacing the focused destination from the UI.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "New street address or place name",
          },
          kind: { type: "string", enum: ["areas", "addresses"] },
          replaceQuery: {
            type: "string",
            description:
              "Optional text matching the old target (name or address fragment). If omitted, replaces the focused destination.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rebuild",
      description: "Re-run the Qloo matching pipeline with the current inputs.",
      parameters: { type: "object", properties: {} },
    },
  },
];

function placeMatchesQuery(place: ResolvedPlace, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const hay = [place.name, place.address, place.id]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (hay.includes(q)) return true;
  const tokens = q.split(/[,\s]+/).filter((t) => t.length > 2);
  return tokens.length > 0 && tokens.every((t) => hay.includes(t));
}

function destinationSeedId(d: {
  id: string;
  lat?: number;
  lon?: number;
}): string | null {
  if (d.id.startsWith("geo:")) {
    // Normalize uniqueness suffix: geo:dr4e6k~1 → geo:dr4e6k
    return `geo:${d.id.slice(4).split("~")[0]}`;
  }
  if (typeof d.lat === "number" && typeof d.lon === "number") {
    return `geo:${encodeGeohash(d.lat, d.lon)}`;
  }
  return null;
}

function indexOfTargetToReplace(
  target: TargetScope,
  opts: {
    destinationId?: string;
    replaceQuery?: string;
    destinations: NonNullable<MoveProject["result"]>["destinations"];
  },
): number {
  if (target.kind === "ambiguous") return -1;
  const { destinationId, replaceQuery, destinations } = opts;

  if (replaceQuery) {
    const byQuery = target.places.findIndex((p) =>
      placeMatchesQuery(p, replaceQuery),
    );
    if (byQuery >= 0) return byQuery;
  }

  if (destinationId) {
    const dest = destinations.find((d) => d.id === destinationId);
    if (dest) {
      const seed = destinationSeedId(dest);
      const byId = target.places.findIndex((p) => {
        if (p.id === dest.id || p.id === destinationId) return true;
        if (
          seed &&
          typeof p.lat === "number" &&
          typeof p.lon === "number" &&
          `geo:${encodeGeohash(p.lat, p.lon)}` === seed
        ) {
          return true;
        }
        if (dest.address && p.address && dest.address === p.address) return true;
        if (dest.label && p.name === dest.label) return true;
        return placeMatchesQuery(p, dest.label) || placeMatchesQuery(p, dest.address ?? "");
      });
      if (byId >= 0) return byId;
    }
  }

  return target.places.length > 0 ? 0 : -1;
}

async function resolvePlaceHit(
  query: string,
  kind: "addresses" | "areas",
  deps: Deps,
): Promise<ResolvedPlace | null> {
  const hits =
    kind === "addresses"
      ? await searchPhoton(query, 5)
      : await deps.qloo.searchPlaces(query, 5);
  const hit = hits[0];
  if (!hit) return null;
  return {
    id: hit.id,
    name: hit.name,
    address: hit.address,
    type: hit.type,
    lat: hit.lat,
    lon: hit.lon,
  };
}

function compactMoveContext(move: MoveProject, destinationId?: string) {
  const destinations = move.result?.destinations ?? [];
  const selected =
    destinations.find((d) => d.id === destinationId) ?? destinations[0];
  return {
    residence: move.residence,
    target: move.target,
    tastes: move.tastes
      ? {
          priorities: move.tastes.priorities,
          tags: move.tastes.tags,
          places: move.tastes.places.map((p) => p.name),
          inferredFromResidence: move.tastes.inferredFromResidence,
        }
      : null,
    destinations: destinations.map((d) => ({
      id: d.id,
      label: d.label,
      continuity: d.continuity,
      address: d.address ?? d.locationQuery,
      matches: d.matches.slice(0, 6).map((t) => t.name),
      mismatches: d.mismatches.slice(0, 4).map((t) => t.name),
      venues: d.venues.slice(0, 5).map((v) => ({
        name: v.name,
        type: v.type,
        affinity: v.affinity,
        evidenceTags: v.evidenceTags?.slice(0, 4),
      })),
      summary: d.summary.slice(0, 400),
    })),
    focusedDestination: selected
      ? {
          id: selected.id,
          label: selected.label,
          summary: selected.summary,
          expect: selected.expect,
        }
      : null,
  };
}

async function rebuildMove(
  project: MoveProject,
  deps: Deps,
): Promise<MoveProject> {
  let last: MoveProject | null = null;
  for await (const event of runMovePipeline(project, deps)) {
    if (event.type === "move") last = event.move;
    if (event.type === "error") {
      throw new CarryError(event.kind, event.message);
    }
  }
  if (!last) {
    throw new CarryError("internal", "Rebuild produced no move result.");
  }
  return last;
}

function ensureTastes(move: MoveProject): TasteProfile {
  return (
    move.tastes ?? {
      places: [],
      tags: [],
      priorities: ["balanced"],
      inferredFromResidence: true,
    }
  );
}

/** Explicit mutation intents only — not words like "similar" in a question. */
function looksLikeMutation(message: string): boolean {
  const lower = message.toLowerCase().trim();
  if (/\b(rebuild|rerun|refresh)\b/.test(lower)) return true;
  if (
    /\b(add|remove|delete|replace|swap)\b.{0,40}\b(tag|target|place|area|destination|address|home)\b/.test(
      lower,
    )
  )
    return true;
  if (
    /\b(set|change|switch|update|replace)\b.{0,40}\b(priority|priorities|rhyme|depart|balanced|region|target|destination|address|philly|philadelphia|chicago|scottsdale)\b/.test(
      lower,
    )
  )
    return true;
  if (/^(rhyme|depart|balanced)\b/.test(lower)) return true;
  if (/\bpriority\b.{0,20}\b(rhyme|depart|balanced)\b/.test(lower)) return true;
  return false;
}

/** User wants broader / better local matches — nudge enriching taste places, not inventing areas. */
function wantsMoreInterestingAreas(message: string): boolean {
  const lower = message.toLowerCase();
  if (
    /\b(more|other|another|additional|new)\b.{0,40}\b(area|areas|neighborhood|neighborhoods|spot|spots|place|places|locale|locales)\b/.test(
      lower,
    )
  )
    return true;
  if (
    /\b(area|areas|neighborhood|neighborhoods|spot|spots)\b.{0,40}\b(interesting|interest|like|love|explore|around (here|me)|near (here|me)|for me)\b/.test(
      lower,
    )
  )
    return true;
  if (
    /\b(what|where).{0,30}\b(else|also|more).{0,30}\b(explore|check out|visit|interesting)\b/.test(
      lower,
    )
  )
    return true;
  if (
    /\bfind\b.{0,40}\b(area|areas|neighborhood|neighborhoods|spot|spots)\b/.test(
      lower,
    )
  )
    return true;
  return false;
}

function enrichTastesNudge(previous: MoveProject): string {
  const residence = previous.residence?.name ?? "your current location";
  const placeCount = previous.tastes?.places?.length ?? 0;
  const placeHint =
    placeCount === 0
      ? "You haven’t added ritual places yet"
      : placeCount < 3
        ? `You only have ${placeCount} taste place${placeCount === 1 ? "" : "s"} so far`
        : "Your current taste places are a start";
  return [
    `${placeHint}. To surface areas that fit you better, edit this move and add more places you visit day to day — or spots you’re interested in around ${residence} (cafés, restaurants, venues, neighborhoods on the Tastes step).`,
    "Then re-run ranking so Qloo can refresh matches from that fuller picture.",
  ].join(" ");
}

function heuristicAnswer(
  previous: MoveProject,
  message: string,
  destinationId?: string,
): string {
  if (wantsMoreInterestingAreas(message)) {
    return enrichTastesNudge(previous);
  }

  const dest =
    previous.result?.destinations.find((d) => d.id === destinationId) ??
    previous.result?.destinations[0];
  if (!dest) {
    return "No destinations yet. Set tastes/targets and rebuild to get Qloo matches.";
  }
  const residence = previous.residence?.name ?? "your current city";
  const lower = message.toLowerCase();
  const wantDiff =
    /\b(different|difference|differ|unlike|contrast|vs\.?|versus)\b/.test(
      lower,
    );
  const matches = dest.matches
    .slice(0, 4)
    .map((t) => t.name)
    .join(", ");
  const mismatches = dest.mismatches
    .slice(0, 4)
    .map((t) => t.name)
    .join(", ");
  const venues = dest.venues
    .slice(0, 3)
    .map((v) => v.name)
    .join(", ");
  const expect = dest.expect?.slice(0, 2).join(" ") ?? "";

  if (wantDiff) {
    return [
      `${dest.label} vs ${residence}: continuity ${dest.continuity}/100 — lower means more departure from your current pattern.`,
      mismatches
        ? `Likely shifts from NYC-style tastes: ${mismatches}.`
        : "Qloo didn’t surface strong mismatch tags for this pair.",
      matches ? `Still shared: ${matches}.` : "",
      expect || dest.summary.slice(0, 280),
      venues ? `Local venues in the mix: ${venues}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    `${dest.label} scores ${dest.continuity}/100 continuity with ${residence}.`,
    dest.summary.slice(0, 320),
    matches ? `Taste overlaps: ${matches}.` : "",
    mismatches ? `Where it diverges: ${mismatches}.` : "",
    venues ? `Nearby venues that rhyme: ${venues}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function chatMoveAgent(
  previous: MoveProject,
  message: string,
  deps: Deps,
  opts?: {
    destinationId?: string;
    history?: { role: "user" | "assistant"; content: string }[];
  },
): Promise<MoveChatResult> {
  if (!previous.residence || !previous.target || !previous.tastes) {
    return {
      kind: "error",
      message: "Complete residence, targets, and tastes before chatting.",
    };
  }

  let next: MoveProject = {
    ...previous,
    tastes: { ...ensureTastes(previous) },
    target: previous.target,
  };
  let dirty = false;
  let answerOnly: string | null = null;
  let forceRebuild = false;
  const mutate = looksLikeMutation(message);

  const client = createOpenAIClient();
  if (!client || !hasOpenAI()) {
    const lower = message.toLowerCase();
    if (mutate && /\bdepart\b/.test(lower)) {
      next = {
        ...next,
        tastes: { ...ensureTastes(next), priorities: ["depart"] },
      };
      dirty = true;
    } else if (mutate && /\brhyme\b/.test(lower)) {
      next = {
        ...next,
        tastes: { ...ensureTastes(next), priorities: ["rhyme"] },
      };
      dirty = true;
    } else if (mutate && /\bbalanced\b/.test(lower)) {
      next = {
        ...next,
        tastes: { ...ensureTastes(next), priorities: ["balanced"] },
      };
      dirty = true;
    } else if (mutate && /\b(rebuild|rerun|refresh)\b/.test(lower)) {
      forceRebuild = true;
    } else {
      return {
        kind: "answer",
        message: heuristicAnswer(previous, message, opts?.destinationId),
      };
    }
    if (dirty || forceRebuild) {
      const move = await rebuildMove(next, deps);
      return {
        kind: "move",
        message: "Updated preferences and refreshed Qloo matches.",
        move,
      };
    }
    return {
      kind: "answer",
      message: heuristicAnswer(previous, message, opts?.destinationId),
    };
  }

  const model = openAIModel();
  const contextPayload = JSON.stringify({
    message,
    context: compactMoveContext(previous, opts?.destinationId),
  });

  // Questions (e.g. "how is LA similar to NYC?") stay answer-only — never rebuild.
  if (!mutate) {
    // "More areas around here" → steer to enriching taste places, not re-listing destinations.
    if (wantsMoreInterestingAreas(message)) {
      return { kind: "answer", message: enrichTastesNudge(previous) };
    }
    try {
      const completion = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: [
              "You are Carry's relocation taste co-pilot.",
              "Answer only from the provided move JSON (inputs + Qloo destinations/venues).",
              "Compare continuity, taste overlaps, mismatches, and venues when relevant.",
              "Never invent cities or venues not in context. Keep answers under 220 words.",
              "Do not change priorities, tags, or targets — this turn is read-only.",
              "If the user asks for more / other interesting areas, neighborhoods, or spots “around here” / for them: do NOT re-pitch ranked destinations as new discovery lists.",
              "Instead tell them to Edit the move and add more day-to-day places or places they’re interested in around their current residence (Tastes step: cafés, restaurants, venues, neighborhoods), then re-run so Qloo can refresh matches.",
              "You may briefly note what is already ranked from current inputs, then steer hard to enriching those ritual/interest places.",
            ].join(" "),
          },
          ...(opts?.history ?? []).map((h) => ({
            role: h.role as "user" | "assistant",
            content: h.content,
          })),
          { role: "user", content: contextPayload },
        ],
      });
      const text = completion.choices[0]?.message?.content?.trim();
      return {
        kind: "answer",
        message:
          text || heuristicAnswer(previous, message, opts?.destinationId),
      };
    } catch (err) {
      // Out of credits / upstream outage — still answer from Qloo move data.
      const base = heuristicAnswer(previous, message, opts?.destinationId);
      const detail = err instanceof Error ? err.message : String(err);
      if (/\b429\b|credits|billing|quota/i.test(detail)) {
        return {
          kind: "answer",
          message: `${base} (OpenAI is out of credits — this reply used your Qloo match data only.)`,
        };
      }
      return { kind: "answer", message: base };
    }
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: [
        "You are Carry's relocation taste co-pilot.",
        "Ground answers in the provided move JSON (user inputs + Qloo-ranked destinations/venues).",
        "Never invent venues or cities not in context unless the user asks to search/add a target via tools.",
        "The user wants an input change or refresh. Use mutating tools (set_priority, tags, targets, rebuild) as needed.",
        "When they change/switch/replace a destination address, use replace_target_place (not add_target_place) so the old pin is removed.",
        "For street addresses use kind=addresses. replaceQuery can match the old city/street; otherwise the focused destination is replaced.",
        "Use answer to confirm what you changed. Keep tool use under 4 calls.",
        "Do not treat descriptive words like “similar” as a priority change unless they explicitly ask to set rhyme/depart/balanced.",
      ].join(" "),
    },
    ...(opts?.history ?? []).map((h) => ({
      role: h.role,
      content: h.content,
    })),
    {
      role: "user",
      content: contextPayload,
    },
  ];

  for (let i = 0; i < 4; i++) {
    const completion = await client.chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: "auto",
    });
    const choice = completion.choices[0];
    if (!choice) break;
    const msg = choice.message;
    messages.push(msg);

    if (!msg.tool_calls?.length) {
      if (msg.content) answerOnly = msg.content;
      break;
    }

    for (const call of msg.tool_calls) {
      if (call.type !== "function") continue;
      let args: Record<string, string> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}") as Record<
          string,
          string
        >;
      } catch {
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: "invalid tool arguments",
        });
        continue;
      }
      let toolResult = "ok";

      switch (call.function.name) {
        case "answer":
          answerOnly = args.message ?? "";
          break;
        case "set_priority": {
          const p = args.priority as TastePriority;
          if (p === "rhyme" || p === "depart" || p === "balanced") {
            next = {
              ...next,
              tastes: { ...ensureTastes(next), priorities: [p] },
            };
            dirty = true;
          } else toolResult = "invalid priority";
          break;
        }
        case "add_taste_tag": {
          const tag = (args.tag ?? "").trim();
          if (!tag) {
            toolResult = "empty tag";
            break;
          }
          const tastes = ensureTastes(next);
          if (!tastes.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
            next = {
              ...next,
              tastes: { ...tastes, tags: [...tastes.tags, tag].slice(0, 20) },
            };
            dirty = true;
          }
          break;
        }
        case "remove_taste_tag": {
          const tag = (args.tag ?? "").trim().toLowerCase();
          const tastes = ensureTastes(next);
          next = {
            ...next,
            tastes: {
              ...tastes,
              tags: tastes.tags.filter((t) => t.toLowerCase() !== tag),
            },
          };
          dirty = true;
          break;
        }
        case "set_region": {
          const region = (args.region ?? "").trim();
          if (region.length < 2) {
            toolResult = "region too short";
            break;
          }
          next = { ...next, target: { kind: "ambiguous", region } };
          dirty = true;
          break;
        }
        case "add_target_place": {
          const query = (args.query ?? "").trim();
          if (!query) {
            toolResult = "empty query";
            break;
          }
          const kind =
            args.kind === "addresses" || args.kind === "areas"
              ? args.kind
              : next.target?.kind === "addresses"
                ? "addresses"
                : "areas";
          try {
            const place = await resolvePlaceHit(query, kind, deps);
            if (!place) {
              toolResult =
                kind === "addresses"
                  ? "no addresses found"
                  : "no places found";
              break;
            }
            const existing = next.target;
            let target: TargetScope;
            if (
              existing &&
              (existing.kind === "areas" || existing.kind === "addresses")
            ) {
              const places = existing.places.some((p) => p.id === place.id)
                ? existing.places
                : [...existing.places, place].slice(0, 12);
              target = { kind: existing.kind, places };
            } else {
              target = { kind, places: [place] };
            }
            next = { ...next, target };
            dirty = true;
            toolResult = `added ${place.name}`;
          } catch (err) {
            toolResult =
              err instanceof Error ? err.message : "place search failed";
          }
          break;
        }
        case "replace_target_place": {
          const query = (args.query ?? "").trim();
          if (!query) {
            toolResult = "empty query";
            break;
          }
          const existing = next.target;
          if (
            !existing ||
            (existing.kind !== "areas" && existing.kind !== "addresses")
          ) {
            toolResult = "no address/area targets to replace";
            break;
          }
          const kind =
            args.kind === "addresses" || args.kind === "areas"
              ? args.kind
              : existing.kind;
          const idx = indexOfTargetToReplace(existing, {
            destinationId: opts?.destinationId,
            replaceQuery: (args.replaceQuery ?? "").trim() || undefined,
            destinations: previous.result?.destinations ?? [],
          });
          if (idx < 0) {
            toolResult = "could not match target to replace";
            break;
          }
          try {
            const place = await resolvePlaceHit(query, kind, deps);
            if (!place) {
              toolResult =
                kind === "addresses"
                  ? "no addresses found"
                  : "no places found";
              break;
            }
            const old = existing.places[idx];
            const places = [...existing.places];
            places[idx] = place;
            next = { ...next, target: { kind: existing.kind, places } };
            dirty = true;
            toolResult = `replaced ${old.name} with ${place.name}`;
          } catch (err) {
            toolResult =
              err instanceof Error ? err.message : "place search failed";
          }
          break;
        }
        case "rebuild":
          forceRebuild = true;
          break;
        default:
          toolResult = "unknown tool";
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: toolResult,
      });
    }

    if (answerOnly && !dirty && !forceRebuild) break;
  }

  if (!dirty && !forceRebuild) {
    return {
      kind: "answer",
      message:
        answerOnly?.trim() ||
        "I can explain destinations or adjust tastes/targets and refresh Qloo matches.",
    };
  }

  const move = await rebuildMove(
    {
      ...next,
      status: "running",
      updatedAt: deps.now().toISOString(),
    },
    deps,
  );
  return {
    kind: "move",
    message:
      answerOnly?.trim() ||
      "Updated your inputs and refreshed cultural matches from Qloo.",
    move,
  };
}
