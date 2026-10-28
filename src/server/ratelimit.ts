import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "./redis";

const MEMORY_HITS = new Map<string, number[]>();

function memoryLimit(
  key: string,
  limit: number,
  windowMs: number,
): { success: boolean; remaining: number } {
  const now = Date.now();
  const windowStart = now - windowMs;
  const hits = (MEMORY_HITS.get(key) ?? []).filter((t) => t > windowStart);
  if (hits.length >= limit) {
    MEMORY_HITS.set(key, hits);
    return { success: false, remaining: 0 };
  }
  hits.push(now);
  MEMORY_HITS.set(key, hits);
  return { success: true, remaining: limit - hits.length };
}

let briefLimiter: Ratelimit | null = null;
let refineLimiter: Ratelimit | null = null;

function getBriefLimiter() {
  if (briefLimiter) return briefLimiter;
  const redis = getRedis();
  if (!redis) return null;
  briefLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 h"),
    prefix: "rl:brief",
  });
  return briefLimiter;
}

function getRefineLimiter() {
  if (refineLimiter) return refineLimiter;
  const redis = getRedis();
  if (!redis) return null;
  refineLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 h"),
    prefix: "rl:refine",
  });
  return refineLimiter;
}

export async function limitBriefs(ip: string) {
  const limiter = getBriefLimiter();
  if (limiter) {
    const r = await limiter.limit(ip);
    return { success: r.success, remaining: r.remaining };
  }
  return memoryLimit(`brief:${ip}`, 5, 60 * 60 * 1000);
}

export async function limitRefines(ip: string) {
  const limiter = getRefineLimiter();
  if (limiter) {
    const r = await limiter.limit(ip);
    return { success: r.success, remaining: r.remaining };
  }
  return memoryLimit(`refine:${ip}`, 20, 60 * 60 * 1000);
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "anonymous"
  );
}
