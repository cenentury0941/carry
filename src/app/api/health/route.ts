import { NextResponse } from "next/server";
import { hasOpenAI, hasQloo, hasRedis } from "@/server/env";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: hasQloo(),
    qloo: hasQloo(),
    redis: hasRedis(),
    openai: hasOpenAI(),
  });
}
