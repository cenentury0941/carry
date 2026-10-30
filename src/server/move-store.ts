import {
  MoveProject,
  RankedMoveResult,
  type PatchMoveBody,
} from "@/contracts";
import { healMoveDestinationIds } from "@/core/unique-destinations";
import { getRedis } from "./redis";

const MEMORY = new Map<string, string>();

function moveKey(id: string) {
  return `move:${id}`;
}

function userMovesKey(userId: string) {
  return `user:${userId}:moves`;
}

async function kvGet(key: string): Promise<string | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const value = await redis.get<string>(key);
      if (value == null) return null;
      return typeof value === "string" ? value : JSON.stringify(value);
    } catch {
      return null;
    }
  }
  return MEMORY.get(key) ?? null;
}

async function kvSet(key: string, value: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(key, value);
    return;
  }
  MEMORY.set(key, value);
}

async function kvDel(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(key);
    return;
  }
  MEMORY.delete(key);
}

async function kvListRemove(key: string, id: string): Promise<void> {
  const list = await kvListGet(key);
  const next = list.filter((x) => x !== id);
  if (next.length === list.length) return;
  if (next.length === 0) {
    await kvDel(key);
    return;
  }
  await kvSet(key, JSON.stringify(next));
}

async function kvListGet(key: string): Promise<string[]> {
  const raw = await kvGet(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

async function kvListPush(key: string, id: string): Promise<void> {
  const list = await kvListGet(key);
  if (!list.includes(id)) {
    list.unshift(id);
    await kvSet(key, JSON.stringify(list.slice(0, 100)));
  }
}

export async function createMove(userId: string, id: string): Promise<MoveProject> {
  const now = new Date().toISOString();
  const move: MoveProject = {
    id,
    userId,
    residence: null,
    target: null,
    tastes: null,
    status: "draft",
    result: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
  };
  await kvSet(moveKey(id), JSON.stringify(move));
  await kvListPush(userMovesKey(userId), id);
  return move;
}

export async function getMove(id: string): Promise<MoveProject | null> {
  const raw = await kvGet(moveKey(id));
  if (!raw) return null;
  try {
    return healMoveDestinationIds(MoveProject.parse(JSON.parse(raw)));
  } catch {
    return null;
  }
}

export async function getMoveForUser(
  id: string,
  userId: string,
): Promise<MoveProject | null> {
  const move = await getMove(id);
  if (!move || move.userId !== userId) return null;
  // Heal orphans that were saved without updating the user index.
  await kvListPush(userMovesKey(userId), id);
  return move;
}

export async function listMovesForUser(userId: string): Promise<MoveProject[]> {
  const ids = await kvListGet(userMovesKey(userId));
  const moves: MoveProject[] = [];
  for (const id of ids) {
    const m = await getMove(id);
    if (m && m.userId === userId) moves.push(m);
  }
  return moves;
}

export async function patchMove(
  id: string,
  userId: string,
  patch: PatchMoveBody,
): Promise<MoveProject | null> {
  const existing = await getMoveForUser(id, userId);
  if (!existing) return null;
  const next: MoveProject = {
    ...existing,
    residence: patch.residence ?? existing.residence,
    target: patch.target ?? existing.target,
    tastes: patch.tastes ?? existing.tastes,
    updatedAt: new Date().toISOString(),
  };
  await kvSet(moveKey(id), JSON.stringify(next));
  return next;
}

export async function saveMove(move: MoveProject): Promise<void> {
  await kvSet(moveKey(move.id), JSON.stringify(move));
  if (move.userId) {
    await kvListPush(userMovesKey(move.userId), move.id);
  }
}

export async function setMoveResult(
  id: string,
  userId: string,
  result: RankedMoveResult,
): Promise<MoveProject | null> {
  const existing = await getMoveForUser(id, userId);
  if (!existing) return null;
  const next: MoveProject = {
    ...existing,
    status: "ready",
    result,
    errorMessage: null,
    updatedAt: new Date().toISOString(),
  };
  await saveMove(next);
  return next;
}

export async function setMoveStatus(
  id: string,
  userId: string,
  status: MoveProject["status"],
  errorMessage?: string | null,
): Promise<MoveProject | null> {
  const existing = await getMoveForUser(id, userId);
  if (!existing) return null;
  const next: MoveProject = {
    ...existing,
    status,
    errorMessage: errorMessage ?? null,
    updatedAt: new Date().toISOString(),
  };
  await saveMove(next);
  return next;
}

export async function deleteMove(
  id: string,
  userId: string,
): Promise<boolean> {
  const existing = await getMove(id);
  if (!existing || existing.userId !== userId) return false;
  await kvDel(moveKey(id));
  await kvListRemove(userMovesKey(userId), id);
  return true;
}

/** Delete every move indexed for a user. Returns how many were removed. */
export async function deleteAllMovesForUser(userId: string): Promise<number> {
  const ids = await kvListGet(userMovesKey(userId));
  let removed = 0;
  for (const id of ids) {
    const ok = await deleteMove(id, userId);
    if (ok) removed += 1;
  }
  await kvDel(userMovesKey(userId));
  return removed;
}
