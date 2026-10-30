import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { AuthRequiredError, requireUserId } from "@/server/auth";
import { createMove, listMovesForUser } from "@/server/move-store";

export const maxDuration = 30;

export async function GET() {
  try {
    const userId = await requireUserId();
    const moves = await listMovesForUser(userId);
    return NextResponse.json({ moves });
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ message: "Failed to list moves" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const userId = await requireUserId();
    const move = await createMove(userId, nanoid(10));
    return NextResponse.json(move, { status: 201 });
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ message: "Failed to create move" }, { status: 500 });
  }
}
