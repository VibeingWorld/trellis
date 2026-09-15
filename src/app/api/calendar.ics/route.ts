import { NextRequest, NextResponse } from "next/server";
import { getState } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeIcs(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");
}

function compactDate(date: string) {
  return date.replaceAll("-", "");
}

function compactDateTime(date: string) {
  return new Date(date).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function nextDate(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  const state = getState();
  const workspace = state.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const events = state.cards.filter((card) => card.workspaceId === workspace.id && card.dueDate && !card.archived).flatMap((card) => {
    const cardUrl = `${request.nextUrl.origin}/cards/${encodeURIComponent(card.id)}`;
    return [
      "BEGIN:VEVENT",
      `UID:${escapeIcs(card.id)}@cove`,
      `DTSTAMP:${stamp}`,
      card.scheduledStart ? `DTSTART:${compactDateTime(card.scheduledStart)}` : `DTSTART;VALUE=DATE:${compactDate(card.dueDate!)}`,
      card.scheduledStart ? `DTEND:${compactDateTime(card.scheduledEnd || new Date(Date.parse(card.scheduledStart) + 3600000).toISOString())}` : `DTEND;VALUE=DATE:${compactDate(nextDate(card.dueDate!))}`,
      `SUMMARY:${escapeIcs(card.title)}`,
      `DESCRIPTION:${escapeIcs(`${card.description || "Cove card"}\n\n${cardUrl}`)}`,
      `URL:${cardUrl}`,
      "END:VEVENT",
    ];
  });
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cove//Workspace Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(`${workspace.name} · Cove`)}`,
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="cove-${workspace.id}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
