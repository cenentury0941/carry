/** Shorten Qloo type URNs for display. */
export function humanPlaceType(type?: string): string | undefined {
  if (!type) return undefined;
  const raw = type.includes(":") ? type.split(":").pop() : type;
  if (!raw || raw === "entity") return undefined;
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
