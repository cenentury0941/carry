"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { GlobeArc, GlobePoint, GlobePov } from "./GlobeCanvas";

export type GlobeConfig = {
  interactive: boolean;
  autoRotate: boolean;
  capturePointer: boolean;
  visible: boolean;
  points: GlobePoint[];
  arcs: GlobeArc[];
  pointOfView: GlobePov | null;
  onAltitudeChange?: (altitude: number, lat: number, lng: number) => void;
};

const defaultConfig: GlobeConfig = {
  interactive: true,
  autoRotate: true,
  capturePointer: true,
  visible: true,
  points: [],
  arcs: [],
  pointOfView: null,
};

type GlobeApi = {
  config: GlobeConfig;
  setConfig: (patch: Partial<GlobeConfig>) => void;
  reset: () => void;
};

const GlobeCtx = createContext<GlobeApi | null>(null);

export function GlobeProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<GlobeConfig>(defaultConfig);

  const setConfig = useCallback((patch: Partial<GlobeConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...patch };
      // Keep prior camera when callers omit pointOfView.
      if (!("pointOfView" in patch)) next.pointOfView = prev.pointOfView;
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setConfigState(defaultConfig);
  }, []);

  const value = useMemo(
    () => ({ config, setConfig, reset }),
    [config, setConfig, reset],
  );

  return <GlobeCtx.Provider value={value}>{children}</GlobeCtx.Provider>;
}

export function useGlobe() {
  const ctx = useContext(GlobeCtx);
  if (!ctx) throw new Error("useGlobe must be used within GlobeProvider");
  return ctx;
}
