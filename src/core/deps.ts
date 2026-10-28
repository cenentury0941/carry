import type { BriefCopy } from "@/contracts";
import type { QlooClient } from "@/server/qloo/endpoints";

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
