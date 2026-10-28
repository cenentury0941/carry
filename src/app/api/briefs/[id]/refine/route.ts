import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { RefineInput } from "@/contracts";
import { refineBrief } from "@/core/agent";
import { createDeps } from "@/server/deps";
import { getBrief, saveBrief } from "@/server/store";
import { clientIp, limitRefines } from "@/server/ratelimit";
import { childLog } from "@/server/log";
import { CarryError } from "@/core/deps";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const requestId = nanoid(8);
  const log = childLog(requestId);
  const { id } = await ctx.params;
  const ip = clientIp(req.headers);
  const rl = await limitRefines(ip);
  if (!rl.success) {
    return NextResponse.json(
      { kind: "invalid_input", message: "Rate limit exceeded." },
      { status: 429 },
    );
  }

  const previous = await getBrief(id);
  if (!previous) {
    return NextResponse.json(
      { kind: "no_data", message: "Brief not found." },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { kind: "invalid_input", message: "Invalid JSON." },
      { status: 400 },
    );
  }
  const parsed = RefineInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { kind: "invalid_input", message: "message is required." },
      { status: 400 },
    );
  }

  try {
    const deps = createDeps(requestId);
    const result = await refineBrief(previous, parsed.data.message, deps);
    if (result.kind === "brief") {
      await saveBrief(result.brief);
      log.info({ briefId: result.brief.id, version: result.brief.version }, "refined");
      return NextResponse.json(result);
    }
    if (result.kind === "answer") {
      return NextResponse.json(result);
    }
    return NextResponse.json(
      { kind: "internal", message: result.message },
      { status: 500 },
    );
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
        { kind: err.kind, message: err.message },
        { status },
      );
    }
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "refine failed",
    );
    return NextResponse.json(
      { kind: "internal", message: "Refine failed." },
      { status: 500 },
    );
  }
}
