import { NextRequest, NextResponse } from "next/server";
import { getGoogleConnection, googleCalendarConfigured, googleRedirectUri } from "@/lib/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId") || "";
  const connection = workspaceId ? getGoogleConnection(workspaceId) : undefined;
  return NextResponse.json({ configured: googleCalendarConfigured(), connected: Boolean(connection), redirectUri: googleRedirectUri(request.nextUrl.origin) });
}
