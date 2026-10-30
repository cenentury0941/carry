import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isProtected = createRouteMatcher(["/app(.*)", "/api/moves(.*)"]);

function clerkConfigured() {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return Boolean(
    pk &&
      process.env.CLERK_SECRET_KEY &&
      !pk.includes("placeholder"),
  );
}

const clerk = clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) {
    await auth.protect();
  }
});

export default function middleware(req: NextRequest, event: unknown) {
  if (!clerkConfigured()) {
    return NextResponse.next();
  }
  // @ts-expect-error Clerk middleware event typing varies by version
  return clerk(req, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
