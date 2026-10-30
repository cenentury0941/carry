"use client";

import { useEffect, useMemo, useRef } from "react";
import { polarTiltedRoute, type LatLon } from "@/client/lib/geo";

export type GlobePoint = LatLon & {
  id: string;
  label?: string;
  color?: string;
};

export type GlobeArc = {
  id: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color?: string;
};

export type GlobePov = {
  lat: number;
  lng: number;
  altitude: number;
};

type Props = {
  interactive?: boolean;
  autoRotate?: boolean;
  points?: GlobePoint[];
  arcs?: GlobeArc[];
  pointOfView?: GlobePov | null;
  onAltitudeChange?: (altitude: number, lat: number, lng: number) => void;
  className?: string;
};

type GlobeInstance = {
  (el: HTMLElement): GlobeInstance;
  width: (n: number) => GlobeInstance;
  height: (n: number) => GlobeInstance;
  globeImageUrl: (url: string) => GlobeInstance;
  backgroundColor: (c: string) => GlobeInstance;
  showAtmosphere: (v: boolean) => GlobeInstance;
  atmosphereColor: (c: string) => GlobeInstance;
  pointsData: (d: unknown[]) => GlobeInstance;
  pointLat: (a: string | ((d: GlobePoint) => number)) => GlobeInstance;
  pointLng: (a: string | ((d: GlobePoint) => number)) => GlobeInstance;
  pointAltitude: (a: number | ((d: GlobePoint) => number)) => GlobeInstance;
  pointRadius: (a: number | ((d: GlobePoint) => number)) => GlobeInstance;
  pointColor: (a: string | ((d: GlobePoint) => string)) => GlobeInstance;
  pointLabel: (a: string | ((d: GlobePoint) => string)) => GlobeInstance;
  pathsData: (d: unknown[]) => GlobeInstance;
  pathPoints: (
    a: string | ((d: { coords: [number, number, number][] }) => [number, number, number][]),
  ) => GlobeInstance;
  pathPointLat: (a: number | ((p: [number, number, number]) => number)) => GlobeInstance;
  pathPointLng: (a: number | ((p: [number, number, number]) => number)) => GlobeInstance;
  pathPointAlt: (a: number | ((p: [number, number, number]) => number)) => GlobeInstance;
  pathColor: (a: string | ((d: { color?: string }) => string)) => GlobeInstance;
  pathStroke: (a: number | ((d: { color?: string }) => number)) => GlobeInstance;
  pathResolution: (n: number) => GlobeInstance;
  onGlobeReady: (cb: () => void) => GlobeInstance;
  controls: () => {
    autoRotate: boolean;
    autoRotateSpeed: number;
    enableZoom: boolean;
    enableRotate: boolean;
    enablePan: boolean;
    addEventListener: (e: string, fn: () => void) => void;
    removeEventListener: (e: string, fn: () => void) => void;
  };
  pointOfView: (
    pov?: { lat: number; lng: number; altitude: number },
    ms?: number,
  ) => { lat: number; lng: number; altitude: number };
  _destructor?: () => void;
};

function povKey(pov: GlobePov | null | undefined): string {
  if (!pov) return "";
  return `${pov.lat.toFixed(4)}:${pov.lng.toFixed(4)}:${pov.altitude.toFixed(3)}`;
}

export function GlobeCanvas({
  interactive = false,
  autoRotate = true,
  points = [],
  arcs = [],
  pointOfView = null,
  onAltitudeChange,
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeInstance | null>(null);
  const readyRef = useRef(false);
  const onAltRef = useRef(onAltitudeChange);
  onAltRef.current = onAltitudeChange;
  const routePaths = useMemo(
    () =>
      arcs.map((a) => ({
        id: a.id,
        color: a.color ?? "#fbbf24",
        coords: polarTiltedRoute(
          { lat: a.startLat, lon: a.startLng },
          { lat: a.endLat, lon: a.endLng },
        ),
      })),
    [arcs],
  );

  const pointsRef = useRef(points);
  const pathsRef = useRef(routePaths);
  const povRef = useRef(pointOfView);
  const appliedPovKeyRef = useRef("");
  const interactiveRef = useRef(interactive);
  const autoRotateRef = useRef(autoRotate);
  pointsRef.current = points;
  pathsRef.current = routePaths;
  povRef.current = pointOfView;
  interactiveRef.current = interactive;
  autoRotateRef.current = autoRotate;

  const applyPointOfView = (
    globe: GlobeInstance,
    pov: GlobePov | null | undefined,
    ms: number,
    force = false,
  ) => {
    if (!pov) return;
    const key = povKey(pov);
    if (!force && key === appliedPovKeyRef.current) return;
    // Framing a route: never keep spinning away from the target.
    globe.controls().autoRotate = false;
    appliedPovKeyRef.current = key;
    globe.pointOfView(
      { lat: pov.lat, lng: pov.lng, altitude: pov.altitude },
      ms,
    );
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    let globe: GlobeInstance | null = null;
    let resizeObs: ResizeObserver | null = null;
    let onChange: (() => void) | null = null;

    void (async () => {
      const GlobeMod = await import("globe.gl");
      if (cancelled || !containerRef.current) return;

      const GlobeCtor = GlobeMod.default as unknown as {
        new (element: HTMLElement): GlobeInstance;
        (): GlobeInstance;
      };

      // Support both `new Globe(el)` and legacy `Globe()(el)`.
      try {
        globe = new GlobeCtor(containerRef.current);
      } catch {
        globe = (GlobeCtor as unknown as () => GlobeInstance)();
        globe(containerRef.current);
      }

      globe
        .globeImageUrl(
          "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
        )
        .backgroundColor("rgba(0,0,0,0)")
        .showAtmosphere(true)
        .atmosphereColor("#8eb4d8")
        .pointLat("lat")
        .pointLng("lon")
        .pointAltitude(0.01)
        .pointRadius(0.45)
        .pointColor((d: GlobePoint) => d.color ?? "#f59e0b")
        .pointLabel((d: GlobePoint) => d.label ?? "")
        // Low, pole-bowed paths (not tall radial arcs) so curves read top-down.
        .pathPoints("coords")
        .pathPointLat((p: [number, number, number]) => p[0])
        .pathPointLng((p: [number, number, number]) => p[1])
        .pathPointAlt((p: [number, number, number]) => p[2])
        .pathColor((d: { color?: string }) => d.color ?? "#fbbf24")
        .pathStroke(1.35)
        .pathResolution(2);

      const w = containerRef.current.clientWidth || window.innerWidth;
      const h = containerRef.current.clientHeight || window.innerHeight;
      globe.width(w).height(h);

      const controls = globe.controls();
      // If we already have a framing target, never start on Africa + spin.
      const hasPov = Boolean(povRef.current);
      controls.autoRotate = hasPov ? false : autoRotateRef.current;
      controls.autoRotateSpeed = 0.35;
      controls.enableZoom = interactiveRef.current;
      controls.enableRotate = true;
      controls.enablePan = false;

      onChange = () => {
        const pov = globe!.pointOfView();
        onAltRef.current?.(pov.altitude, pov.lat, pov.lng);
      };
      controls.addEventListener("change", onChange);

      globe.pointsData(pointsRef.current);
      globe.pathsData(pathsRef.current);

      globe.onGlobeReady(() => {
        if (cancelled || !globe) return;
        readyRef.current = true;
        applyPointOfView(globe, povRef.current, 0, true);
      });

      // Fallback if onGlobeReady already fired or is unavailable.
      requestAnimationFrame(() => {
        if (cancelled || !globe) return;
        readyRef.current = true;
        applyPointOfView(globe, povRef.current, 0, true);
      });

      globeRef.current = globe;

      resizeObs = new ResizeObserver(() => {
        if (!containerRef.current || !globe) return;
        globe.width(containerRef.current.clientWidth);
        globe.height(containerRef.current.clientHeight);
      });
      resizeObs.observe(containerRef.current);
    })();

    return () => {
      cancelled = true;
      readyRef.current = false;
      appliedPovKeyRef.current = "";
      resizeObs?.disconnect();
      if (globe && onChange) {
        try {
          globe.controls().removeEventListener("change", onChange);
        } catch {
          /* ignore */
        }
      }
      try {
        globe?._destructor?.();
      } catch {
        /* ignore */
      }
      globeRef.current = null;
      if (el) el.innerHTML = "";
    };
    // mount once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    g.pointsData(points);
  }, [points]);

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    g.pathsData(routePaths);
  }, [routePaths]);

  useEffect(() => {
    const g = globeRef.current;
    if (!g || !pointOfView) return;
    // Stop spin first, then frame — otherwise auto-rotate drifts to Africa.
    applyPointOfView(g, pointOfView, readyRef.current ? 1200 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointOfView]);

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    // A framed POV always wins over decorative spin.
    controls.autoRotate = pointOfView ? false : autoRotate;
    controls.enableZoom = interactive;
    controls.enableRotate = true;
  }, [autoRotate, interactive, pointOfView]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
