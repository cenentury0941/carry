"use client";

import dynamic from "next/dynamic";
import type { GlobeArc, GlobePoint, GlobePov } from "./GlobeCanvas";

const GlobeCanvas = dynamic(
  () => import("./GlobeCanvas").then((m) => m.GlobeCanvas),
  { ssr: false },
);

type Props = {
  interactive?: boolean;
  autoRotate?: boolean;
  points?: GlobePoint[];
  arcs?: GlobeArc[];
  pointOfView?: GlobePov | null;
  onAltitudeChange?: (altitude: number, lat: number, lng: number) => void;
  /** When false, canvas ignores pointer events so overlays stay clickable. */
  capturePointer?: boolean;
};

/** Full-viewport decorative (or interactive) globe behind page content. */
export function GlobeBackground({
  interactive = false,
  autoRotate = true,
  points,
  arcs,
  pointOfView,
  onAltitudeChange,
  capturePointer = false,
}: Props) {
  return (
    <div
      aria-hidden={!interactive}
      className={`fixed inset-0 z-0 overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950 ${
        capturePointer ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      <div className="absolute inset-0 opacity-90">
        <GlobeCanvas
          interactive={interactive}
          autoRotate={autoRotate}
          points={points}
          arcs={arcs}
          pointOfView={pointOfView}
          onAltitudeChange={onAltitudeChange}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-slate-900/30" />
    </div>
  );
}
