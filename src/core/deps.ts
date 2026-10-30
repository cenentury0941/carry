import type { BriefCopy, DestinationCopy, VenueWhyBatch } from "@/contracts";
import type { QlooClient } from "@/server/qloo/endpoints";

export type VenueWhyInput = {
  residenceName: string;
  originNames: string[];
  userPreferenceTags: string[];
  priority: "rhyme" | "depart" | "balanced";
  destination: string;
  venues: Array<{
    id: string;
    name: string;
    address?: string;
    affinity?: number;
    /** Tags from Qloo compare(user tastes, this venue). */
    sharedTags: string[];
    /** Tags stronger on this venue than the user. */
    venueOnlyTags: string[];
  }>;
};

export type LlmWriter = {
  writeBriefCopy: (input: {
    destination: string;
    mode: "rhyme" | "depart";
    continuity: number;
    originNames: string[];
    rhymeLabels: string[];
    departLabel: string | null;
    sharedTagNames: string[];
    venueNames: string[];
  }) => Promise<BriefCopy>;
  writeDestinationCopy?: (input: {
    destination: string;
    residenceName: string;
    priority: "rhyme" | "depart" | "balanced";
    continuity: number;
    originNames: string[];
    matchTags: string[];
    mismatchTags: string[];
    venueNames: string[];
    venueAddresses: string[];
  }) => Promise<DestinationCopy>;
  writeVenueWhys?: (input: VenueWhyInput) => Promise<VenueWhyBatch>;
};

export type Deps = {
  qloo: QlooClient;
  llm: LlmWriter | null;
  log: {
    info: (obj: Record<string, unknown>, msg?: string) => void;
    warn: (obj: Record<string, unknown>, msg?: string) => void;
    error: (obj: Record<string, unknown>, msg?: string) => void;
  };
  now: () => Date;
  id: () => string;
};

export class CarryError extends Error {
  constructor(
    public kind: "invalid_input" | "no_data" | "upstream" | "internal",
    message: string,
  ) {
    super(message);
    this.name = "CarryError";
  }
}
