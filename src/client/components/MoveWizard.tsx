"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  MoveProject,
  ResolvedPlace,
  TargetScope,
  TastePriority,
  TasteProfile,
} from "@/contracts";
import { PlacePicker } from "./PlacePicker";
import { AddressPicker } from "./AddressPicker";
import { CenteredOverlay } from "./CenteredOverlay";
import { useMoveStream } from "../hooks/useMoveStream";

const STEPS = ["Residence", "Targets", "Tastes", "Run"] as const;

type Props = {
  initial: MoveProject;
};

export function MoveWizard({ initial }: Props) {
  const router = useRouter();
  const { state: runState, start } = useMoveStream();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [residence, setResidence] = useState<ResolvedPlace[]>(
    initial.residence ? [initial.residence] : [],
  );
  const [targetKind, setTargetKind] = useState<"addresses" | "ambiguous">(
    initial.target?.kind === "ambiguous" ? "ambiguous" : "addresses",
  );
  const [targetPlaces, setTargetPlaces] = useState<ResolvedPlace[]>(
    initial.target && initial.target.kind !== "ambiguous"
      ? initial.target.places
      : [],
  );
  const [region, setRegion] = useState(
    initial.target?.kind === "ambiguous" ? initial.target.region : "",
  );
  const [tastePlaces, setTastePlaces] = useState<ResolvedPlace[]>(
    initial.tastes?.places ?? [],
  );
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(initial.tastes?.tags ?? []);
  const [priority, setPriority] = useState<TastePriority>(
    initial.tastes?.priorities?.[0] ?? "balanced",
  );
  const [infer, setInfer] = useState(
    initial.tastes?.inferredFromResidence ?? true,
  );

  useEffect(() => {
    if (runState.status === "done") {
      router.push(`/app/moves/${initial.id}/results`);
    }
  }, [runState, router, initial.id]);

  async function savePartial(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/moves/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || "Save failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function nextFromResidence() {
    if (residence.length !== 1) {
      setError("Pick exactly one current residence.");
      return;
    }
    await savePartial({ residence: residence[0] });
    setStep(1);
  }

  async function nextFromTargets() {
    let target: TargetScope;
    if (targetKind === "ambiguous") {
      if (region.trim().length < 2) {
        setError("Enter a country, state, or broad region.");
        return;
      }
      target = { kind: "ambiguous", region: region.trim() };
    } else {
      if (targetPlaces.length < 1) {
        setError("Add at least one target place.");
        return;
      }
      target = { kind: targetKind, places: targetPlaces };
    }
    await savePartial({ target });
    setStep(2);
  }

  async function nextFromTastes() {
    const tastes: TasteProfile = {
      places: tastePlaces,
      tags,
      priorities: [priority],
      inferredFromResidence: infer,
    };
    if (!infer && tastePlaces.length < 1 && tags.length < 1) {
      setError("Add taste places, tags, or enable inference from residence.");
      return;
    }
    await savePartial({ tastes });
    setStep(3);
  }

  async function run() {
    setError(null);
    await start(initial.id);
  }

  if (runState.status === "running") {
    const labels: Record<string, string> = {
      profile: "Profiling tastes",
      candidates: "Expanding destinations",
      score: "Scoring matches",
      write: "Writing summaries",
    };
    return (
      <CenteredOverlay className="mt-8 space-y-4">
        <h1 className="text-2xl font-semibold">Matching…</h1>
        <ol className="space-y-2">
          {(["profile", "candidates", "score", "write"] as const).map((s) => (
            <li key={s} className="flex gap-2 text-sm text-zinc-700">
              <span>
                {runState.steps[s] === "done"
                  ? "✓"
                  : runState.steps[s] === "start"
                    ? "…"
                    : "·"}
              </span>
              {labels[s]}
            </li>
          ))}
        </ol>
      </CenteredOverlay>
    );
  }

  return (
    <CenteredOverlay className="mt-8 space-y-6">
      <header>
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
          Plan your move
        </h1>
      </header>

      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded ${i <= step ? "bg-zinc-900" : "bg-zinc-200"}`}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <AddressPicker
            label="Current residence"
            selected={residence}
            onChange={(p) => setResidence(p.slice(-1))}
            max={1}
            placeholder="e.g. 347 5th Ave, Brooklyn, NY"
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => nextFromResidence().catch(() => {})}
            className="w-full rounded-md bg-zinc-900 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-zinc-700">Target scope</p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["addresses", "Homes"],
                ["ambiguous", "Region"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  if (k !== targetKind) {
                    setTargetPlaces([]);
                    setRegion("");
                  }
                  setTargetKind(k);
                }}
                className={`rounded-md border px-2 py-2 text-xs ${
                  targetKind === k
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {targetKind === "ambiguous" ? (
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. Oregon, USA"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          ) : (
            <AddressPicker
              label="Scouted homes / apartments"
              selected={targetPlaces}
              onChange={setTargetPlaces}
              max={8}
              placeholder="e.g. 347 5th Ave, Brooklyn, NY"
            />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="flex-1 rounded-md border border-zinc-300 py-3 text-sm"
            >
              Back
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => nextFromTargets().catch(() => {})}
              className="flex-1 rounded-md bg-zinc-900 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <PlacePicker
            label="Daily rituals & places you love"
            selected={tastePlaces}
            onChange={setTastePlaces}
            max={8}
            placeholder="Cafes, gyms, venues…"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={infer}
              onChange={(e) => setInfer(e.target.checked)}
            />
            Infer taste from my current residence
          </label>
          <div>
            <p className="text-sm font-medium text-zinc-700">Preference tags</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTags(tags.filter((x) => x !== t))}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-xs"
                >
                  {t} ×
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagInput.trim()) {
                    e.preventDefault();
                    setTags([...tags, tagInput.trim()]);
                    setTagInput("");
                  }
                }}
                placeholder="Add tag + Enter"
                className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-zinc-700">Priority</p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["rhyme", "Keep similar"],
                  ["balanced", "Balanced"],
                  ["depart", "Change"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPriority(k)}
                  className={`rounded-md border px-2 py-2 text-xs ${
                    priority === k
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 rounded-md border border-zinc-300 py-3 text-sm"
            >
              Back
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => nextFromTastes().catch(() => {})}
              className="flex-1 rounded-md bg-zinc-900 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600">
            Rank destinations by cultural fit. May take up to a minute.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 rounded-md border border-zinc-300 py-3 text-sm"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => run()}
              className="flex-1 rounded-md bg-zinc-900 py-3 text-sm font-medium text-white"
            >
              Rank destinations
            </button>
          </div>
          {runState.status === "error" && (
            <p className="text-sm text-red-600">{runState.message}</p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </CenteredOverlay>
  );
}
