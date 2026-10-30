import { NextRequest, NextResponse } from "next/server";
import { CompareBody, DestinationCompare, type Tag } from "@/contracts";
import { AuthRequiredError, requireUserId } from "@/server/auth";
import { getMoveForUser } from "@/server/move-store";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    const move = await getMoveForUser(id, userId);
    if (!move?.result) {
      return NextResponse.json({ message: "No results" }, { status: 404 });
    }
    const body = CompareBody.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ message: "aId and bId required" }, { status: 400 });
    }
    const a = move.result.destinations.find((d) => d.id === body.data.aId);
    const b = move.result.destinations.find((d) => d.id === body.data.bId);
    if (!a || !b) {
      return NextResponse.json({ message: "Destination not found" }, { status: 404 });
    }

    const aIds = new Set(a.matches.map((t) => t.id));
    const bIds = new Set(b.matches.map((t) => t.id));
    const sharedMatches: Tag[] = a.matches.filter((t) => bIds.has(t.id));
    const onlyA = a.matches.filter((t) => !bIds.has(t.id));
    const onlyB = b.matches.filter((t) => !aIds.has(t.id));

    const payload: DestinationCompare = {
      a,
      b,
      sharedMatches,
      onlyA,
      onlyB,
      scoreDelta: a.score - b.score,
    };
    return NextResponse.json(payload);
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ message: "Compare failed" }, { status: 500 });
  }
}
