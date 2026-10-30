"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg";
};

const maxMap = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
} as const;

/** Glass panel centered over the globe background. */
export function CenteredOverlay({
  children,
  className = "",
  maxWidth = "lg",
}: Props) {
  return (
    <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-16">
      <div
        className={`pointer-events-auto w-full ${maxMap[maxWidth]} rounded-2xl border border-white/40 bg-white/85 p-6 shadow-xl backdrop-blur-md ${className}`}
      >
        {children}
      </div>
    </main>
  );
}
