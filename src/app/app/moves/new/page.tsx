"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function NewMovePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/moves", { method: "POST" });
        if (!res.ok) throw new Error("Could not create move");
        const move = await res.json();
        if (!cancelled) router.replace(`/app/moves/${move.id}`);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="pointer-events-auto mx-auto max-w-lg px-4 py-16 text-sm text-zinc-600">
      {error ? error : "Creating your move…"}
    </main>
  );
}
