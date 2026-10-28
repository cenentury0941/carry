import { Redis } from "@upstash/redis";
import { redisConfig } from "./env";

let client: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const cfg = redisConfig();
  if (!cfg) {
    client = null;
    return client;
  }
  client = new Redis({
    url: cfg.url,
    token: cfg.token,
  });
  return client;
}
