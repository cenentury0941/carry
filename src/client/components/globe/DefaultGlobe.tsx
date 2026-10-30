"use client";

import { GlobeBackground } from "./GlobeBackground";
import { useGlobe } from "./GlobeContext";

/** Single globe driven by GlobeProvider config. */
export function DefaultGlobe() {
  const { config } = useGlobe();
  if (!config.visible) return null;

  return (
    <GlobeBackground
      interactive={config.interactive}
      autoRotate={config.autoRotate}
      capturePointer={config.capturePointer}
      points={config.points}
      arcs={config.arcs}
      pointOfView={config.pointOfView}
      onAltitudeChange={config.onAltitudeChange}
    />
  );
}
