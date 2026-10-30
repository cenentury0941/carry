import type { EvidenceEntity, Tag } from "@/contracts";
import { filterUsefulTags } from "./humanize-tags";

/**
 * Attach Qloo compare evidence to a venue for the expandable stats UI.
 */
export function attachVenueEvidence(input: {
  venue: EvidenceEntity;
  venueSharedTags: Tag[];
  venueOnlyTags: Tag[];
  areaMatchTags: Tag[];
}): EvidenceEntity {
  const shared = filterUsefulTags(
    input.venueSharedTags.length
      ? input.venueSharedTags
      : input.areaMatchTags,
    5,
  );
  const distinct = filterUsefulTags(input.venueOnlyTags, 4);
  return {
    ...input.venue,
    evidenceTags: shared.map((t) => t.name),
    distinctTags: distinct.map((t) => t.name),
    why: undefined,
  };
}
