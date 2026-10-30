import { NextRequest } from "next/server";
import { AuthRequiredError, requireUserId } from "@/server/auth";
import { createDeps } from "@/server/deps";
import {
  getMoveForUser,
  saveMove,
  setMoveStatus,
} from "@/server/move-store";
import { runMovePipeline } from "@/core/move-pipeline";
import { nanoid } from "nanoid";
import { childLog } from "@/server/log";

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const requestId = nanoid(8);
  const log = childLog(requestId);
  const encoder = new TextEncoder();

  let userId: string;
  try {
    userId = await requireUserId();
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return new Response(
        JSON.stringify({
          type: "error",
          kind: "invalid_input",
          message: "Unauthorized",
        }) + "\n",
        { status: 401, headers: { "Content-Type": "application/x-ndjson" } },
      );
    }
    throw err;
  }

  const { id } = await ctx.params;
  const move = await getMoveForUser(id, userId);
  if (!move) {
    return new Response(
      JSON.stringify({
        type: "error",
        kind: "no_data",
        message: "Move not found",
      }) + "\n",
      { status: 404, headers: { "Content-Type": "application/x-ndjson" } },
    );
  }

  if (!move.residence || !move.target || !move.tastes) {
    return new Response(
      JSON.stringify({
        type: "error",
        kind: "invalid_input",
        message: "Complete residence, targets, and tastes before running.",
      }) + "\n",
      { status: 400, headers: { "Content-Type": "application/x-ndjson" } },
    );
  }

  await setMoveStatus(id, userId, "running");
  const deps = createDeps(requestId);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runMovePipeline(move, deps)) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          if (event.type === "move") {
            await saveMove(event.move);
            log.info({ moveId: event.move.id }, "move ready");
          }
          if (event.type === "error") {
            await setMoveStatus(id, userId, "error", event.message);
          }
        }
      } catch (err) {
        log.error(
          { err: err instanceof Error ? err.message : String(err) },
          "run stream failed",
        );
        await setMoveStatus(id, userId, "error", "Stream failed");
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
