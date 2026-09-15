import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { getGoogleCredentials, googleRedirectUri } from "@/lib/google-calendar";
import { appPath } from "@/lib/app-path";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId") || "";
  if (!sqlite.prepare("SELECT id FROM workspaces WHERE id=?").get(workspaceId)) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  const credentials = getGoogleCredentials();
  if (!credentials) return NextResponse.json({ error: "Complete Google setup in the Calendar panel first." }, { status: 503 });
  const state = randomUUID();
  const redirectUri = googleRedirectUri(request.nextUrl.origin);
  const params = new URLSearchParams({ client_id: credentials.clientId, redirect_uri: redirectUri, response_type: "code", scope: "https://www.googleapis.com/auth/calendar.events", access_type: "offline", prompt: "consent", include_granted_scopes: "true", state });
  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  const options = { httpOnly: true, sameSite: "lax" as const, secure: request.nextUrl.protocol === "https:", maxAge: 600, path: appPath("/api/calendar/google/callback") };
  response.cookies.set("cove_google_state", state, options);
  response.cookies.set("cove_google_workspace", workspaceId, options);
  return response;
}
