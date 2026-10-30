"use client";

import { setWorkerUrl } from "maplibre-gl";

let configured = false;

/** Point MapLibre at same-origin workers (Next/Turbopack cannot resolve bundled workers). */
export function ensureMapLibreWorker() {
  if (configured || typeof window === "undefined") return;
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
  configured = true;
}
