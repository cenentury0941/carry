import { z } from "zod";
import { Brief } from "./brief";

export const StepName = z.enum([
  "profile",
  "candidates",
  "evidence",
  "compare",
  "score",
  "write",
]);
export type StepName = z.infer<typeof StepName>;

export const ErrorKind = z.enum([
  "invalid_input",
  "no_data",
  "upstream",
  "internal",
]);
export type ErrorKind = z.infer<typeof ErrorKind>;

export const StreamEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("step"),
    step: StepName,
    status: z.enum(["start", "done"]),
  }),
  z.object({
    type: z.literal("brief"),
    brief: Brief,
  }),
  z.object({
    type: z.literal("error"),
    kind: ErrorKind,
    message: z.string(),
  }),
]);
export type StreamEvent = z.infer<typeof StreamEvent>;
