import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { MoveChatBody } from "@/contracts";
import { AuthRequiredError, requireUserId } from "@/server/auth";
import { createDeps } from "@/server/deps";
import { getMoveForUser, saveMove } from "@/server/move-store";
import { chatMoveAgent } from "@/core/move-agent";
import { CarryError } from "@/core/deps";
import { clientIp, limitRefines } from "@/server/ratelimit";
import { childLog } from "@/server/log";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const requestId = nanoid(8);
  const log = childLog(requestId);
  const { id } = await ctx.params;

  let userId: string;
  try {
    userId = await requireUserId();
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return NextResponse.json(
        { kind: "error", message: "Unauthorized" },
        { status: 401 },
      );
    }
    throw err;
  }

  const ip = clientIp(req.headers);
  const rl = await limitRefines(ip);
  if (!rl.success) {
    return NextResponse.json(
      { kind: "error", message: "Rate limit exceeded." },
      { status: 429 },
    );
  }

  const move = await getMoveForUser(id, userId);
  if (!move) {
    return NextResponse.json(
      { kind: "error", message: "Move not found." },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { kind: "error", message: "Invalid JSON." },
      { status: 400 },
    );
  }
  const parsed = MoveChatBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { kind: "error", message: "message is required." },
      { status: 400 },
    );
  }

  try {
    const deps = createDeps(requestId);
    const result = await chatMoveAgent(move, parsed.data.message, deps, {
      destinationId: parsed.data.destinationId,
      history: parsed.data.history,
    });
    if (result.kind === "move") {
      await saveMove(result.move);
      log.info({ moveId: id }, "move chat rebuilt");
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CarryError) {
      const status =
        err.kind === "invalid_input"
          ? 400
          : err.kind === "no_data"
            ? 422
            : err.kind === "upstream"
              ? 502
              : 500;
      return NextResponse.json(
        { kind: "error", message: err.message },
        { status },
      );
    }
    const detail = err instanceof Error ? err.message : String(err);
    log.error({ err: detail }, "move chat failed");
    const message = /\b429\b|credits|billing|quota/i.test(detail)
      ? "OpenAI has no credits left. Questions still work from Qloo data after refresh — top up billing, or ask again."
      : detail.includes("API key") || detail.includes("401")
        ? "OpenAI is not configured correctly."
        : "Chat failed. Try a shorter question, or say “rebuild” to refresh matches.";
    return NextResponse.json({ kind: "error", message }, { status: 500 });
  }
}
