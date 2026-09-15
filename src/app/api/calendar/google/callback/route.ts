import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { getGoogleCredentials, googleRedirectUri, saveGoogleConnection, syncCardToGoogle } from "@/lib/google-calendar";

export const runtime = "nodejs";

function finish(result: "connected" | "error") {
  const title = result === "connected" ? "Google Calendar connected" : "Connection not completed";
  const message = result === "connected" ? "You can close this window and return to Cove." : "Close this window and try connecting again.";
  return new NextResponse(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fbf7f0;color:#574536;font:16px system-ui}.card{max-width:360px;padding:36px;text-align:center;background:#fffaf4;border:1px solid #e2d5c7;border-radius:18px;box-shadow:0 18px 60px #6f51321c}h1{font-size:22px}p{color:#806d5b;line-height:1.55}button{padding:10px 16px;color:white;background:#76583f;border:0;border-radius:9px;font-weight:700}</style></head><body><main class="card"><h1>${title}</h1><p>${message}</p><button onclick="window.close()">Close window</button></main><script>if(window.opener){window.opener.postMessage({type:'cove-google-calendar',result:'${result}'},'*');setTimeout(()=>window.close(),700)}</script></body></html>`, { status: result === "connected" ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'" } });
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const savedState = request.cookies.get("cove_google_state")?.value;
  const workspaceId = request.cookies.get("cove_google_workspace")?.value;
  const credentials = getGoogleCredentials();
  if (!code || !state || state !== savedState || !workspaceId || !credentials) return finish("error");
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: credentials.clientId, client_secret: credentials.clientSecret, redirect_uri: googleRedirectUri(request.nextUrl.origin), grant_type: "authorization_code" }),
    });
    const result = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!response.ok || !result.access_token) return finish("error");
    saveGoogleConnection(workspaceId, { access_token: result.access_token, refresh_token: result.refresh_token, expires_in: result.expires_in });
    const cards = sqlite.prepare("SELECT id FROM cards WHERE workspace_id=? AND archived=0 AND (due_date IS NOT NULL OR scheduled_start IS NOT NULL)").all(workspaceId) as { id: string }[];
    await Promise.allSettled(cards.map((card) => syncCardToGoogle(card.id, request.nextUrl.origin)));
    const redirect = finish("connected");
    const options = { httpOnly: true, sameSite: "lax" as const, secure: request.nextUrl.protocol === "https:", maxAge: 0, path: "/api/calendar/google/callback" };
    redirect.cookies.set("cove_google_state", "", options); redirect.cookies.set("cove_google_workspace", "", options);
    return redirect;
  } catch { return finish("error"); }
}
