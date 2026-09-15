"use client";

import { useMemo, useState, type CSSProperties, type DragEvent } from "react";
import type { AppState, Card, TrayItem } from "./api";
import { Icon } from "./Icon";

type CalendarView = "month" | "week" | "workweek" | "day";
type Schedule = { dueDate: string | null; scheduledStart: string | null; scheduledEnd: string | null };
type CalendarPanelProps = { state: AppState; workspaceId: string; trayItems: TrayItem[]; busy: boolean; onSchedule: (cardId: string, schedule: Schedule) => Promise<unknown>; onOpenCard: (cardId: string) => void; onNotice: (message: string) => void };

function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function addDays(date: Date, amount: number) { return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount); }
function monday(date: Date) { return addDays(date, -((date.getDay() + 6) % 7)); }
function localDateTime(date: Date, hour: number) { return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour); }
function cardDay(card: Card) { return card.scheduledStart ? dateKey(new Date(card.scheduledStart)) : card.dueDate || ""; }
function timeLabel(value?: string | null) { return value ? new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "All day"; }
function compactGoogleDate(value: Date) { return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
function googleEventUrl(card: Card, origin: string) {
  let dates: string;
  if (card.scheduledStart) {
    const start = new Date(card.scheduledStart), end = card.scheduledEnd ? new Date(card.scheduledEnd) : new Date(start.getTime() + 60 * 60 * 1000);
    dates = `${compactGoogleDate(start)}/${compactGoogleDate(end)}`;
  } else {
    const start = card.dueDate!.replaceAll("-", ""), end = addDays(new Date(`${card.dueDate}T12:00:00`), 1);
    dates = `${start}/${dateKey(end).replaceAll("-", "")}`;
  }
  return `https://calendar.google.com/calendar/render?${new URLSearchParams({ action: "TEMPLATE", text: card.title, dates, details: `${card.description || "Cove card"}\n\n${origin}/cards/${card.id}` })}`;
}

export function CalendarPanel({ state, workspaceId, trayItems, busy, onSchedule, onOpenCard, onNotice }: CalendarPanelProps) {
  const today = useMemo(() => new Date(), []);
  const [anchor, setAnchor] = useState(today);
  const [view, setView] = useState<CalendarView>("month");
  const [dragTarget, setDragTarget] = useState("");
  const workspaceCards = state.cards.filter((card) => card.workspaceId === workspaceId && !card.archived);
  const scheduled = workspaceCards.filter((card) => card.dueDate || card.scheduledStart);
  const hours = Array.from({ length: 24 }, (_, index) => index);

  const monthDays = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    return Array.from({ length: 42 }, (_, index) => addDays(first, -((first.getDay() + 6) % 7) + index));
  }, [anchor]);
  const timelineDays = useMemo(() => {
    if (view === "day") return [anchor];
    const start = monday(anchor);
    return Array.from({ length: view === "workweek" ? 5 : 7 }, (_, index) => addDays(start, index));
  }, [anchor, view]);

  function cardFromDrag(event: DragEvent) {
    const raw = event.dataTransfer.getData("application/cove-card") || event.dataTransfer.getData("text/plain");
    try {
      const payload = JSON.parse(raw) as { type: "placement" | "tray"; id: string };
      const placementId = payload.type === "tray" ? state.tray.find((item) => item.id === payload.id)?.placementId : payload.id;
      return state.cards.find((card) => card.id === state.placements.find((item) => item.id === placementId)?.cardId);
    } catch { return undefined; }
  }
  async function dropAllDay(event: DragEvent, date: Date) {
    event.preventDefault(); setDragTarget(""); const card = cardFromDrag(event);
    if (card) await onSchedule(card.id, { dueDate: dateKey(date), scheduledStart: null, scheduledEnd: null });
  }
  async function dropAtHour(event: DragEvent, date: Date, hour: number) {
    event.preventDefault(); setDragTarget(""); const card = cardFromDrag(event); if (!card) return;
    const start = localDateTime(date, hour), end = new Date(start.getTime() + 60 * 60 * 1000);
    await onSchedule(card.id, { dueDate: dateKey(date), scheduledStart: start.toISOString(), scheduledEnd: end.toISOString() });
  }
  function dragCard(event: DragEvent, card: Card) {
    const placement = state.placements.find((item) => item.cardId === card.id); if (!placement) return;
    const payload = JSON.stringify({ type: "placement", id: placement.id });
    event.dataTransfer.setData("application/cove-card", payload); event.dataTransfer.setData("text/plain", payload); event.dataTransfer.effectAllowed = "copyMove";
  }
  async function copyFeed() { await navigator.clipboard.writeText(`${window.location.origin}/api/calendar.ics?workspaceId=${encodeURIComponent(workspaceId)}`); onNotice("Calendar feed URL copied"); }
  function shift(amount: number) { if (view === "month") setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + amount, 1)); else setAnchor(addDays(anchor, amount * (view === "day" ? 1 : 7))); }
  const label = view === "month" ? anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" }) : timelineDays.length === 1 ? anchor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : `${timelineDays[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${timelineDays.at(-1)!.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  const feedPath = `/api/calendar.ics?workspaceId=${encodeURIComponent(workspaceId)}`;

  return <div className="calendar-panel">
    <div className="calendar-intro"><div><strong>Plan work in time.</strong><p>Drag directly from any board column or from your tray.</p></div><span>{scheduled.length} scheduled</span></div>
    <div className="calendar-connect">
      <div><Icon name="link" size={15} /><span><strong>Use any calendar</strong><small>No OAuth or app setup. Add individual cards to Google, or export the workspace.</small></span></div>
      <div className="calendar-connect-actions">
        <a href="https://calendar.google.com/calendar/u/0/r" target="_blank" rel="noreferrer">Open Google Calendar <Icon name="external" size={11} /></a>
        <button type="button" onClick={() => void copyFeed()}><Icon name="copy" size={12} />Copy ICS feed</button><a href={feedPath} download>Download .ics</a>
      </div>
    </div>
    <div className="calendar-view-switch" role="tablist" aria-label="Calendar view">{([["month","Month"],["week","Week"],["workweek","5 days"],["day","Day"]] as [CalendarView,string][]).map(([id, name]) => <button key={id} role="tab" aria-selected={view === id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{name}</button>)}</div>
    <div className="calendar-nav"><button type="button" className="icon-button" aria-label="Previous period" onClick={() => shift(-1)}>‹</button><h3>{label}</h3><div><button type="button" onClick={() => setAnchor(new Date())}>Today</button><button type="button" className="icon-button" aria-label="Next period" onClick={() => shift(1)}>›</button></div></div>

    {view === "month" ? <><div className="calendar-weekdays">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{monthDays.map((date) => {
      const key = dateKey(date), cards = scheduled.filter((card) => cardDay(card) === key);
      return <div key={key} className={`calendar-day ${date.getMonth() !== anchor.getMonth() ? "muted" : ""} ${key === dateKey(today) ? "today" : ""} ${dragTarget === key ? "drag-over" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragTarget(key); }} onDragLeave={() => setDragTarget("")} onDrop={(event) => void dropAllDay(event, date)}><span className="calendar-date">{date.getDate()}</span><div className="calendar-day-cards">{cards.map((card) => <article key={card.id} draggable onDragStart={(event) => dragCard(event, card)}><button type="button" onClick={() => onOpenCard(card.id)} title={card.title}>{card.scheduledStart && <small>{timeLabel(card.scheduledStart)}</small>}{card.title}</button><div><button type="button" disabled={busy} aria-label={`Remove ${card.title} from calendar`} onClick={() => void onSchedule(card.id, { dueDate: null, scheduledStart: null, scheduledEnd: null })}>×</button><a href={googleEventUrl(card, window.location.origin)} target="_blank" rel="noreferrer" aria-label={`Add ${card.title} to Google Calendar`} title="Add to Google Calendar"><Icon name="external" size={9} /></a></div></article>)}</div></div>;
    })}</div></> : <div className="calendar-timeline" style={{ "--calendar-days": timelineDays.length } as CSSProperties}>
      <div className="calendar-time-corner">Local</div>{timelineDays.map((date) => <div key={dateKey(date)} className={`calendar-timeline-heading ${dateKey(date) === dateKey(today) ? "today" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragTarget(`${dateKey(date)}-all`); }} onDrop={(event) => void dropAllDay(event, date)}><span>{date.toLocaleDateString(undefined, { weekday: "short" })}</span><strong>{date.getDate()}</strong>{scheduled.filter((card) => cardDay(card) === dateKey(date) && !card.scheduledStart).map((card) => <button key={card.id} draggable onDragStart={(event) => dragCard(event, card)} onClick={() => onOpenCard(card.id)}>{card.title}</button>)}</div>)}
      {hours.flatMap((hour) => [<div key={`time-${hour}`} className="calendar-hour-label">{new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, { hour: "numeric" })}</div>, ...timelineDays.map((date) => {
        const target = `${dateKey(date)}-${hour}`, cards = scheduled.filter((card) => card.scheduledStart && cardDay(card) === dateKey(date) && new Date(card.scheduledStart).getHours() === hour);
        return <div key={target} className={`calendar-hour ${dragTarget === target ? "drag-over" : ""}`} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragTarget(target); }} onDragLeave={() => setDragTarget("")} onDrop={(event) => void dropAtHour(event, date, hour)}>{cards.map((card) => <button key={card.id} draggable onDragStart={(event) => dragCard(event, card)} onClick={() => onOpenCard(card.id)} title={`${timeLabel(card.scheduledStart)} · ${card.title}`}><small>{timeLabel(card.scheduledStart)}</small>{card.title}</button>)}</div>;
      })])}
    </div>}

    <div className="calendar-unscheduled"><h3>From your tray</h3>{trayItems.length === 0 ? <p>You can drag cards straight from the board, or collect them in your tray first.</p> : trayItems.map((item) => {
      const placement = state.placements.find((entry) => entry.id === item.placementId), card = state.cards.find((entry) => entry.id === placement?.cardId); if (!card) return null;
      return <div key={item.id} draggable onDragStart={(event) => { const payload = JSON.stringify({ type: "tray", id: item.id }); event.dataTransfer.setData("application/cove-card", payload); event.dataTransfer.setData("text/plain", payload); }}><Icon name="tray" size={12} /><span>{card.title}</span><small>{card.scheduledStart ? timeLabel(card.scheduledStart) : card.dueDate || "Drop on a day or hour"}</small></div>;
    })}</div>
  </div>;
}
