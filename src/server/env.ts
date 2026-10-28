import { z } from "zod";

const EnvSchema = z.object({
  QLOO_API_KEY: z.string().min(1),
  QLOO_BASE_URL: z
    .string()
    .min(1)
    .default("https://hackathon.api.qloo.com"),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  UPSTASH_REDIS_REST_URL: z.string().optional().default(""),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional().default(""),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/** Full env — requires Qloo key. Use for Qloo/LLM paths. */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse({
    QLOO_API_KEY: process.env.QLOO_API_KEY,
    QLOO_BASE_URL: process.env.QLOO_BASE_URL || undefined,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
    OPENAI_MODEL: process.env.OPENAI_MODEL || undefined,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || "",
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || "",
  });
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${msg}`);
  }
  cached = parsed.data;
  return cached;
}

export function redisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || "";
  if (!url.startsWith("http") || !token) return null;
  return { url, token };
}

export function hasRedis(): boolean {
  return redisConfig() !== null;
}

export function hasOpenAI(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function hasQloo(): boolean {
  return Boolean(process.env.QLOO_API_KEY);
}
