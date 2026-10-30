import type { Tag } from "@/contracts";

/** Amenity / facility tags that rarely help a relocation story. */
const NOISE_SUBSTR = [
  "wi-fi",
  "wifi",
  "elevator",
  "heating",
  "air conditioning",
  "parking",
  "private bathroom",
  "jacuzzi",
  "rainfall shower",
  "kettle",
  "business center",
  "free wifi",
  "free wi-fi",
  "double",
  "outdoor pool",
  "pool",
  "hair dryer",
  "luggage",
  "cable tv",
  "room service",
  "fitness center",
  "desk",
  "family room",
];

const NOISE_EXACT = new Set([
  "place",
  "elevator",
  "parking",
  "wi-fi",
  "wifi",
  "heating",
  "double",
  "desk",
  "average",
]);

function isNoise(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (NOISE_EXACT.has(n)) return true;
  return NOISE_SUBSTR.some((s) => n === s || n.includes(s));
}

/** Prefer lifestyle / cuisine / vibe tags for end-user display. */
export function filterUsefulTags(tags: Tag[], limit = 8): Tag[] {
  const out: Tag[] = [];
  const seen = new Set<string>();
  for (const t of tags) {
    const key = t.name.trim().toLowerCase();
    if (!key || seen.has(key) || isNoise(t.name)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}

/** Soften API tag labels for mid-sentence prose. */
export function forProse(name: string): string {
  const n = name.trim();
  if (!n) return n;
  // Keep short acronyms / LGBTQ+ style labels
  if (/^[A-Z0-9+]{2,6}$/.test(n) || n.includes("+") || n.includes("LGBTQ")) {
    return n;
  }
  return n.toLowerCase();
}

/** Turn tag names into a short natural phrase: "coffee, lunch, and beachfront". */
export function phraseList(names: string[], max = 4): string {
  const cleaned = names
    .map((n) => forProse(n))
    .filter(Boolean)
    .slice(0, max);
  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned[cleaned.length - 1]}`;
}

export function humanLabelForTag(name: string): string {
  const n = name.trim();
  if (!n) return n;
  // Keep intentional casing for short brands; otherwise sentence-friendly
  if (/^[A-Z0-9+]+$/.test(n) || n.includes("+")) return n;
  return n.charAt(0).toUpperCase() + n.slice(1);
}
