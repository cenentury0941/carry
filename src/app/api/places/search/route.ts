import { NextRequest, NextResponse } from "next/server";
import { PlaceSearchQuery } from "@/contracts";
import { searchPlaces } from "@/server/qloo/endpoints";
import { clientIp, limitBriefs } from "@/server/ratelimit";
import { childLog } from "@/server/log";
import { nanoid } from "nanoid";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const requestId = nanoid(8);
  const log = childLog(requestId);
  const ip = clientIp(req.headers);
  const rl = await limitBriefs(ip); // soft shared limit for search spam
  if (!rl.success) {
    return NextResponse.json(
      { kind: "invalid_input", message: "Rate limit exceeded." },
      { status: 429 },
    );
  }

  const parsed = PlaceSearchQuery.safeParse({
    q: req.nextUrl.searchParams.get("q") ?? "",
    take: req.nextUrl.searchParams.get("take") ?? 8,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { kind: "invalid_input", message: "Query q is required." },
      { status: 400 },
    );
  }

  try {
    const results = await searchPlaces(parsed.data.q, parsed.data.take);
    return NextResponse.json({ results });
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "place search failed",
    );
    return NextResponse.json(
      { kind: "upstream", message: "Place search failed." },
      { status: 502 },
    );
  }
}
