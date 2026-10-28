import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { BriefCopy } from "@/contracts";
import { getEnv, hasOpenAI } from "../env";
import type { LlmWriter } from "@/core/deps";

export function createOpenAIWriter(): LlmWriter | null {
  if (!hasOpenAI()) return null;
  const env = getEnv();
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  return {
    async writeBriefCopy(input) {
      const prompt = [
        "You write short relocation briefs for Carry.",
        "Only mention places, tags, and labels listed below. Do not invent venues.",
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
        model: env.OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are Carry's brief writer. Stay grounded in evidence. No invented places.",
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
  };
}
