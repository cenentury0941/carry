"use client";

import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  Marker,
  Popup,
  AttributionControl,
  type StyleSpecification,
  type GeoJSONSource,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { greatCircle, type LatLon } from "@/client/lib/geo";
import { ensureMapLibreWorker } from "@/client/lib/maplibreWorker";
import { humanPlaceType } from "@/client/lib/placeType";
import { humanLabelForTag } from "@/core/humanize-tags";

export type MapPoint = LatLon & {
  id: string;
  label?: string;
  kind?: "source" | "destination" | "venue";
  name?: string;
  type?: string;
  address?: string;
  affinity?: number;
  continuity?: number;
  evidenceTags?: string[];
  distinctTags?: string[];
};

type Props = {
  points: MapPoint[];
  arcs: { id: string; start: LatLon; end: LatLon }[];
  center: LatLon;
  zoom: number;
  /** Increment to fly the camera to center/zoom (avoids fighting user pans). */
  focusKey?: number;
  /** Open the popup for this point id after markers render. */
  focusPointId?: string | null;
  /** Pad for left destination + right chat panels. */
  sidePanels?: boolean;
  className?: string;
};

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function chipRow(label: string, tags: string[] | undefined, tone: "match" | "miss") {
  if (!tags?.length) return "";
  const chips = tags
    .slice(0, 5)
    .map((t) => {
      const text = escapeHtml(humanLabelForTag(t));
      const cls =
        tone === "match"
          ? "bg-emerald-50 text-emerald-900"
          : "bg-amber-50 text-amber-900";
      return `<span class="inline-block rounded px-1.5 py-0.5 text-[10px] ${cls}">${text}</span>`;
    })
    .join("");
  return `<div class="mt-2">
    <p class="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">${label}</p>
    <div class="mt-1 flex flex-wrap gap-1">${chips}</div>
  </div>`;
}

function popupHtml(p: MapPoint): string {
  const title = escapeHtml(p.name || p.label || "Place");
  const kindLabel =
    p.kind === "source"
      ? "Home"
      : p.kind === "destination"
        ? "Destination"
        : "Nearby place";
  const type = humanPlaceType(p.type);
  const affinity =
    typeof p.affinity === "number"
      ? `${Math.round(Math.max(0, Math.min(1, p.affinity)) * 100)}% fit`
      : null;
  const continuity =
    typeof p.continuity === "number" ? `Continuity ${p.continuity}` : null;

  return `<div class="carry-map-popup min-w-[12rem] max-w-[16rem]">
    <p class="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">${kindLabel}</p>
    <p class="mt-0.5 text-sm font-semibold leading-snug text-zinc-900">${title}</p>
    ${type ? `<p class="mt-1 text-xs text-zinc-600">${escapeHtml(type)}</p>` : ""}
    ${p.address ? `<p class="mt-1 text-[11px] leading-snug text-zinc-500">${escapeHtml(p.address)}</p>` : ""}
    <div class="mt-2 flex flex-wrap gap-1.5">
      ${affinity ? `<span class="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-zinc-800">${affinity}</span>` : ""}
      ${continuity ? `<span class="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">${continuity}</span>` : ""}
    </div>
    ${chipRow("Shared tastes", p.evidenceTags, "match")}
    ${chipRow("Stronger here", p.distinctTags, "miss")}
  </div>`;
}

function markerEl(p: MapPoint): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "carry-map-marker flex cursor-pointer flex-col items-center";

  const pin = document.createElement("div");
  const label = document.createElement("div");
  label.className =
    "mt-1 max-w-[7.5rem] truncate rounded-md border border-white/80 bg-white/95 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-tight text-zinc-800 shadow";
  label.textContent = p.name || p.label || "";

  if (p.kind === "source") {
    pin.className =
      "h-3.5 w-3.5 rounded-full border-2 border-white bg-sky-500 shadow-md ring-2 ring-sky-200";
  } else if (p.kind === "destination") {
    pin.className =
      "flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-[10px] font-bold text-white shadow-md";
    pin.textContent = "D";
  } else {
    pin.className =
      "flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-[9px] font-bold text-white shadow-md";
    pin.textContent = "P";
  }

  wrap.appendChild(pin);
  wrap.appendChild(label);
  return wrap;
}

/** Nudge overlapping venue pins so they stay clickable. */
function withJitter(points: MapPoint[]): MapPoint[] {
  const seen = new Map<string, number>();
  return points.map((p) => {
    const key = `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    if (n === 0 || p.kind !== "venue") return p;
    const angle = (n * 2.4) % (Math.PI * 2);
    const dist = 0.00035 * n;
    return {
      ...p,
      lat: p.lat + Math.cos(angle) * dist,
      lon: p.lon + Math.sin(angle) * dist,
    };
  });
}

export function RouteMap({
  points,
  arcs,
  center,
  zoom,
  focusKey = 0,
  focusPointId = null,
  sidePanels = false,
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersByIdRef = useRef<Map<string, Marker>>(new Map());
  const sidePanelsRef = useRef(sidePanels);
  sidePanelsRef.current = sidePanels;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    ensureMapLibreWorker();

    const map = new MapLibreMap({
      container: el,
      style: STYLE,
      center: [center.lon, center.lat],
      zoom,
      attributionControl: false,
    });
    map.addControl(new AttributionControl({ compact: true }), "bottom-left");

    map.on("load", () => {
      map.addSource("arcs", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "arcs-line",
        type: "line",
        source: "arcs",
        paint: {
          "line-color": "#f59e0b",
          "line-width": 2.5,
          "line-opacity": 0.85,
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
      });
    });

    mapRef.current = map;
    return () => {
      markersByIdRef.current.forEach((m) => m.remove());
      markersByIdRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const features = arcs.map((a) => ({
        type: "Feature" as const,
        properties: { id: a.id },
        geometry: {
          type: "LineString" as const,
          coordinates: greatCircle(a.start, a.end),
        },
      }));
      const src = map.getSource("arcs") as GeoJSONSource | undefined;
      src?.setData({ type: "FeatureCollection", features });
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [arcs]);

  function closeOtherPopups(exceptId?: string | null) {
    markersByIdRef.current.forEach((marker, id) => {
      if (exceptId && id === exceptId) return;
      const popup = marker.getPopup();
      if (popup?.isOpen()) marker.togglePopup();
    });
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersByIdRef.current.forEach((m) => m.remove());
    markersByIdRef.current.clear();

    const placed = withJitter(points);
    for (const p of placed) {
      const el = markerEl(p);
      const popup = new Popup({
        offset: 18,
        closeButton: true,
        maxWidth: "280px",
        className: "carry-maplibre-popup",
        // Keep popup events on the marker layer, not the map drag handler.
        focusAfterOpen: false,
      }).setHTML(popupHtml(p));

      popup.on("open", () => {
        closeOtherPopups(p.id);
      });

      const marker = new Marker({ element: el, anchor: "bottom" })
        .setLngLat([p.lon, p.lat])
        .setPopup(popup)
        .addTo(map);

      markersByIdRef.current.set(p.id, marker);
    }
  }, [points]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || focusKey < 1) return;
    const bias = sidePanelsRef.current;
    const side = Math.max(window.innerWidth * 0.3 + 24, 300);
    map.flyTo({
      center: [center.lon, center.lat],
      zoom,
      duration: 700,
      padding: bias
        ? { top: 88, bottom: 40, left: side, right: side }
        : { top: 88, bottom: 140, left: 40, right: 40 },
      essential: true,
    });
  }, [focusKey, center.lat, center.lon, zoom]);

  useEffect(() => {
    if (!focusPointId) {
      closeOtherPopups(null);
      return;
    }
    closeOtherPopups(focusPointId);
    const marker = markersByIdRef.current.get(focusPointId);
    if (!marker) return;
    const popup = marker.getPopup();
    if (popup && !popup.isOpen()) marker.togglePopup();
  }, [focusPointId, points]);

  return (
    <div
      ref={containerRef}
      className={`h-full w-full touch-manipulation ${className}`}
    />
  );
}
