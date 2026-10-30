import type OpenAI from "openai";
import type { Brief, BriefInput } from "@/contracts";
import { hasOpenAI } from "@/server/env";
import { createOpenAIClient, openAIModel } from "@/server/llm/client";
import type { Deps } from "./deps";
import { CarryError } from "./deps";
import { runPipeline } from "./pipeline";

export type RefineResult =
  | { kind: "brief"; brief: Brief }
  | { kind: "answer"; message: string }
  | { kind: "error"; message: string };

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "set_mode",
      description: "Switch between rhyme (keep similar life) and depart (change daily life).",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["rhyme", "depart"] },
        },
        required: ["mode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "exclude_area",
      description: "Exclude a rhyme or depart area by its geohash and rebuild.",
      parameters: {
        type: "object",
        properties: {
          geohash: { type: "string" },
        },
        required: ["geohash"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_origin_place",
      description: "Add an origin place by Qloo entity id and name, then rebuild.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
        required: ["id", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "change_destination",
      description: "Change the destination city and rebuild.",
      parameters: {
        type: "object",
        properties: {
          destination: { type: "string" },
        },
        required: ["destination"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "answer",
      description: "Answer a question about the current brief without rebuilding.",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string" },
        },
        required: ["message"],
      },
    },
  },
];

async function rebuild(
  input: BriefInput,
  deps: Deps,
  previous: Brief,
  excludeGeohash?: string,
): Promise<Brief> {
  let last: Brief | null = null;
  for await (const event of runPipeline(input, deps)) {
    if (event.type === "brief") {
      last = {
        ...event.brief,
        id: previous.id,
        version: previous.version + 1,
      };
      if (excludeGeohash) {
        last = {
          ...last,
          rhyme: last.rhyme.filter((a) => a.geohash !== excludeGeohash),
          depart:
            last.depart?.geohash === excludeGeohash ? null : last.depart,
        };
      }
    }
    if (event.type === "error") {
      throw new CarryError(event.kind, event.message);
    }
  }
  if (!last) throw new CarryError("internal", "Refine rebuild produced no brief.");
  return last;
}

export async function refineBrief(
  previous: Brief,
  message: string,
  deps: Deps,
): Promise<RefineResult> {
  const client = createOpenAIClient();
  if (!client || !hasOpenAI()) {
    // Simple keyword refine without LLM
    const lower = message.toLowerCase();
    const nextInput = { ...previous.input };
    if (lower.includes("depart")) nextInput.mode = "depart";
    if (lower.includes("rhyme") || lower.includes("similar")) nextInput.mode = "rhyme";
    const brief = await rebuild(nextInput, deps, previous);
    return { kind: "brief", brief };
  }

  const model = openAIModel();
  let input: BriefInput = { ...previous.input, origin: [...previous.input.origin] };
  let excludeGeohash: string | undefined;
  let answerOnly: string | null = null;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You refine Carry relocation briefs. Prefer tools that change mode, destination, origin places, or exclude an area. Use answer for pure questions. Max 3 tool calls.",
    },
    {
      role: "user",
      content: JSON.stringify({
        message,
        brief: {
          destination: previous.input.destination,
          mode: previous.input.mode,
          continuity: previous.continuity,
          rhyme: previous.rhyme.map((a) => ({
            geohash: a.geohash,
            label: a.label,
          })),
          depart: previous.depart
            ? { geohash: previous.depart.geohash, label: previous.depart.label }
            : null,
          origin: previous.input.origin,
        },
      }),
    },
  ];

  for (let i = 0; i < 3; i++) {
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

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      if (msg.content) answerOnly = msg.content;
      break;
    }

    for (const call of msg.tool_calls) {
      if (call.type !== "function") continue;
      const args = JSON.parse(call.function.arguments || "{}") as Record<
        string,
        string
      >;
      let result = "ok";
      switch (call.function.name) {
        case "set_mode":
          if (args.mode === "rhyme" || args.mode === "depart") {
            input = { ...input, mode: args.mode };
          }
          break;
        case "exclude_area":
          excludeGeohash = args.geohash;
          break;
        case "add_origin_place":
          if (args.id && args.name && input.origin.length < 6) {
            input = {
              ...input,
              origin: [...input.origin, { id: args.id, name: args.name }],
            };
          }
          break;
        case "change_destination":
          if (args.destination) {
            input = { ...input, destination: args.destination };
          }
          break;
        case "answer":
          answerOnly = args.message ?? "";
          break;
        default:
          result = "unknown tool";
      }
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result,
      });
    }

    if (answerOnly) break;
  }

  if (answerOnly && !excludeGeohash && JSON.stringify(input) === JSON.stringify(previous.input)) {
    return { kind: "answer", message: answerOnly };
  }

  const brief = await rebuild(input, deps, previous, excludeGeohash);
  return { kind: "brief", brief };
}
