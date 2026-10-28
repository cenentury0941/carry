"use client";

import { useState } from "react";
import type { Brief } from "@/contracts";
import { BriefView } from "@/client/components/BriefView";

export function BriefPageClient({ initial }: { initial: Brief }) {
  const [brief, setBrief] = useState(initial);
  return <BriefView brief={brief} onUpdated={setBrief} />;
}
