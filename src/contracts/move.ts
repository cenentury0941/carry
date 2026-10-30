import { z } from "zod";
import { EvidenceEntity, Tag } from "./brief";

export const ResolvedPlace = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  address: z.string().optional(),
  type: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
});
export type ResolvedPlace = z.infer<typeof ResolvedPlace>;

export const TargetScope = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("addresses"),
    places: z.array(ResolvedPlace).min(1).max(12),
  }),
  z.object({
    kind: z.literal("areas"),
    places: z.array(ResolvedPlace).min(1).max(12),
  }),
  z.object({
    kind: z.literal("ambiguous"),
    region: z.string().min(2),
  }),
]);
export type TargetScope = z.infer<typeof TargetScope>;

export const TastePriority = z.enum(["rhyme", "depart", "balanced"]);
export type TastePriority = z.infer<typeof TastePriority>;

export const TasteProfile = z.object({
  places: z.array(ResolvedPlace).max(12).default([]),
  tags: z.array(z.string()).max(20).default([]),
  priorities: z.array(TastePriority).min(1).default(["balanced"]),
  inferredFromResidence: z.boolean().default(true),
});
export type TasteProfile = z.infer<typeof TasteProfile>;

export const MoveStatus = z.enum(["draft", "running", "ready", "error"]);
export type MoveStatus = z.infer<typeof MoveStatus>;

export const RankedDestination = z.object({
  id: z.string(),
  label: z.string(),
  locationQuery: z.string(),
  address: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  score: z.number(),
  continuity: z.number(),
  matches: z.array(Tag),
  mismatches: z.array(Tag),
  summary: z.string(),
  expect: z.array(z.string()),
  venues: z.array(EvidenceEntity),
  evidenceEntityIds: z.array(z.string()),
});
export type RankedDestination = z.infer<typeof RankedDestination>;

export const RankedMoveResult = z.object({
  destinations: z.array(RankedDestination),
  generatedAt: z.string(),
});
export type RankedMoveResult = z.infer<typeof RankedMoveResult>;

export const MoveProject = z.object({
  id: z.string(),
  userId: z.string(),
  residence: ResolvedPlace.nullable().default(null),
  target: TargetScope.nullable().default(null),
  tastes: TasteProfile.nullable().default(null),
  status: MoveStatus.default("draft"),
  result: RankedMoveResult.nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MoveProject = z.infer<typeof MoveProject>;

export const CreateMoveBody = z.object({}).default({});

export const PatchMoveBody = z.object({
  residence: ResolvedPlace.optional(),
  target: TargetScope.optional(),
  tastes: TasteProfile.optional(),
});
export type PatchMoveBody = z.infer<typeof PatchMoveBody>;

export const CompareBody = z.object({
  aId: z.string().min(1),
  bId: z.string().min(1),
});
export type CompareBody = z.infer<typeof CompareBody>;

export const MoveChatBody = z.object({
  message: z.string().min(1).max(800),
  destinationId: z.string().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .max(12)
    .optional()
    .default([]),
});
export type MoveChatBody = z.infer<typeof MoveChatBody>;

export const MoveChatResult = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("answer"),
    message: z.string(),
  }),
  z.object({
    kind: z.literal("move"),
    message: z.string(),
    move: MoveProject,
  }),
  z.object({
    kind: z.literal("error"),
    message: z.string(),
  }),
]);
export type MoveChatResult = z.infer<typeof MoveChatResult>;

export const DestinationCompare = z.object({
  a: RankedDestination,
  b: RankedDestination,
  sharedMatches: z.array(Tag),
  onlyA: z.array(Tag),
  onlyB: z.array(Tag),
  scoreDelta: z.number(),
});
export type DestinationCompare = z.infer<typeof DestinationCompare>;

/** Natural-language write-up for one ranked destination. */
export const DestinationCopy = z.object({
  summary: z
    .string()
    .describe(
      "2–4 sentences of plain English explaining how this place fits how the person likes to spend their time",
    ),
  matchExplanation: z
    .string()
    .describe(
      "1–2 sentences on what feels familiar, woven from match tags — not a raw tag list",
    ),
  mismatchExplanation: z
    .string()
    .describe(
      "1–2 sentences on what would feel different, woven from mismatch tags — not a raw tag list",
    ),
  expect: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe("Friendly tips for what to try first, in full sentences"),
});
export type DestinationCopy = z.infer<typeof DestinationCopy>;

/** Per-venue why explanations generated from user input + Qloo evidence. */
export const VenueWhyBatch = z.object({
  venues: z
    .array(
      z.object({
        id: z.string(),
        why: z
          .string()
          .describe(
            "2–4 sentences explaining why THIS specific place was recommended for THIS user, citing their inputs and the Qloo evidence provided — never invent facts",
          ),
      }),
    )
    .min(1),
});
export type VenueWhyBatch = z.infer<typeof VenueWhyBatch>;

export const MoveStepName = z.enum([
  "profile",
  "candidates",
  "score",
  "write",
]);
export type MoveStepName = z.infer<typeof MoveStepName>;

export const MoveStreamEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("step"),
    step: MoveStepName,
    status: z.enum(["start", "done"]),
  }),
  z.object({
    type: z.literal("move"),
    move: MoveProject,
  }),
  z.object({
    type: z.literal("error"),
    kind: z.enum(["invalid_input", "no_data", "upstream", "internal"]),
    message: z.string(),
  }),
]);
export type MoveStreamEvent = z.infer<typeof MoveStreamEvent>;
