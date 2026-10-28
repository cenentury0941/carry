import type { BriefInput, Tag } from "@/contracts";
import type { Deps } from "../deps";
import { CarryError } from "../deps";

export type ProfileResult = {
  tags: Tag[];
  entityIds: string[];
};

export async function profileOrigin(
  input: BriefInput,
  deps: Deps,
): Promise<ProfileResult> {
  const entityIds = input.origin.map((o) => o.id);
  try {
    const tags = await deps.qloo.getTasteTags(entityIds);
    return {
      entityIds,
      tags: tags.map((t) => ({
        id: t.id,
        name: t.name,
        score: t.affinity,
      })),
    };
  } catch (err) {
    deps.log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "profile failed",
    );
    throw new CarryError(
      "upstream",
      "Could not profile your origin places from Qloo.",
    );
  }
}
