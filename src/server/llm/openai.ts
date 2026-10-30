import { zodResponseFormat } from "openai/helpers/zod";
import { BriefCopy, DestinationCopy, VenueWhyBatch } from "@/contracts";
import type { LlmWriter, VenueWhyInput } from "@/core/deps";
import { createOpenAIClient, openAIModel } from "./client";

export function createOpenAIWriter(): LlmWriter | null {
  const client = createOpenAIClient();
  if (!client) return null;
  const model = openAIModel();

  return {
    async writeBriefCopy(input) {
      const prompt = [
        "You write short relocation briefs for Carry.",
        "Only mention places, tags, and labels listed below. Do not invent venues.",
        "Write in warm, plain English — never paste raw tag lists into sentences.",
        `Destination: ${input.destination}`,
        `Mode: ${input.mode}`,
        `Continuity score: ${input.continuity}`,
        `Origin places: ${input.originNames.join(", ")}`,
        `Rhyme areas: ${input.rhymeLabels.join(", ") || "(none)"}`,
        `Depart area: ${input.departLabel ?? "(none)"}`,
        `Shared taste tags: ${input.sharedTagNames.join(", ") || "(none)"}`,
        `Venues (evidence): ${input.venueNames.join(", ") || "(none)"}`,
        "Return headline, summary, rhymeNote, and departNote (null if no depart area).",
      ].join("\n");

      const completion = await client.chat.completions.parse({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are Carry's brief writer. Stay grounded in evidence. No invented places. Prefer readable prose over jargon.",
          },
          { role: "user", content: prompt },
        ],
        response_format: zodResponseFormat(BriefCopy, "brief_copy"),
      });

      const parsed = completion.choices[0]?.message.parsed;
      if (!parsed) {
        throw new Error("OpenAI returned empty structured output");
      }
      return BriefCopy.parse(parsed);
    },

    async writeDestinationCopy(input) {
      const prompt = [
        "Write a relocation destination brief for a normal person deciding where to live next.",
        "",
        "Rules:",
        "- Plain, conversational English. Full sentences. No buzzwords.",
        "- NEVER dump raw tags into a sentence (bad: \"It shares Casual, Restaurant, Lunch\").",
        "- DO interpret tags into lived experience (good: \"You'll still find easygoing spots for a casual lunch and a coffee run.\").",
        "- NEVER invent venues or streets not listed below.",
        "- Continuity is Carry's cultural-taste score (0–100), not rent or safety — say that gently if you mention the number.",
        "- matchExplanation should feel familiar given the places they already love.",
        "- mismatchExplanation should describe what would feel new or different there — not a judgment.",
        "- expect: 2–4 friendly tips for what to try first (where to start, what to sample), ordered for their priority.",
        "- Follow BRIEF FOCUS below: it decides whether similarities or differences lead the story.",
        "",
        `Destination label: ${input.destination}`,
        `Current residence: ${input.residenceName}`,
        `Priority: ${input.priorityLabel} (${input.priority})`,
        `BRIEF FOCUS: ${input.briefFocus}`,
        `Continuity score: ${input.continuity}/100`,
        `Places they love: ${input.originNames.join("; ") || "(none)"}`,
        `Taste signals that match (from Qloo compare): ${input.matchTags.join("; ") || "(none)"}`,
        `Taste signals stronger at the destination: ${input.mismatchTags.join("; ") || "(none)"}`,
        `Suggested nearby places: ${input.venueNames
          .map((n, i) =>
            input.venueAddresses[i] ? `${n} (${input.venueAddresses[i]})` : n,
          )
          .join("; ") || "(none)"}`,
      ].join("\n");

      const completion = await client.chat.completions.parse({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are Carry, a relocation taste guide. Translate cultural taste data into clear advice. Honor the user's Keep Similar / Change / Balanced priority when deciding whether to emphasize overlaps or contrasts. Never invent places. Never paste tag lists.",
          },
          { role: "user", content: prompt },
        ],
        response_format: zodResponseFormat(DestinationCopy, "destination_copy"),
      });

      const parsed = completion.choices[0]?.message.parsed;
      if (!parsed) {
        throw new Error("OpenAI returned empty destination copy");
      }
      return DestinationCopy.parse(parsed);
    },

    async writeVenueWhys(input: VenueWhyInput) {
      const venueBlocks = input.venues
        .map((v, i) => {
          const affinityPct =
            typeof v.affinity === "number"
              ? `${Math.round(v.affinity * 100)}%`
              : "not provided";
          return [
            `Venue ${i + 1}:`,
            `  id: ${v.id}`,
            `  name: ${v.name}`,
            `  address: ${v.address || "(unknown)"}`,
            `  Qloo insights affinity to user's taste entities: ${affinityPct}`,
            `  Qloo compare — tags shared with user's tastes: ${v.sharedTags.join("; ") || "(none)"}`,
            `  Qloo compare — tags stronger on this venue: ${v.venueOnlyTags.join("; ") || "(none)"}`,
          ].join("\n");
        })
        .join("\n\n");

      const prompt = [
        "Explain why each recommended place was chosen for this specific person.",
        "You are given THEIR inputs and Qloo's measured response for each place.",
        "",
        "Rules:",
        "- Write 2–4 plain-English sentences per venue.",
        "- Tie the explanation to THEIR residence, ritual places, preference tags, and priority.",
        "- Cite the Qloo evidence (affinity and/or tags) in natural language — do not invent affinity numbers or tags.",
        "- Do not invent cuisine, vibes, or amenities that are not in the evidence.",
        "- Do not use a fixed template; each venue's why must reflect THAT venue's evidence.",
        "- Never say this is about rent, commute, or safety.",
        "- Return one object per venue with the same id you were given.",
        "- If BRIEF FOCUS is present, emphasize similarity vs difference accordingly.",
        "",
        "User inputs:",
        `  Current residence: ${input.residenceName}`,
        `  Places they love: ${input.originNames.join("; ") || "(none)"}`,
        `  Preference tags they entered: ${input.userPreferenceTags.join("; ") || "(none)"}`,
        `  Priority: ${input.priorityLabel ?? input.priority}${input.briefFocus ? ` — ${input.briefFocus}` : ""}`,
        `  Destination area being evaluated: ${input.destination}`,
        "",
        "Qloo evidence per venue:",
        venueBlocks,
      ].join("\n");

      const completion = await client.chat.completions.parse({
        model,
        messages: [
          {
            role: "system",
            content:
              "You explain Qloo-backed place recommendations for Carry. Ground every sentence in the provided user inputs and Qloo evidence. Never invent data.",
          },
          { role: "user", content: prompt },
        ],
        response_format: zodResponseFormat(VenueWhyBatch, "venue_why_batch"),
      });

      const parsed = completion.choices[0]?.message.parsed;
      if (!parsed) {
        throw new Error("OpenAI returned empty venue why batch");
      }
      return VenueWhyBatch.parse(parsed);
    },
  };
}
