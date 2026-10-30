import { NextRequest, NextResponse } from "next/server";
import { PatchMoveBody } from "@/contracts";
import { AuthRequiredError, requireUserId } from "@/server/auth";
import { deleteMove, getMoveForUser, patchMove } from "@/server/move-store";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    const move = await getMoveForUser(id, userId);
    if (!move) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
    return NextResponse.json(move);
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ message: "Failed" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = PatchMoveBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }
    const move = await patchMove(id, userId, parsed.data);
    if (!move) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
    return NextResponse.json(move);
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ message: "Failed" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    const ok = await deleteMove(id, userId);
    if (!ok) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ message: "Failed" }, { status: 500 });
  }
}
