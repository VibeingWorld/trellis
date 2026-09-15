import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin"), host = request.headers.get("host");
  if (origin && (!host || new URL(origin).host !== host)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const { workspaceId } = await request.json() as { workspaceId?: string };
  if (!workspaceId) return NextResponse.json({ error: "Workspace is required." }, { status: 400 });
  sqlite.prepare("DELETE FROM calendar_connections WHERE workspace_id=? AND provider='google'").run(workspaceId);
  return NextResponse.json({ ok: true });
}
