export type LatLon = { lat: number; lon: number };

const R = 6371;

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

function toDeg(r: number) {
  return (r * 180) / Math.PI;
}

/** Great-circle line as [lon, lat] pairs for MapLibre GeoJSON. */
export function greatCircle(
  start: LatLon,
  end: LatLon,
  steps = 64,
): [number, number][] {
  const lat1 = toRad(start.lat);
  const lon1 = toRad(start.lon);
  const lat2 = toRad(end.lat);
  const lon2 = toRad(end.lon);

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
      ),
    );

  if (d < 1e-8) return [[start.lon, start.lat], [end.lon, end.lat]];

  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x =
      A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y =
      A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    coords.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }
  return coords;
}

export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Fit camera altitude for a set of points (globe.gl altitude units). */
export function fitAltitude(points: LatLon[]): number {
  if (points.length === 0) return 2.2;
  if (points.length === 1) return 1.2;
  let maxKm = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      maxKm = Math.max(maxKm, haversineKm(points[i], points[j]));
    }
  }
  // Frame the span with a little padding so arcs stay in view.
  if (maxKm < 80) return 0.5;
  if (maxKm < 400) return 0.75;
  if (maxKm < 1500) return 1.15;
  if (maxKm < 3500) return 1.55;
  if (maxKm < 6000) return 1.85;
  return 2.3;
}

/** Spherical mean — better than arithmetic avg across longitudes. */
export function centroid(points: LatLon[]): LatLon {
  if (points.length === 0) return { lat: 20, lon: 0 };
  if (points.length === 1) return points[0];
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    const lat = toRad(p.lat);
    const lon = toRad(p.lon);
    x += Math.cos(lat) * Math.cos(lon);
    y += Math.cos(lat) * Math.sin(lon);
    z += Math.sin(lat);
  }
  const n = points.length;
  x /= n;
  y /= n;
  z /= n;
  return {
    lat: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))),
    lon: toDeg(Math.atan2(y, x)),
  };
}

/** Camera POV that frames all points on the globe. */
export function fitPointOfView(points: LatLon[]): {
  lat: number;
  lng: number;
  altitude: number;
} {
  const c = centroid(points);
  return {
    lat: c.lat,
    lng: c.lon,
    altitude: fitAltitude(points),
  };
}

function shortestLonDelta(from: number, to: number): number {
  let d = to - from;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

/**
 * Low flight path that bows toward the nearer pole so the curve stays
 * visible even when the camera looks nearly top-down.
 * Returns [lat, lng, altitude] samples for globe.gl paths.
 */
export function polarTiltedRoute(
  start: LatLon,
  end: LatLon,
  steps = 48,
): [number, number, number][] {
  const latSpan = end.lat - start.lat;
  const lonSpan = shortestLonDelta(start.lon, end.lon);
  const midLat = (start.lat + end.lat) / 2;
  const midLon = start.lon + lonSpan / 2;
  const poleDir = midLat >= 0 ? 1 : -1;
  // Stronger bow for east-west legs; still a little tilt for N-S.
  const bow = Math.max(1.5, Math.abs(lonSpan) * 0.2 + Math.abs(latSpan) * 0.05);
  const ctrl = {
    lat: midLat + bow * poleDir,
    lon: midLon,
  };
  const angular = Math.hypot(latSpan, lonSpan);
  const peakAlt = Math.min(0.055, Math.max(0.012, angular * 0.0018));

  const pts: [number, number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const omt = 1 - t;
    const lat =
      omt * omt * start.lat + 2 * omt * t * ctrl.lat + t * t * end.lat;
    const lon =
      omt * omt * start.lon + 2 * omt * t * ctrl.lon + t * t * (start.lon + lonSpan);
    const alt = peakAlt * Math.sin(Math.PI * t);
    pts.push([lat, lon, alt]);
  }
  return pts;
}

/** Altitude below this ≈ closer than state level → switch to map. */
export const GLOBE_TO_MAP_ALTITUDE = 0.35;
export const MAP_TO_GLOBE_ZOOM = 6;
export const MAP_ENTER_ZOOM = 7.5;
