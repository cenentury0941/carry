import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { AuthRequiredError, requireUserId } from "@/server/auth";
import { getMoveForUser } from "@/server/move-store";
import { MovePdfDocument } from "@/server/pdf/MovePdfDocument";

export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    const move = await getMoveForUser(id, userId);
    if (!move?.result?.destinations?.length) {
      return NextResponse.json({ message: "No results" }, { status: 404 });
    }

    const destId = req.nextUrl.searchParams.get("destinationId");
    const focus = destId
      ? (move.result.destinations.find((d) => d.id === destId) ?? null)
      : null;

    if (destId && !focus) {
      return NextResponse.json(
        { message: "Destination not found" },
        { status: 404 },
      );
    }

    const doc = createElement(MovePdfDocument, { move, focus });
    const buffer = await renderToBuffer(
      // react-pdf Document typing vs React 19 element mismatch
      doc as Parameters<typeof renderToBuffer>[0],
    );

    const safeName = focus
      ? focus.label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 40)
      : "all-destinations";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="carry-${safeName || "brief"}.pdf"`,
      },
    });
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ message: "PDF failed" }, { status: 500 });
  }
}
