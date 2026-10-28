"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BriefInput, type Mode } from "@/contracts";
import { PlacePicker } from "./PlacePicker";
import { ModeToggle } from "./ModeToggle";
import { Progress } from "./Progress";
import { useBriefStream } from "../hooks/useBriefStream";

type FormValues = {
  origin: { id: string; name: string }[];
  destination: string;
  mode: Mode;
};

export function BriefForm() {
  const router = useRouter();
  const { state, start } = useBriefStream();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(BriefInput),
    defaultValues: {
      origin: [],
      destination: "",
      mode: "rhyme",
    },
  });

  useEffect(() => {
    if (state.status === "done") {
      router.push(`/brief/${state.brief.id}`);
    }
  }, [state, router]);

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    await start(values);
  }

  if (state.status === "running") {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-16">
        <h1 className="text-2xl font-semibold text-zinc-900">Building your brief</h1>
        <Progress steps={state.steps} />
      </div>
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit, () =>
        setSubmitError("Add 3–6 places and a destination."),
      )}
      className="mx-auto max-w-lg space-y-8 px-4 py-12"
    >
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-zinc-500">Carry</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          Where should your week land next?
        </h1>
        <p className="text-zinc-600">
          Name the places that make up your week. Carry finds streets in a new
          city where those rituals would hold — or where daily life would
          change.
        </p>
      </header>

      <Controller
        control={form.control}
        name="origin"
        render={({ field }) => (
          <PlacePicker selected={field.value} onChange={field.onChange} />
        )}
      />

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-700">
          Destination city
        </label>
        <input
          {...form.register("destination")}
          placeholder="Portland, OR"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
        />
      </div>

      <Controller
        control={form.control}
        name="mode"
        render={({ field }) => (
          <ModeToggle value={field.value} onChange={field.onChange} />
        )}
      />

      {(submitError || state.status === "error") && (
        <p className="text-sm text-red-600">
          {state.status === "error" ? state.message : submitError}
        </p>
      )}

      <button
        type="submit"
        className="w-full rounded-md bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Build landing brief
      </button>
    </form>
  );
}
