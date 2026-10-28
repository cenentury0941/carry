"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Brief } from "@/contracts";

export function RefineBox({
  brief,
  onUpdated,
}: {
  brief: Brief;
  onUpdated?: (brief: Brief) => void;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch(`/api/briefs/${brief.id}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "Refine failed");
        return;
      }
      if (json.kind === "answer") {
        setAnswer(json.message);
      } else if (json.kind === "brief") {
        queryClient.setQueryData(["brief", brief.id], json.brief);
        onUpdated?.(json.brief as Brief);
        setMessage("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refine failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Refine
      </h2>
      <p className="text-sm text-zinc-600">
        Try “switch to depart”, “change destination to Seattle”, or ask why an
        area scored high.
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
        placeholder="What should change?"
      />
      <button
        type="submit"
        disabled={busy || !message.trim()}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? "Working…" : "Refine brief"}
      </button>
      {answer && <p className="text-sm text-zinc-700">{answer}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
