import { NextRequest, NextResponse } from "next/server";
import { getBrief } from "@/server/store";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const brief = await getBrief(id);
  if (!brief) {
    return NextResponse.json(
      { kind: "no_data", message: "Brief not found." },
      { status: 404 },
    );
  }
  return NextResponse.json(brief);
}
