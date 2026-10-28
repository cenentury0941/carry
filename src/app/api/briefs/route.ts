import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { BriefInput } from "@/contracts";
import { runPipeline } from "@/core/pipeline";
import { createDeps } from "@/server/deps";
import { saveBrief } from "@/server/store";
import { clientIp, limitBriefs } from "@/server/ratelimit";
import { childLog } from "@/server/log";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const requestId = nanoid(8);
  const log = childLog(requestId);
  const ip = clientIp(req.headers);
  const rl = await limitBriefs(ip);
  if (!rl.success) {
    return new Response(
      JSON.stringify({
        type: "error",
        kind: "invalid_input",
        message: "Rate limit exceeded. Try again later.",
      }) + "\n",
      { status: 429, headers: { "Content-Type": "application/x-ndjson" } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({
        type: "error",
        kind: "invalid_input",
        message: "Invalid JSON body.",
      }) + "\n",
      { status: 400, headers: { "Content-Type": "application/x-ndjson" } },
    );
  }

  const parsed = BriefInput.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        type: "error",
        kind: "invalid_input",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      }) + "\n",
      { status: 400, headers: { "Content-Type": "application/x-ndjson" } },
    );
  }

  const deps = createDeps(requestId);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runPipeline(parsed.data, deps)) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          if (event.type === "brief") {
            await saveBrief(event.brief);
            log.info({ briefId: event.brief.id }, "brief saved");
          }
        }
      } catch (err) {
        log.error(
          { err: err instanceof Error ? err.message : String(err) },
          "stream failed",
        );
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "error",
              kind: "internal",
              message: "Stream failed.",
            }) + "\n",
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Request-Id": requestId,
    },
  });
}
