import type { LatLon } from "./geo";

/** Resolve lat/lon via Photon when a stored place has no coordinates. */
export async function geocodePlace(query: string): Promise<LatLon | null> {
  const q = query.trim();
  if (q.length < 2) return null;
  try {
    const res = await fetch(
      `/api/geocode?q=${encodeURIComponent(q)}&take=5`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      results?: { lat?: number; lon?: number; name?: string; address?: string }[];
    };
    const hit = json.results?.find(
      (r) => typeof r.lat === "number" && typeof r.lon === "number",
    );
    if (!hit || typeof hit.lat !== "number" || typeof hit.lon !== "number") {
      return null;
    }
    return { lat: hit.lat, lon: hit.lon };
  } catch {
    return null;
  }
}
