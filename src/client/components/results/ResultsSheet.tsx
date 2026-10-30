"use client";

import type { ReactNode } from "react";

type Props = {
  expanded: boolean;
  onClose: () => void;
  peek: ReactNode;
  children: ReactNode;
  /** Right-side chat — only rendered while expanded. */
  chat?: ReactNode;
};

export function ResultsSheet({
  expanded,
  onClose,
  peek,
  children,
  chat,
}: Props) {
  if (!expanded) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center pb-5">
        <div className="pointer-events-auto w-full max-w-5xl px-3 sm:px-4">
          {peek}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: destination sheet + chat stacked */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col md:hidden">
        <div className="pointer-events-auto flex h-[52vh] w-full flex-col rounded-t-2xl border border-zinc-200 bg-white/95 shadow-2xl backdrop-blur-md">
          <SheetChrome title="Destination" onClose={onClose}>
            {children}
          </SheetChrome>
        </div>
        {chat && (
          <div className="pointer-events-auto flex h-[36vh] w-full flex-col border-t border-zinc-200 bg-white/95 shadow-2xl backdrop-blur-md">
            {chat}
          </div>
        )}
      </div>

      {/* Desktop: destination left, chat right */}
      <div className="pointer-events-none fixed bottom-3 left-3 top-[4.75rem] z-30 hidden md:block md:w-[min(30vw,28rem)]">
        <div className="pointer-events-auto flex h-full w-full flex-col rounded-2xl border border-zinc-200 bg-white/95 shadow-2xl backdrop-blur-md">
          <SheetChrome title="Destination" onClose={onClose}>
            {children}
          </SheetChrome>
        </div>
      </div>
      {chat && (
        <div className="pointer-events-none fixed bottom-3 right-3 top-[4.75rem] z-30 hidden md:block md:w-[min(30vw,28rem)]">
          <div className="pointer-events-auto flex h-full w-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 shadow-2xl backdrop-blur-md">
            {chat}
          </div>
        </div>
      )}
    </>
  );
}

function SheetChrome({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3">
        <p className="text-sm font-semibold text-zinc-900">{title}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
    </>
  );
}
