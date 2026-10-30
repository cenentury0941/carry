/** Derive a fake 3-letter "airport" code from a place name. */
export function airportCode(name: string): string {
  const letters = name
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (letters.length >= 3) return letters.slice(0, 3);
  const words = name
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean);
  let code = words.map((w) => w[0]).join("");
  if (code.length < 3) code = (letters + "XXX").slice(0, 3);
  return code.slice(0, 3).padEnd(3, "X");
}
