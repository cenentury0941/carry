"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { useAppBar } from "./AppBarContext";

type Props = {
  authOn: boolean;
};

export function AppBar({ authOn }: Props) {
  const { meta } = useAppBar();

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 px-4 pt-3">
      <div className="pointer-events-auto mx-auto grid max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-white/40 bg-white/90 px-4 py-2.5 shadow-lg backdrop-blur-md">
        <div className="justify-self-start">
          <Link href="/app" className="text-sm font-semibold text-zinc-900">
            Carry
          </Link>
        </div>

        <div className="min-w-0 justify-self-center">
          {meta}
        </div>

        <div className="flex shrink-0 items-center justify-self-end gap-3">
          <Link
            href="/app/moves/new"
            className="text-sm text-zinc-600 hover:text-zinc-900"
          >
            New move
          </Link>
          {authOn ? (
            <UserButton />
          ) : (
            <span className="text-xs text-zinc-500">Demo user</span>
          )}
        </div>
      </div>
    </header>
  );
}
