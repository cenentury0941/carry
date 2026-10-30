"use client";

import { airportCode } from "@/client/lib/airportCode";

type Props = {
  sourceName: string;
  sourceAddress?: string;
  destName: string;
  destAddress?: string;
  continuity?: number;
  selected?: boolean;
  onClick?: () => void;
  compact?: boolean;
  /** When false, render a non-interactive card (for carousel side slots). */
  interactive?: boolean;
};

export function BoardingPass({
  sourceName,
  sourceAddress,
  destName,
  destAddress,
  continuity,
  selected,
  onClick,
  compact = true,
  interactive = true,
}: Props) {
  const from = airportCode(sourceName);
  const to = airportCode(destName);

  const className = `relative shrink-0 rounded-xl border text-left transition ${
    selected
      ? "border-amber-400 ring-2 ring-amber-300/60"
      : "border-zinc-200"
  } ${
    interactive && onClick
      ? "cursor-pointer hover:border-zinc-400"
      : "pointer-events-none"
  } ${compact ? "w-[22rem] min-h-[9.5rem]" : "w-full"} bg-[#f7f4ef] shadow-md`;

  const body = (
    <>
      <div className="flex min-h-[inherit] items-stretch overflow-hidden rounded-xl">
        <div className="min-w-0 flex-1 px-5 py-4">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-3xl font-bold tracking-widest text-zinc-900">
                {from}
              </p>
              <p className="mt-1 line-clamp-2 text-[11px] uppercase leading-snug tracking-wide text-zinc-500">
                {sourceName}
              </p>
            </div>
            <div className="mb-1 shrink-0 text-zinc-400">
              <span className="text-xl leading-none">→</span>
            </div>
            <div className="min-w-0 flex-1 text-right">
              <p className="font-mono text-3xl font-bold tracking-widest text-zinc-900">
                {to}
              </p>
              <p className="mt-1 line-clamp-2 text-[11px] uppercase leading-snug tracking-wide text-zinc-500">
                {destName}
              </p>
            </div>
          </div>
          <div className="mt-3 border-t border-dashed border-zinc-300 pt-2.5">
            <p className="line-clamp-2 text-sm font-medium leading-snug text-zinc-800">
              {destName}
            </p>
            {(destAddress || sourceAddress) && (
              <p className="mt-1 line-clamp-2 text-xs leading-snug text-zinc-500">
                {destAddress || sourceAddress}
              </p>
            )}
          </div>
          {typeof continuity === "number" && (
            <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
              Continuity {continuity}
            </p>
          )}
        </div>
        <div className="flex w-9 shrink-0 flex-col items-center justify-center border-l border-dashed border-zinc-300 bg-[#efeae2]">
          <span
            className="origin-center rotate-180 font-mono text-[10px] tracking-[0.2em] text-zinc-500"
            style={{ writingMode: "vertical-rl" }}
          >
            CARRY
          </span>
        </div>
      </div>
      <div className="pointer-events-none absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-slate-900/90" />
      <div className="pointer-events-none absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-slate-900/90" />
    </>
  );

  if (interactive && onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}
