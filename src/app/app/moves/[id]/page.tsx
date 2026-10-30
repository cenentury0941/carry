import { notFound } from "next/navigation";
import { MoveWizard } from "@/client/components/MoveWizard";
import { requireUserId } from "@/server/auth";
import { getMoveForUser } from "@/server/move-store";

export const dynamic = "force-dynamic";

export default async function MoveWizardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;
  const move = await getMoveForUser(id, userId);
  if (!move) notFound();

  if (move.status === "ready" && move.result) {
    // Server redirect alternative: link from dashboard; allow re-edit via wizard
  }

  return <MoveWizard initial={move} />;
}
