import { auth } from "@clerk/nextjs/server";

/** Demo user when Clerk keys are not configured (local / CI). */
export const DEMO_USER_ID = "demo-user";

export function clerkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY &&
      !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes("placeholder"),
  );
}

/**
 * Returns the authenticated Clerk user id, or demo-user when Clerk is unset.
 * Throws Response-compatible error shape is left to callers.
 */
export async function requireUserId(): Promise<string> {
  if (!clerkConfigured()) {
    return process.env.CARRY_DEMO_USER_ID || DEMO_USER_ID;
  }
  const session = await auth();
  if (!session.userId) {
    throw new AuthRequiredError();
  }
  return session.userId;
}

export class AuthRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthRequiredError";
  }
}
