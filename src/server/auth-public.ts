/** Client-safe check — publishable key only. */
export function clerkConfigured(): boolean {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return Boolean(pk && !pk.includes("placeholder"));
}
