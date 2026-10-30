"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useState } from "react";
import { GlobeProvider } from "@/client/components/globe/GlobeContext";
import { DefaultGlobe } from "@/client/components/globe/DefaultGlobe";

function clerkConfigured() {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return Boolean(pk && !pk.includes("placeholder"));
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );

  const inner = (
    <NuqsAdapter>
      <QueryClientProvider client={client}>
        <GlobeProvider>
          <DefaultGlobe />
          <div className="pointer-events-none relative z-10">{children}</div>
        </GlobeProvider>
      </QueryClientProvider>
    </NuqsAdapter>
  );

  if (!clerkConfigured()) {
    return inner;
  }

  return <ClerkProvider>{inner}</ClerkProvider>;
}
