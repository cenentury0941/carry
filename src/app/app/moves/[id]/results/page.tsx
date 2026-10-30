import { notFound } from "next/navigation";
import { MoveResults } from "@/client/components/MoveResults";
import { requireUserId } from "@/server/auth";
import { getMoveForUser } from "@/server/move-store";

export const dynamic = "force-dynamic";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;
  const move = await getMoveForUser(id, userId);
  if (!move) notFound();
  return <MoveResults move={move} />;
}
