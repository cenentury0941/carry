/**
 * Filter Qloo place entities down to spots a relocating person might actually
 * care about (cafes, parks, gyms, theatres, markets) vs lodging / civic /
 * industrial infrastructure.
 */

const IRRELEVANT_NAME_PHRASES = [
  // Lodging
  "hotel",
  "motel",
  "hostel",
  "inn & suites",
  "inn and suites",
  "resort & spa",
  "resort and spa",
  "extended stay",
  "bed & breakfast",
  "bed and breakfast",
  "b&b",
  "airbnb",
  "vacation rental",
  "timeshare",
  // Lodging brands (common Qloo lodging hits)
  "hyatt",
  "hilton",
  "marriott",
  "sheraton",
  "westin",
  "holiday inn",
  "best western",
  "courtyard by",
  "residence inn",
  "fairfield inn",
  "hampton inn",
  "doubletree",
  "radisson",
  "wyndham",
  "four seasons",
  "ritz-carlton",
  "ritz carlton",
  "intercontinental",
  "crowne plaza",
  "novotel",
  "ibis hotel",
  // Industrial / logistics
  "factory",
  "manufacturing",
  "warehouse",
  "industrial park",
  "power plant",
  "substation",
  "recycling center",
  "waste management",
  "landfill",
  "quarry",
  "refinery",
  "distribution center",
  "fulfillment center",
  // Government / civic / emergency
  "city hall",
  "town hall",
  "county office",
  "courthouse",
  "court house",
  "municipal",
  "government building",
  "federal building",
  "embassy",
  "consulate",
  "dmv",
  "department of motor",
  "post office",
  "police station",
  "police department",
  "sheriff",
  "fire station",
  "fire department",
  "jail",
  "prison",
  "correctional",
  "military base",
  "army base",
  "navy base",
  "air force",
  // Transport infrastructure (not a daily ritual)
  "airport",
  "bus depot",
  "bus terminal",
  "train station",
  "metro station",
  "subway station",
  "parking garage",
  "parking lot",
  "parking structure",
  "toll plaza",
  // Medical / institutional (usually not "places you may care about")
  "hospital",
  "urgent care",
  "medical center",
  "clinic",
  "funeral home",
  "cemetery",
  "mortuary",
  // Offices / corporate campuses
  "corporate office",
  "headquarters",
  "office park",
  "call center",
];

/** Whole-word / boundary-ish patterns for short tokens that appear in names. */
const IRRELEVANT_NAME_REGEXES = [
  /\bhotel\b/i,
  /\bmotel\b/i,
  /\bhostel\b/i,
  /\bresort\b/i,
  /\bfactory\b/i,
  /\bwarehouse\b/i,
  /\bcourthouse\b/i,
  /\bembassy\b/i,
  /\bconsulate\b/i,
  /\bairport\b/i,
  /\bjail\b/i,
  /\bprison\b/i,
];

const IRRELEVANT_TAG_OR_TYPE = [
  "hotel",
  "motel",
  "hostel",
  "lodging",
  "accommodation",
  "resort",
  "factory",
  "industrial",
  "warehouse",
  "government",
  "courthouse",
  "embassy",
  "consulate",
  "police",
  "fire station",
  "airport",
  "parking",
  "hospital",
  "cemetery",
  "funeral",
];

function haystack(parts: Array<string | undefined | null>): string {
  return parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .join(" ")
    .toLowerCase();
}

export function isRelocationRelevantVenue(input: {
  name: string;
  type?: string;
  address?: string;
  /** Optional Qloo tags already known for the place. */
  tags?: string[];
}): boolean {
  const name = input.name.trim().toLowerCase();
  if (!name) return false;

  if (IRRELEVANT_NAME_PHRASES.some((p) => name.includes(p))) return false;
  if (IRRELEVANT_NAME_REGEXES.some((re) => re.test(input.name))) return false;

  const meta = haystack([
    input.type,
    ...(input.tags ?? []),
  ]);
  if (meta && IRRELEVANT_TAG_OR_TYPE.some((p) => meta.includes(p))) {
    return false;
  }

  return true;
}

export function filterRelocationVenues<
  T extends { name: string; type?: string; address?: string },
>(venues: T[], limit?: number): T[] {
  const out: T[] = [];
  for (const v of venues) {
    if (!isRelocationRelevantVenue(v)) continue;
    out.push(v);
    if (limit != null && out.length >= limit) break;
  }
  return out;
}
