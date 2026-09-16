import BoardApp from "@/components/board/BoardApp";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";

export default async function Home() {
  const cookieStore = await cookies();
  if (!getSessionUser(cookieStore.get(SESSION_COOKIE)?.value)) redirect('/login');
  return <BoardApp />;
}
