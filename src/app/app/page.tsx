import Link from "next/link";
import { requireUserId } from "@/server/auth";
import { listMovesForUser } from "@/server/move-store";
import { CenteredOverlay } from "@/client/components/CenteredOverlay";
import { MovesList } from "@/client/components/MovesList";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const userId = await requireUserId();
  const moves = await listMovesForUser(userId);

  return (
    <CenteredOverlay maxWidth="lg" className="mt-8 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Your moves</h1>
          <p className="mt-1 text-sm text-zinc-600">Draft, run, compare.</p>
        </div>
        <Link
          href="/app/moves/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          New move
        </Link>
      </div>

      <MovesList initialMoves={moves} />
    </CenteredOverlay>
  );
}
