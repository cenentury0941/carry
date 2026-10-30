import { SignIn } from "@clerk/nextjs";
import { clerkConfigured } from "@/server/auth-public";
import { CenteredOverlay } from "@/client/components/CenteredOverlay";

export default function SignInPage() {
  if (!clerkConfigured()) {
    return (
      <CenteredOverlay maxWidth="md">
        <h1 className="text-2xl font-semibold tracking-tight">Carry</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Demo mode — Clerk is not configured.
        </p>
        <a
          className="mt-6 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          href="/app"
        >
          Continue
        </a>
      </CenteredOverlay>
    );
  }
  return (
    <CenteredOverlay maxWidth="md" className="flex justify-center bg-transparent p-0 shadow-none border-0 backdrop-blur-0">
      <SignIn fallbackRedirectUrl="/app" />
    </CenteredOverlay>
  );
}
