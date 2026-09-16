import { NextRequest, NextResponse } from "next/server";
import { getGoogleConnection, googleCalendarConfigured, googleRedirectUri } from "@/lib/google-calendar";
import { publicOrigin } from "@/lib/app-path";
import { getSessionUser, requirePermission, SESSION_COOKIE } from '@/lib/auth';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user=getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);if(!user)return NextResponse.json({error:'Please sign in.'},{status:401});
  const workspaceId = request.nextUrl.searchParams.get("workspaceId") || "";
  if(workspaceId)try{requirePermission(user,workspaceId,'read');}catch{return NextResponse.json({error:'Workspace not found.'},{status:404});}
  const connection = workspaceId ? getGoogleConnection(workspaceId) : undefined;
  return NextResponse.json({ configured: googleCalendarConfigured(), connected: Boolean(connection), redirectUri: googleRedirectUri(publicOrigin(request)) });
}
