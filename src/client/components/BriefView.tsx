"use client";

import { useQueryState } from "nuqs";
import type { Brief } from "@/contracts";
import { AreaCard } from "./AreaCard";
import { RefineBox } from "./RefineBox";

export function BriefView({
  brief,
  onUpdated,
}: {
  brief: Brief;
  onUpdated?: (brief: Brief) => void;
}) {
  const [area, setArea] = useQueryState("area");
  const selected =
    brief.rhyme.find((a) => a.geohash === area) ??
    (brief.depart?.geohash === area ? brief.depart : null) ??
    brief.rhyme[0] ??
    brief.depart;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <header className="space-y-3">
        <p className="text-sm text-zinc-500">
          {brief.input.destination} · {brief.input.mode} · v{brief.version}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          {brief.copy.headline}
        </h1>
        <p className="text-lg text-zinc-700">{brief.copy.summary}</p>
        <div className="inline-flex items-baseline gap-2 rounded-md border border-zinc-200 bg-white px-4 py-2">
          <span className="text-3xl font-semibold text-zinc-900">
            {brief.continuity}
          </span>
          <span className="text-sm text-zinc-500">continuity / 100</span>
        </div>
        <p className="text-xs text-zinc-500">
          Continuity is Carry&apos;s own metric from Qloo affinity, shared tags,
          and venue coverage — a taste signal, not a prediction.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Rhyme areas
        </h2>
        <p className="text-sm text-zinc-700">{brief.copy.rhymeNote}</p>
        <div className="space-y-3">
          {brief.rhyme.map((a) => (
            <AreaCard
              key={a.geohash}
              area={a}
              kind="rhyme"
              selected={selected?.geohash === a.geohash}
              onSelect={() => setArea(a.geohash)}
            />
          ))}
        </div>
      </section>

      {brief.depart && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Depart area
          </h2>
          {brief.copy.departNote && (
            <p className="text-sm text-zinc-700">{brief.copy.departNote}</p>
          )}
          <AreaCard
            area={brief.depart}
            kind="depart"
            selected={selected?.geohash === brief.depart.geohash}
            onSelect={() => setArea(brief.depart!.geohash)}
          />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          First week
        </h2>
        <ul className="space-y-3">
          {brief.firstWeek.map((item) => (
            <li
              key={`${item.day}-${item.title}`}
              className="rounded-lg border border-zinc-200 bg-white p-4"
            >
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                {item.day}
              </p>
              <p className="font-medium text-zinc-900">{item.title}</p>
              <p className="mt-1 text-sm text-zinc-600">{item.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Origin places
        </h2>
        <p className="text-sm text-zinc-600">
          {brief.input.origin.map((o) => o.name).join(" · ")}
        </p>
      </section>

      <RefineBox brief={brief} onUpdated={onUpdated} />
    </div>
  );
}
