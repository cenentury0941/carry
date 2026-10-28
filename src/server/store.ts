import { Brief } from "@/contracts";
import { getRedis } from "./redis";

const MEMORY = new Map<string, string>();

function versionKey(id: string, version: number) {
  return `brief:${id}:v${version}`;
}

function latestKey(id: string) {
  return `brief:${id}:latest`;
}

export async function saveBrief(brief: Brief): Promise<void> {
  const payload = JSON.stringify(brief);
  const redis = getRedis();
  if (redis) {
    await redis.set(versionKey(brief.id, brief.version), payload);
    await redis.set(latestKey(brief.id), payload);
    return;
  }
  MEMORY.set(versionKey(brief.id, brief.version), payload);
  MEMORY.set(latestKey(brief.id), payload);
}

export async function getBrief(id: string): Promise<Brief | null> {
  const redis = getRedis();
  let raw: string | null = null;
  if (redis) {
    try {
      const value = await redis.get<string>(latestKey(id));
      raw = typeof value === "string" ? value : value ? JSON.stringify(value) : null;
    } catch {
      raw = null;
    }
  } else {
    raw = MEMORY.get(latestKey(id)) ?? null;
  }
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Brief.parse(parsed);
  } catch {
    return null;
  }
}

export async function listFeaturedIds(): Promise<string[]> {
  const redis = getRedis();
  if (redis) {
    try {
      const ids = await redis.get<string[]>("featured:briefs");
      return ids ?? [];
    } catch {
      return [];
    }
  }
  const raw = MEMORY.get("featured:briefs");
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export async function setFeaturedIds(ids: string[]): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set("featured:briefs", ids);
    return;
  }
  MEMORY.set("featured:briefs", JSON.stringify(ids));
}
