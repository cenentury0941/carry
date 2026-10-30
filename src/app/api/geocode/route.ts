import { NextRequest, NextResponse } from "next/server";
import { PlaceSearchQuery } from "@/contracts";
import { searchPhoton } from "@/server/photon";
import { clientIp, limitSearch } from "@/server/ratelimit";
import { childLog } from "@/server/log";
import { nanoid } from "nanoid";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const requestId = nanoid(8);
  const log = childLog(requestId);
  const ip = clientIp(req.headers);
  const rl = await limitSearch(ip);
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
    const results = await searchPhoton(parsed.data.q, parsed.data.take);
    return NextResponse.json({ results });
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "geocode failed",
    );
    return NextResponse.json(
      { kind: "upstream", message: "Geocode failed." },
      { status: 502 },
    );
  }
}
