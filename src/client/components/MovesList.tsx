"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MoveProject } from "@/contracts";

type Props = {
  initialMoves: MoveProject[];
};

export function MovesList({ initialMoves }: Props) {
  const router = useRouter();
  const [moves, setMoves] = useState(initialMoves);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onDelete(id: string) {
    if (deletingId) return;
    if (!window.confirm("Delete this move? This cannot be undone.")) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/moves/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message || "Delete failed");
      }
      setMoves((prev) => prev.filter((m) => m.id !== id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  if (moves.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white/60 p-6 text-center">
        <p className="text-sm text-zinc-600">No moves yet.</p>
        <Link
          href="/app/moves/new"
          className="mt-3 inline-block text-sm font-medium text-zinc-900 underline"
        >
          Start your first move
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <ul className="space-y-2">
        {moves.map((m) => {
          const href =
            m.status === "ready"
              ? `/app/moves/${m.id}/results`
              : `/app/moves/${m.id}`;
          const title = `${m.residence?.name ?? "Untitled move"}${
            m.target
              ? m.target.kind === "ambiguous"
                ? ` → ${m.target.region}`
                : ` → ${m.target.places.length} targets`
              : ""
          }`;
          return (
            <li
              key={m.id}
              className="flex items-stretch gap-2 rounded-md border border-zinc-200 bg-white/70"
            >
              <Link
                href={href}
                className="flex min-w-0 flex-1 items-center justify-between px-4 py-3 hover:bg-zinc-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-900">{title}</p>
                  <p
                    className="text-xs text-zinc-500"
                    suppressHydrationWarning
                  >
                    {m.status} ·{" "}
                    {new Date(m.updatedAt).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </p>
                </div>
                <span className="ml-3 shrink-0 text-xs uppercase tracking-wide text-zinc-500">
                  {m.status}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => onDelete(m.id)}
                disabled={deletingId === m.id}
                className="shrink-0 border-l border-zinc-200 px-3 text-xs font-medium text-zinc-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                aria-label={`Delete ${title}`}
              >
                {deletingId === m.id ? "…" : "Delete"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
