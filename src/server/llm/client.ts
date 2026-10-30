import OpenAI from "openai";
import { getEnv, hasOpenAI } from "../env";

/** Shared OpenAI SDK client (platform OpenAI, or compatible gateway via OPENAI_BASE_URL). */
export function createOpenAIClient(): OpenAI | null {
  if (!hasOpenAI()) return null;
  const env = getEnv();
  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    ...(process.env.OPENAI_BASE_URL
      ? { baseURL: process.env.OPENAI_BASE_URL }
      : {}),
  });
}

export function openAIModel(): string {
  return getEnv().OPENAI_MODEL;
}
