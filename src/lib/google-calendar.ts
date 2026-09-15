import { randomUUID } from "node:crypto";
import { sqlite } from "@/db";
import { appPath } from "@/lib/app-path";

type Connection = {
  id: string;
  workspace_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: number;
  calendar_id: string;
};

export function googleCalendarConfigured() {
  return Boolean(getGoogleCredentials());
}

export function getGoogleCredentials() {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) return { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, source: "environment" as const };
  const stored = sqlite.prepare("SELECT client_id,client_secret FROM google_oauth_settings WHERE id='default'").get() as { client_id: string; client_secret: string } | undefined;
  return stored ? { clientId: stored.client_id, clientSecret: stored.client_secret, source: "local" as const } : null;
}

export function saveGoogleCredentials(clientId: string, clientSecret: string) {
  const now = Date.now();
  sqlite.prepare("INSERT INTO google_oauth_settings (id,client_id,client_secret,created_at,updated_at) VALUES ('default',?,?,?,?) ON CONFLICT(id) DO UPDATE SET client_id=excluded.client_id,client_secret=excluded.client_secret,updated_at=excluded.updated_at").run(clientId, clientSecret, now, now);
}

export function googleRedirectUri(origin: string) {
  return process.env.GOOGLE_REDIRECT_URI || `${origin}${appPath("/api/calendar/google/callback")}`;
}

export function getGoogleConnection(workspaceId: string) {
  return sqlite.prepare("SELECT * FROM calendar_connections WHERE workspace_id=? AND provider='google'").get(workspaceId) as Connection | undefined;
}

export function saveGoogleConnection(workspaceId: string, token: { access_token: string; refresh_token?: string; expires_in?: number }) {
  const existing = getGoogleConnection(workspaceId);
  const now = Date.now();
  const expiresAt = now + (token.expires_in || 3600) * 1000;
  if (existing) {
    sqlite.prepare("UPDATE calendar_connections SET access_token=?,refresh_token=?,expires_at=?,updated_at=? WHERE id=?").run(token.access_token, token.refresh_token || existing.refresh_token, expiresAt, now, existing.id);
    return existing.id;
  }
  const id = randomUUID();
  sqlite.prepare("INSERT INTO calendar_connections (id,workspace_id,provider,access_token,refresh_token,expires_at,calendar_id,created_at,updated_at) VALUES (?,?,'google',?,?,?,'primary',?,?)").run(id, workspaceId, token.access_token, token.refresh_token || null, expiresAt, now, now);
  return id;
}

async function accessToken(connection: Connection) {
  if (connection.expires_at > Date.now() + 60_000) return connection.access_token;
  const credentials = getGoogleCredentials();
  if (!connection.refresh_token || !credentials) throw new Error("Reconnect Google Calendar to continue syncing.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: credentials.clientId, client_secret: credentials.clientSecret, refresh_token: connection.refresh_token, grant_type: "refresh_token" }),
  });
  const result = await response.json() as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !result.access_token) throw new Error(result.error_description || "Google Calendar authorization expired.");
  const expiresAt = Date.now() + (result.expires_in || 3600) * 1000;
  sqlite.prepare("UPDATE calendar_connections SET access_token=?,expires_at=?,updated_at=? WHERE id=?").run(result.access_token, expiresAt, Date.now(), connection.id);
  return result.access_token;
}

function endDate(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export async function syncCardToGoogle(cardId: string, origin: string) {
  const card = sqlite.prepare("SELECT * FROM cards WHERE id=?").get(cardId) as { id: string; workspace_id: string; title: string; description: string; due_date: string | null; scheduled_start: string | null; scheduled_end: string | null; archived: number } | undefined;
  if (!card) return;
  const connection = getGoogleConnection(card.workspace_id);
  if (!connection) return;
  const mapping = sqlite.prepare("SELECT id,external_event_id FROM calendar_events WHERE connection_id=? AND card_id=?").get(connection.id, card.id) as { id: string; external_event_id: string } | undefined;
  const token = await accessToken(connection);
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id)}/events`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (card.archived || (!card.due_date && !card.scheduled_start)) {
    if (mapping) {
      await fetch(`${base}/${encodeURIComponent(mapping.external_event_id)}`, { method: "DELETE", headers });
      sqlite.prepare("DELETE FROM calendar_events WHERE id=?").run(mapping.id);
    }
    return;
  }
  const event = {
    summary: card.title,
    description: `${card.description || "Cove card"}\n\nOpen card: ${origin}${appPath(`/cards/${encodeURIComponent(card.id)}`)}`,
    ...(card.scheduled_start ? {
      start: { dateTime: card.scheduled_start },
      end: { dateTime: card.scheduled_end || new Date(Date.parse(card.scheduled_start) + 60 * 60 * 1000).toISOString() },
    } : { start: { date: card.due_date }, end: { date: endDate(card.due_date!) } }),
    extendedProperties: { private: { coveCardId: card.id } },
  };
  let response = mapping ? await fetch(`${base}/${encodeURIComponent(mapping.external_event_id)}`, { method: "PATCH", headers, body: JSON.stringify(event) }) : null;
  if (response?.status === 404) {
    sqlite.prepare("DELETE FROM calendar_events WHERE id=?").run(mapping!.id);
    response = null;
  }
  if (!response) response = await fetch(base, { method: "POST", headers, body: JSON.stringify(event) });
  const result = await response.json().catch(() => ({})) as { id?: string; error?: { message?: string } };
  if (!response.ok || !result.id) throw new Error(result.error?.message || "Google Calendar could not sync this card.");
  if (!mapping || response.status === 200 && result.id !== mapping.external_event_id) {
    sqlite.prepare("INSERT OR REPLACE INTO calendar_events (id,connection_id,card_id,external_event_id) VALUES (?,?,?,?)").run(randomUUID(), connection.id, card.id, result.id);
  }
}
