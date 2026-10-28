import { createHash } from "crypto";
import { getRedis } from "./redis";

const MEMORY = new Map<string, { value: string; expiresAt: number }>();
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function cacheKey(path: string, params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const hash = createHash("sha256")
    .update(`${path}?${sorted}`)
    .digest("hex")
    .slice(0, 32);
  return `qloo:${hash}`;
}

export async function cacheGet(key: string): Promise<string | null> {
  const redis = getRedis();
  if (redis) {
    try {
      return await redis.get<string>(key);
    } catch {
      // fall through to memory
    }
  }
  const hit = MEMORY.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    MEMORY.delete(key);
    return null;
  }
  return hit.value;
}

export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, value, { ex: ttlSeconds });
      return;
    } catch {
      // fall through to memory
    }
  }
  MEMORY.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}
