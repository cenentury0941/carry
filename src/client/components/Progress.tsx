"use client";

import type { StepName } from "@/contracts";

const LABELS: Record<StepName, string> = {
  profile: "Profiling your week",
  candidates: "Finding candidate areas",
  evidence: "Gathering venues",
  compare: "Comparing taste",
  score: "Scoring continuity",
  write: "Writing the brief",
};

const ORDER: StepName[] = [
  "profile",
  "candidates",
  "evidence",
  "compare",
  "score",
  "write",
];

type Props = {
  steps: Partial<Record<StepName, "start" | "done">>;
};

export function Progress({ steps }: Props) {
  return (
    <ol className="space-y-2">
      {ORDER.map((step) => {
        const status = steps[step];
        return (
          <li
            key={step}
            className="flex items-center gap-3 text-sm text-zinc-700"
          >
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                status === "done"
                  ? "bg-emerald-600 text-white"
                  : status === "start"
                    ? "bg-amber-500 text-white"
                    : "bg-zinc-200 text-zinc-500"
              }`}
            >
              {status === "done" ? "✓" : status === "start" ? "…" : ""}
            </span>
            {LABELS[step]}
          </li>
        );
      })}
    </ol>
  );
}
