import { notFound, redirect } from "next/navigation";
import { getState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function CardPermalink({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = getState();
  const card = state.cards.find((item) => item.id === id && !item.archived);
  if (!card) notFound();
  const placement = state.placements.find((item) => item.cardId === card.id);
  if (!placement) notFound();
  redirect(`/?board=${encodeURIComponent(placement.boardId)}&card=${encodeURIComponent(card.id)}`);
}
