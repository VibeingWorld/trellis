import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { getGoogleCredentials, googleRedirectUri } from "@/lib/google-calendar";
import { appPath, publicOrigin } from "@/lib/app-path";
import { getSessionUser, requirePermission, SESSION_COOKIE } from '@/lib/auth';

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user=getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);if(!user)return NextResponse.json({error:'Please sign in.'},{status:401});
  const workspaceId = request.nextUrl.searchParams.get("workspaceId") || "";
  try{requirePermission(user,workspaceId,'manageWorkspace');}catch{return NextResponse.json({error:'Workspace not found.'},{status:404});}
  if (!sqlite.prepare("SELECT id FROM workspaces WHERE id=?").get(workspaceId)) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  const credentials = getGoogleCredentials();
  if (!credentials) return NextResponse.json({ error: "Complete Google setup in the Calendar panel first." }, { status: 503 });
  const state = randomUUID();
  const redirectUri = googleRedirectUri(publicOrigin(request));
  const params = new URLSearchParams({ client_id: credentials.clientId, redirect_uri: redirectUri, response_type: "code", scope: "https://www.googleapis.com/auth/calendar.events", access_type: "offline", prompt: "consent", include_granted_scopes: "true", state });
  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  const options = { httpOnly: true, sameSite: "lax" as const, secure: request.nextUrl.protocol === "https:", maxAge: 600, path: appPath("/api/calendar/google/callback") };
  response.cookies.set("cove_google_state", state, options);
  response.cookies.set("cove_google_workspace", workspaceId, options);
  return response;
}
