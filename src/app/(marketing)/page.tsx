import Link from "next/link";
import { clerkConfigured } from "@/server/auth-public";
import { CenteredOverlay } from "@/client/components/CenteredOverlay";

export default function MarketingPage() {
  const authOn = clerkConfigured();
  return (
    <CenteredOverlay>
      <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        Carry
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
        Where do you plan on moving to?
      </h1>
      <p className="mt-3 text-sm text-zinc-600">
        Rank destinations by cultural fit — powered by Qloo.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={authOn ? "/sign-in" : "/app"}
          className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white"
        >
          {authOn ? "Sign in" : "Open app"}
        </Link>
        {authOn && (
          <Link
            href="/sign-up"
            className="rounded-md border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-900"
          >
            Create account
          </Link>
        )}
      </div>
    </CenteredOverlay>
  );
}
