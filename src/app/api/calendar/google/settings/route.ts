import { NextRequest, NextResponse } from "next/server";
import { saveGoogleCredentials } from "@/lib/google-calendar";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin"), host = request.headers.get("host");
  if (origin && (!host || new URL(origin).host !== host)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const body = await request.json().catch(() => null) as { clientId?: unknown; clientSecret?: unknown } | null;
  const clientId = typeof body?.clientId === "string" ? body.clientId.trim() : "";
  const clientSecret = typeof body?.clientSecret === "string" ? body.clientSecret.trim() : "";
  if (!clientId.endsWith(".apps.googleusercontent.com")) return NextResponse.json({ error: "Enter a valid Google OAuth client ID." }, { status: 400 });
  if (clientSecret.length < 8) return NextResponse.json({ error: "Enter the Google OAuth client secret." }, { status: 400 });
  saveGoogleCredentials(clientId, clientSecret);
  return NextResponse.json({ ok: true });
}
