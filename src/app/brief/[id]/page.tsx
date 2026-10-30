import Link from "next/link";
import { notFound } from "next/navigation";
import { BriefPageClient } from "./BriefPageClient";
import { getBrief } from "@/server/store";

export const dynamic = "force-dynamic";

export default async function BriefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const brief = await getBrief(id);
  if (!brief) notFound();

  return (
    <main className="pointer-events-auto">
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm font-medium text-zinc-900">
            Carry
          </Link>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
            New brief
          </Link>
        </div>
      </div>
      <BriefPageClient initial={brief} />
    </main>
  );
}
