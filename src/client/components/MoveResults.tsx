"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  DestinationCompare,
  EvidenceEntity,
  MoveProject,
  RankedDestination,
  Tag,
} from "@/contracts";
import { humanLabelForTag } from "@/core/humanize-tags";
import { decodeCenter } from "@/core/geohash";
import { useGlobe } from "@/client/components/globe/GlobeContext";
import type { GlobeArc, GlobePoint } from "@/client/components/globe/GlobeCanvas";
import { RouteMap, type MapPoint } from "@/client/components/map/RouteMap";
import { BoardingPass } from "@/client/components/results/BoardingPass";
import { BoardingPassCarousel } from "@/client/components/results/BoardingPassCarousel";
import { ResultsSheet } from "@/client/components/results/ResultsSheet";
import { ResultsChat } from "@/client/components/results/ResultsChat";
import { useAppBarMeta } from "@/client/components/AppBarContext";
import { MAP_ENTER_ZOOM, fitPointOfView, type LatLon } from "@/client/lib/geo";
import { geocodePlace } from "@/client/lib/geocodePlace";
import { uniquifyDestinations } from "@/core/unique-destinations";

function coordsForDestination(d: RankedDestination): LatLon | null {
  if (typeof d.lat === "number" && typeof d.lon === "number") {
    return { lat: d.lat, lon: d.lon };
  }
  if (d.id.startsWith("geo:")) {
    try {
      const hash = d.id.slice(4).split("~")[0];
      return decodeCenter(hash);
    } catch {
      return null;
    }
  }
  return null;
}

function residenceCoords(move: MoveProject): LatLon | null {
  const r = move.residence;
  if (r && typeof r.lat === "number" && typeof r.lon === "number") {
    return { lat: r.lat, lon: r.lon };
  }
  return null;
}

const EMPTY_DESTINATIONS: RankedDestination[] = [];

export function MoveResults({ move: initialMove }: { move: MoveProject }) {
  const [move, setMove] = useState(initialMove);
  const destinations = useMemo(
    () =>
      uniquifyDestinations(move.result?.destinations ?? EMPTY_DESTINATIONS),
    [move.result?.destinations],
  );
  const { setConfig, reset } = useGlobe();

  const [selectedId, setSelectedId] = useState(
    () => uniquifyDestinations(initialMove.result?.destinations ?? [])[0]?.id ?? "",
  );
  const [expanded, setExpanded] = useState(false);
  const [compareB, setCompareB] = useState(
    () => uniquifyDestinations(initialMove.result?.destinations ?? [])[1]?.id ?? "",
  );
  const [diff, setDiff] = useState<DestinationCompare | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [mapCenter, setMapCenter] = useState<LatLon>({ lat: 20, lon: 0 });
  const [mapZoom, setMapZoom] = useState(MAP_ENTER_ZOOM);
  const [focusKey, setFocusKey] = useState(0);
  const [focusPointId, setFocusPointId] = useState<string | null>(null);

  useEffect(() => {
    setMove(initialMove);
  }, [initialMove]);

  useEffect(() => {
    setSource(residenceCoords(move));
    const nextCoords: Record<string, LatLon> = {};
    for (const d of destinations) {
      const c = coordsForDestination(d);
      if (c) nextCoords[d.id] = c;
    }
    setDestCoords(nextCoords);
  }, [move, destinations]);

  useEffect(() => {
    if (!destinations.some((d) => d.id === selectedId)) {
      setSelectedId(destinations[0]?.id ?? "");
    }
    if (compareB && !destinations.some((d) => d.id === compareB)) {
      setCompareB(destinations[1]?.id ?? destinations[0]?.id ?? "");
    }
  }, [destinations, selectedId, compareB]);

  const selected = useMemo(
    () => destinations.find((d) => d.id === selectedId) ?? destinations[0],
    [destinations, selectedId],
  );

  const sourceName = move.residence?.name ?? "Home";
  const sourceAddress = move.residence?.address;

  const [source, setSource] = useState<LatLon | null>(() => residenceCoords(move));
  const [destCoords, setDestCoords] = useState<Record<string, LatLon>>(() => {
    const initial: Record<string, LatLon> = {};
    for (const d of destinations) {
      const c = coordsForDestination(d);
      if (c) initial[d.id] = c;
    }
    return initial;
  });

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (!source) {
        const q =
          move.residence?.address || move.residence?.name || sourceName;
        const hit = await geocodePlace(q);
        if (!cancelled && hit) setSource(hit);
      }
      const missing = destinations.filter((d) => !destCoords[d.id]);
      if (missing.length === 0) return;
      const next: Record<string, LatLon> = { ...destCoords };
      await Promise.all(
        missing.map(async (d) => {
          const hit = await geocodePlace(d.address || d.locationQuery || d.label);
          if (hit) next[d.id] = hit;
        }),
      );
      if (!cancelled) setDestCoords(next);
    }
    void resolve();
    return () => {
      cancelled = true;
    };
    // Only re-resolve when the move identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [move.id]);

  const geoPoints = useMemo(() => {
    const pts: (LatLon & { id: string; label: string; kind: "source" | "destination" })[] =
      [];
    if (source) {
      pts.push({
        ...source,
        id: "residence",
        label: sourceName,
        kind: "source",
      });
    }
    for (const d of destinations) {
      const c = destCoords[d.id];
      if (c) {
        pts.push({
          ...c,
          id: d.id,
          label: d.label,
          kind: "destination",
        });
      }
    }
    return pts;
  }, [destinations, source, sourceName, destCoords]);

  const fitPov = useMemo(
    () => (geoPoints.length > 0 ? fitPointOfView(geoPoints) : null),
    [geoPoints],
  );

  const globePoints: GlobePoint[] = useMemo(
    () =>
      geoPoints.map((p) => ({
        id: p.id,
        lat: p.lat,
        lon: p.lon,
        label: p.label,
        color: p.kind === "source" ? "#38bdf8" : "#f59e0b",
      })),
    [geoPoints],
  );

  const globeArcs: GlobeArc[] = useMemo(() => {
    if (!source) return [];
    const arcs: GlobeArc[] = [];
    for (const d of destinations) {
      const end = destCoords[d.id];
      if (!end) continue;
      arcs.push({
        id: d.id,
        startLat: source.lat,
        startLng: source.lon,
        endLat: end.lat,
        endLng: end.lon,
        color: "#fbbf24",
      });
    }
    return arcs;
  }, [destinations, source, destCoords]);

  const mapPoints: MapPoint[] = useMemo(() => {
    const pts: MapPoint[] = [];
    if (source) {
      pts.push({
        ...source,
        id: "residence",
        kind: "source",
        label: sourceName,
        name: sourceName,
        address: sourceAddress,
      });
    }
    for (const d of destinations) {
      const c = destCoords[d.id];
      if (!c) continue;
      pts.push({
        ...c,
        id: d.id,
        kind: "destination",
        label: d.label,
        name: d.label,
        address: d.address || d.locationQuery,
        continuity: d.continuity,
        evidenceTags: d.matches.slice(0, 5).map((t) => t.name),
        distinctTags: d.mismatches.slice(0, 4).map((t) => t.name),
      });
    }
    // Nearby places for the open destination (sheet expand).
    if (expanded && selected) {
      const destC = destCoords[selected.id];
      selected.venues.forEach((v, i) => {
        const hasCoords =
          typeof v.lat === "number" && typeof v.lon === "number";
        const base = hasCoords
          ? { lat: v.lat!, lon: v.lon! }
          : destC
            ? destC
            : null;
        if (!base) return;
        pts.push({
          ...base,
          id: `venue:${v.id}:${i}`,
          kind: "venue",
          label: v.name,
          name: v.name,
          type: v.type,
          address: v.address,
          affinity: v.affinity,
          evidenceTags: v.evidenceTags,
          distinctTags: v.distinctTags,
        });
      });
    }
    return pts;
  }, [
    source,
    sourceName,
    sourceAddress,
    destinations,
    destCoords,
    expanded,
    selected,
  ]);

  const mapArcs = useMemo(() => {
    if (!source) return [];
    return destinations
      .map((d) => {
        const end = destCoords[d.id];
        if (!end) return null;
        return { id: d.id, start: source, end };
      })
      .filter((a): a is { id: string; start: LatLon; end: LatLon } => a != null);
  }, [destinations, source, destCoords]);

  function focusMap(center: LatLon, zoom: number, pointId?: string) {
    setMapCenter(center);
    setMapZoom(zoom);
    setFocusPointId(pointId ?? null);
    setFocusKey((k) => k + 1);
  }

  // Map only while the destination sheet is expanded; otherwise globe.
  const showMap = expanded;
  const showGlobe = !expanded;

  useEffect(() => {
    setConfig({
      interactive: showGlobe,
      autoRotate: false,
      capturePointer: showGlobe,
      visible: showGlobe,
      points: globePoints,
      arcs: globeArcs,
      ...(showGlobe && fitPov ? { pointOfView: fitPov } : {}),
    });
  }, [showGlobe, globePoints, globeArcs, fitPov, setConfig]);

  useEffect(() => {
    return () => reset();
  }, [reset]);

  async function runCompare() {
    if (!selected) return;
    setBusy(true);
    setCompareError(null);
    try {
      const res = await fetch(`/api/moves/${move.id}/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aId: selected.id, bId: compareB }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Compare failed");
      setDiff(json as DestinationCompare);
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : "Compare failed");
    } finally {
      setBusy(false);
    }
  }

  function openPass(id: string) {
    setSelectedId(id);
    setExpanded(true);
    const dest = destinations.find((d) => d.id === id);
    const c = destCoords[id] ?? (dest ? coordsForDestination(dest) : null);
    if (c) {
      focusMap(c, Math.max(mapZoom, 11.5), id);
    }
    const other = destinations.find((d) => d.id !== id);
    if (other) setCompareB(other.id);
    setDiff(null);
  }

  function viewVenue(venue: EvidenceEntity, index: number) {
    const destC = selected ? destCoords[selected.id] : null;
    const hasCoords =
      typeof venue.lat === "number" && typeof venue.lon === "number";
    const c = hasCoords
      ? { lat: venue.lat!, lon: venue.lon! }
      : destC;
    if (!c) return;
    focusMap(c, 14, `venue:${venue.id}:${index}`);
  }

  function closeSheet() {
    setExpanded(false);
  }

  const hasResults = Boolean(move.result && destinations.length > 0);
  const destinationSelected = expanded && Boolean(selected);

  const appBarMeta = useMemo(() => {
    if (!hasResults) return null;
    return (
      <div className="flex min-w-0 flex-wrap items-center justify-center gap-2">
        {destinationSelected && selected ? (
          <>
            <span className="truncate text-sm font-medium text-zinc-900">
              {sourceName} → {selected.label}
            </span>
            <a
              href={`/api/moves/${move.id}/pdf?destinationId=${encodeURIComponent(selected.id)}`}
              className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white"
            >
              Export to pdf
            </a>
          </>
        ) : (
          <a
            href={`/api/moves/${move.id}/pdf`}
            className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white"
          >
            Export to pdf
          </a>
        )}
        <Link
          href={`/app/moves/${move.id}`}
          className="rounded-md border border-zinc-300 px-3 py-1 text-xs"
        >
          Edit
        </Link>
      </div>
    );
  }, [hasResults, destinationSelected, sourceName, selected, move.id]);
  useAppBarMeta(appBarMeta);

  if (!hasResults) {
    return (
      <main className="mx-auto max-w-md px-4 py-24">
        <div className="rounded-2xl border border-white/40 bg-white/85 p-6 backdrop-blur-md">
          <p className="text-sm text-zinc-600">No results yet.</p>
          <Link
            href={`/app/moves/${move.id}`}
            className="mt-2 inline-block underline"
          >
            Back to wizard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="relative min-h-screen">
      {showMap && (
        <div className="pointer-events-auto fixed inset-0 z-[20]">
          <RouteMap
            points={mapPoints}
            arcs={mapArcs}
            center={mapCenter}
            zoom={mapZoom}
            focusKey={focusKey}
            focusPointId={focusPointId}
            sidePanels={expanded}
          />
        </div>
      )}

      <ResultsSheet
        expanded={expanded}
        onClose={closeSheet}
        peek={
          <BoardingPassCarousel
            sourceName={sourceName}
            sourceAddress={sourceAddress}
            passes={destinations.map((d) => ({
              id: d.id,
              destName: d.label,
              destAddress: d.address || d.locationQuery,
              continuity: d.continuity,
            }))}
            activeId={selectedId}
            onSelect={(id) => openPass(id)}
          />
        }
        chat={
          <ResultsChat
            moveId={move.id}
            destinationId={selected?.id}
            onMoveUpdated={(next) => {
              setMove(next);
              setDiff(null);
              const nextDests = next.result?.destinations ?? [];
              const prevIds = new Set(destinations.map((d) => d.id));
              const added = nextDests.filter((d) => !prevIds.has(d.id));
              const selectedGone =
                Boolean(selectedId) &&
                !nextDests.some((d) => d.id === selectedId);

              if (added.length === 1 && (selectedGone || selectedId)) {
                // Prefer the newly introduced destination after replace/add.
                setSelectedId(added[0].id);
                setExpanded(true);
              } else if (selectedGone && nextDests[0]) {
                setSelectedId(nextDests[0].id);
              }

              if (
                compareB &&
                !nextDests.some((d) => d.id === compareB)
              ) {
                setCompareB(
                  nextDests.find((d) => d.id !== (added[0]?.id ?? selectedId))
                    ?.id ??
                    nextDests[0]?.id ??
                    "",
                );
              }
            }}
          />
        }
      >
        {selected && (
          <div className="space-y-6">
            <BoardingPass
              sourceName={sourceName}
              sourceAddress={sourceAddress}
              destName={selected.label}
              destAddress={selected.address || selected.locationQuery}
              continuity={selected.continuity}
              compact={false}
            />
            <DestinationDetail
              destination={selected}
              onViewVenue={viewVenue}
            />
            <section className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4">
              <h2 className="text-sm font-semibold text-zinc-900">Compare to</h2>
              <select
                value={compareB}
                onChange={(e) => setCompareB(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                {destinations
                  .filter((d) => d.id !== selected.id)
                  .map((d, i) => (
                    <option key={`${d.id}::${i}`} value={d.id}>
                      {d.label}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                disabled={busy || !compareB || compareB === selected.id}
                onClick={() => runCompare()}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "Comparing…" : "Compare"}
              </button>
              {compareError && (
                <p className="text-sm text-red-600">{compareError}</p>
              )}
              {diff && <ComparePanel diff={diff} />}
            </section>
          </div>
        )}
      </ResultsSheet>
    </div>
  );
}

function DestinationDetail({
  destination,
  onViewVenue,
}: {
  destination: RankedDestination;
  onViewVenue: (venue: EvidenceEntity, index: number) => void;
}) {
  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-zinc-900">
            {destination.label}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-700">
            {destination.summary}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-semibold tabular-nums text-zinc-900">
            {destination.continuity}
          </p>
          <p className="text-[10px] uppercase text-zinc-500">continuity</p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-900">What to expect</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-zinc-700">
          {destination.expect.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-900">Places nearby</h3>
        <ul className="mt-2 space-y-2">
          {destination.venues.length === 0 && (
            <li className="text-sm text-zinc-500">None surfaced</li>
          )}
          {destination.venues.map((v, i) => (
            <li key={`${v.id}-${v.name}`}>
              <VenueCard venue={v} onView={() => onViewVenue(v, i)} />
            </li>
          ))}
        </ul>
      </div>

      <TasteSignalsPanel destination={destination} />
    </section>
  );
}

function VenueCard({
  venue,
  onView,
}: {
  venue: EvidenceEntity;
  onView: () => void;
}) {
  const affinityPct =
    typeof venue.affinity === "number"
      ? Math.round(Math.max(0, Math.min(1, venue.affinity)) * 100)
      : null;

  return (
    <details className="group rounded-md border border-zinc-200 bg-zinc-50 open:bg-white">
      <summary className="cursor-pointer list-none px-3 py-2 marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-900">{venue.name}</p>
            {venue.address && (
              <p className="mt-0.5 text-xs text-zinc-500">{venue.address}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {affinityPct != null && (
              <span className="rounded bg-zinc-200/80 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-700">
                {affinityPct}%
              </span>
            )}
            <button
              type="button"
              className="rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-[10px] font-medium text-zinc-700 hover:bg-zinc-50"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onView();
              }}
            >
              View
            </button>
          </div>
        </div>
      </summary>
      <div className="space-y-2 border-t border-zinc-200 px-3 py-2">
        {venue.evidenceTags && venue.evidenceTags.length > 0 && (
          <TagChips
            labels={venue.evidenceTags.slice(0, 4).map(humanLabelForTag)}
            tone="match"
          />
        )}
        {venue.distinctTags && venue.distinctTags.length > 0 && (
          <TagChips
            labels={venue.distinctTags.slice(0, 3).map(humanLabelForTag)}
            tone="miss"
          />
        )}
      </div>
    </details>
  );
}

function TasteSignalsPanel({ destination }: { destination: RankedDestination }) {
  return (
    <details className="rounded-md border border-zinc-200 bg-zinc-50/80 open:bg-white">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-zinc-800 marker:content-none [&::-webkit-details-marker]:hidden">
        Taste signals
      </summary>
      <div className="grid gap-3 border-t border-zinc-200 px-3 py-3 sm:grid-cols-2">
        <TagGroup title="Familiar" tags={destination.matches} tone="match" />
        <TagGroup title="Different" tags={destination.mismatches} tone="miss" />
      </div>
    </details>
  );
}

function TagGroup({
  title,
  tags,
  tone,
}: {
  title: string;
  tags: Tag[];
  tone: "match" | "miss";
}) {
  return (
    <div>
      <h4
        className={`text-[10px] font-semibold uppercase tracking-wide ${
          tone === "match" ? "text-emerald-800" : "text-amber-800"
        }`}
      >
        {title}
      </h4>
      {tags.length === 0 ? (
        <p className="mt-1 text-xs text-zinc-500">—</p>
      ) : (
        <TagChips
          labels={tags.slice(0, 6).map((t) => humanLabelForTag(t.name))}
          tone={tone}
        />
      )}
    </div>
  );
}

function TagChips({
  labels,
  tone,
}: {
  labels: string[];
  tone: "match" | "miss";
}) {
  return (
    <ul className="mt-1 flex flex-wrap gap-1">
      {labels.map((label) => (
        <li
          key={label}
          className={`rounded px-1.5 py-0.5 text-[11px] ${
            tone === "match"
              ? "bg-emerald-50 text-emerald-900"
              : "bg-amber-50 text-amber-900"
          }`}
        >
          {label}
        </li>
      ))}
    </ul>
  );
}

function ComparePanel({ diff }: { diff: DestinationCompare }) {
  return (
    <div className="space-y-3 border-t border-zinc-200 pt-3">
      <p className="text-sm text-zinc-700">
        {diff.a.label} {diff.a.continuity}/100
        {diff.scoreDelta === 0
          ? ` · matches ${diff.b.label}`
          : diff.scoreDelta > 0
            ? ` · closer than ${diff.b.label} (${diff.b.continuity})`
            : ` · farther than ${diff.b.label} (${diff.b.continuity})`}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-zinc-900">{diff.a.label}</p>
          <TagChips
            labels={diff.onlyA.slice(0, 5).map((t) => humanLabelForTag(t.name))}
            tone="miss"
          />
        </div>
        <div>
          <p className="text-xs font-medium text-zinc-900">{diff.b.label}</p>
          <TagChips
            labels={diff.onlyB.slice(0, 5).map((t) => humanLabelForTag(t.name))}
            tone="miss"
          />
        </div>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase text-zinc-500">
          Shared
        </p>
        <TagChips
          labels={diff.sharedMatches
            .slice(0, 6)
            .map((t) => humanLabelForTag(t.name))}
          tone="match"
        />
      </div>
    </div>
  );
}
