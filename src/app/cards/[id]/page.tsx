import { notFound, redirect } from "next/navigation";
import { getState } from "@/lib/store";
import { appPath } from "@/lib/app-path";
import { cookies } from "next/headers";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CardPermalink({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore=await cookies(),user=getSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
  if(!user)redirect(appPath('/login'));
  const state = getState(user);
  const card = state.cards.find((item) => item.id === id && !item.archived);
  if (!card) notFound();
  const placement = state.placements.find((item) => item.cardId === card.id);
  if (!placement) notFound();
  redirect(appPath(`/?board=${encodeURIComponent(placement.boardId)}&card=${encodeURIComponent(card.id)}`));
}
