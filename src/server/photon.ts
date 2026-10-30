import type { PlaceHit } from "@/contracts";

const PHOTON_URL = "https://photon.komoot.io/api/";
const USER_AGENT = "CarryRelocation/1.0 (cultural relocation; contact: local-dev)";

type PhotonProperties = {
  osm_id?: number;
  osm_type?: string;
  osm_key?: string;
  osm_value?: string;
  name?: string;
  street?: string;
  housenumber?: string;
  district?: string;
  city?: string;
  locality?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  type?: string;
};

type PhotonFeature = {
  type?: string;
  geometry?: { type?: string; coordinates?: number[] };
  properties?: PhotonProperties;
};

type PhotonResponse = {
  features?: PhotonFeature[];
};

export function isPhotonPlaceId(id: string): boolean {
  return id.startsWith("photon:");
}

/** Ids safe to send as Qloo interest entities (exclude Photon / geohash seeds). */
export function isQlooEntityId(id: string): boolean {
  if (!id) return false;
  if (isPhotonPlaceId(id)) return false;
  if (id.startsWith("geo:")) return false;
  if (id.startsWith("user:")) return false;
  return true;
}

export function formatPhotonAddress(props: PhotonProperties): string {
  const street = [props.housenumber, props.street].filter(Boolean).join(" ");
  const place =
    props.district ||
    props.city ||
    props.town ||
    props.village ||
    props.locality ||
    props.county;
  return [street || props.name, place, props.state, props.postcode, props.country]
    .filter(Boolean)
    .join(", ");
}

function featureLabel(props: PhotonProperties): string {
  const street = [props.housenumber, props.street].filter(Boolean).join(" ");
  if (street) return street;
  if (props.name) return props.name;
  return formatPhotonAddress(props) || "Address";
}

function toHit(feature: PhotonFeature): PlaceHit | null {
  const props = feature.properties;
  const coords = feature.geometry?.coordinates;
  if (!props || !coords || coords.length < 2) return null;
  const lon = coords[0];
  const lat = coords[1];
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const osmType = props.osm_type ?? "x";
  const osmId = props.osm_id ?? `${lat.toFixed(5)},${lon.toFixed(5)}`;
  const address = formatPhotonAddress(props);
  const name = featureLabel(props);

  return {
    id: `photon:${osmType}:${osmId}`,
    name,
    address: address || name,
    type: props.osm_value
      ? `photon:${props.osm_key ?? "place"}/${props.osm_value}`
      : "photon:address",
    lat,
    lon,
  };
}

/** Prefer US / NYC results for short ambiguous street queries. */
function looksLikeUsQuery(q: string): boolean {
  return /\b(ny|nyc|brooklyn|manhattan|queens|bronx|usa|united states|,?\s*[A-Z]{2}\b)/i.test(
    q,
  );
}

export async function searchPhoton(
  query: string,
  take = 8,
): Promise<PlaceHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(Math.min(Math.max(take, 1), 20)));
  url.searchParams.set("lang", "en");
  // Location bias helps “347 5th Ave, Brooklyn…” rank the NY hit first.
  if (looksLikeUsQuery(q) || /\b(ave|avenue|st|street|rd|road|blvd)\b/i.test(q)) {
    url.searchParams.set("lat", "40.6782");
    url.searchParams.set("lon", "-73.9442");
    url.searchParams.set("zoom", "12");
  }

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Photon geocode failed (${res.status})`);
  }

  const json = (await res.json()) as PhotonResponse;
  const out: PlaceHit[] = [];
  const seen = new Set<string>();
  for (const feature of json.features ?? []) {
    const hit = toHit(feature);
    if (!hit) continue;
    // Dedupe identical street + rounded coords (Photon often returns node+way).
    const dedupeKey = `${hit.address ?? hit.name}:${hit.lat?.toFixed(4)},${hit.lon?.toFixed(4)}`;
    if (seen.has(hit.id) || seen.has(dedupeKey)) continue;
    seen.add(hit.id);
    seen.add(dedupeKey);
    out.push(hit);
    if (out.length >= take) break;
  }
  return out;
}
