import { z } from "zod";

export const Mode = z.enum(["rhyme", "depart"]);
export type Mode = z.infer<typeof Mode>;

export const OriginPlace = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});
export type OriginPlace = z.infer<typeof OriginPlace>;

export const BriefInput = z.object({
  origin: z.array(OriginPlace).min(3).max(6),
  destination: z.string().min(2),
  mode: Mode,
});
export type BriefInput = z.infer<typeof BriefInput>;

export const EvidenceEntity = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().optional(),
  address: z.string().optional(),
  affinity: z.number().optional(),
});
export type EvidenceEntity = z.infer<typeof EvidenceEntity>;

export const Tag = z.object({
  id: z.string(),
  name: z.string(),
  score: z.number().optional(),
});
export type Tag = z.infer<typeof Tag>;

export const Area = z.object({
  geohash: z.string(),
  label: z.string(),
  score: z.number(),
  affinity: z.number().optional(),
  popularity: z.number().optional(),
  venues: z.array(EvidenceEntity),
  sharedTags: z.array(Tag),
  changedTags: z.array(Tag),
});
export type Area = z.infer<typeof Area>;

export const PlanItem = z.object({
  day: z.string(),
  title: z.string(),
  detail: z.string(),
  entityIds: z.array(z.string()).default([]),
});
export type PlanItem = z.infer<typeof PlanItem>;

export const BriefCopy = z.object({
  headline: z.string(),
  summary: z.string(),
  rhymeNote: z.string(),
  departNote: z.string().nullable(),
});
export type BriefCopy = z.infer<typeof BriefCopy>;

export const Brief = z.object({
  id: z.string(),
  version: z.number(),
  input: BriefInput,
  continuity: z.number(),
  rhyme: z.array(Area),
  depart: Area.nullable(),
  firstWeek: z.array(PlanItem),
  copy: BriefCopy,
  createdAt: z.string(),
});
export type Brief = z.infer<typeof Brief>;

export const RefineInput = z.object({
  message: z.string().min(1).max(500),
});
export type RefineInput = z.infer<typeof RefineInput>;
