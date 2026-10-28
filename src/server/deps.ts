import { nanoid } from "nanoid";
import type { Deps } from "@/core/deps";
import { liveQloo } from "@/server/qloo/endpoints";
import { createOpenAIWriter } from "@/server/llm/openai";
import { childLog } from "@/server/log";

export function createDeps(requestId: string): Deps {
  const log = childLog(requestId);
  return {
    qloo: liveQloo,
    llm: createOpenAIWriter(),
    log: {
      info: (obj, msg) => log.info(obj, msg),
      warn: (obj, msg) => log.warn(obj, msg),
      error: (obj, msg) => log.error(obj, msg),
    },
    now: () => new Date(),
    id: () => nanoid(10),
  };
}
