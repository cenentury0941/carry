import pLimit from "p-limit";
import { getEnv } from "../env";
import { cacheGet, cacheKey, cacheSet } from "../cache";
import { logger } from "../log";

const limit = pLimit(4);
const TIMEOUT_MS = 8_000;
const MAX_RETRIES = 2;

export class QlooError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: string,
  ) {
    super(message);
    this.name = "QlooError";
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function qlooGet<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  options?: { cache?: boolean; parse?: (json: unknown) => T },
): Promise<T> {
  const env = getEnv();
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    clean[k] = String(v);
  }

  const useCache = options?.cache !== false;
  const key = cacheKey(path, clean);
  if (useCache) {
    const hit = await cacheGet(key);
    if (hit) {
      const json = JSON.parse(hit) as unknown;
      return options?.parse ? options.parse(json) : (json as T);
    }
  }

  return limit(async () => {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const url = new URL(path, env.QLOO_BASE_URL);
      for (const [k, v] of Object.entries(clean)) {
        url.searchParams.set(k, v);
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(url.toString(), {
          method: "GET",
          headers: { "X-Api-Key": env.QLOO_API_KEY },
          signal: controller.signal,
        });
        const text = await res.text();
        if (res.status === 429 || res.status >= 500) {
          lastError = new QlooError(
            `Qloo ${res.status}`,
            res.status,
            text.slice(0, 200),
          );
          const jitter = 200 + Math.random() * 400 * (attempt + 1);
          await sleep(jitter);
          continue;
        }
        if (!res.ok) {
          throw new QlooError(`Qloo ${res.status}`, res.status, text.slice(0, 400));
        }
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          throw new QlooError("Qloo returned non-JSON", res.status, text.slice(0, 200));
        }
        if (useCache) {
          await cacheSet(key, JSON.stringify(json));
        }
        return options?.parse ? options.parse(json) : (json as T);
      } catch (err) {
        if (err instanceof QlooError && err.status && err.status < 500 && err.status !== 429) {
          throw err;
        }
        lastError = err instanceof Error ? err : new Error(String(err));
        // Timeouts often mean a bad/huge location filter — fail fast so callers
        // can fall back (e.g. heatmap → places) instead of burning ~24s on retries.
        const aborted =
          (err instanceof Error && err.name === "AbortError") ||
          /aborted/i.test(lastError.message);
        logger.warn({ err: lastError.message, attempt, path }, "qloo retry");
        if (aborted) break;
        const jitter = 200 + Math.random() * 400 * (attempt + 1);
        await sleep(jitter);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError ?? new QlooError("Qloo request failed");
  });
}
