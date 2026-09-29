"use client";

import { useEffect, useLayoutEffect, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent } from "react";
import type { ActionResult, AppState, Board, Card } from "./api";
import { Icon } from "./Icon";
import { NoteEditor } from "./NoteEditor";
import { PinboardCanvas, type Pin } from "./PinboardCanvas";
import { NOTE_COLORS } from "@/lib/note-colors";

type Props = {
  board: Board; state: AppState; notes: Card[]; allNotes: Card[]; filter: string; onFilter: (value: string) => void; busy: boolean; canEdit: boolean; canManage: boolean; onSettings: () => void;
  onMutate: (name: string, payload: Record<string, unknown>, message?: string) => Promise<ActionResult | false>;
};
type Point = { x: number; y: number };
type ActiveDrag = { id: string; pointerId: number; pointerX: number; pointerY: number; x: number; y: number; nextX: number; nextY: number };

const NOTE_WIDTH = 320, NOTE_HEIGHT = 250;
const defaultPoint = (index: number, columns: number): Point => ({ x: 30 + (index % columns) * 360, y: 30 + Math.floor(index / columns) * 300 });
const clamp = (value: number, maximum: number) => Math.max(0, Math.min(maximum, value));
const ZOOM_STEPS = [0.5, 0.65, 0.8, 1, 1.25, 1.5, 1.75, 2];

export function StickyBoard({ board, state, notes, allNotes, filter, onFilter, busy, canEdit, canManage, onSettings, onMutate }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const pendingZoom = useRef<{ x: number; y: number; focusX: number; focusY: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [space, setSpace] = useState({ width: 0, height: 0 });
  const [editing, setEditing] = useState<Card | "new" | null>(null);
  const [dropping, setDropping] = useState(false);
  const [draftPoints, setDraftPoints] = useState<Record<string, Point>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [liftedId, setLiftedId] = useState<string | null>(null);
  const drag = useRef<ActiveDrag | null>(null);
  const suppressClick = useRef<{ id: string; until: number } | null>(null);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => setSpace({ width: element.clientWidth, height: element.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const element = viewport.current;
    const pending = pendingZoom.current;
    if (!element || !pending) return;
    element.scrollLeft = pending.x * zoom - pending.focusX;
    element.scrollTop = pending.y * zoom - pending.focusY;
    pendingZoom.current = null;
  }, [zoom]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      if (event.deltaY === 0) return;
      const next = clamp(Math.round((zoom + (event.deltaY < 0 ? 0.1 : -0.1)) * 100) / 100, 2);
      changeZoom(Math.max(0.5, next), { x: event.clientX, y: event.clientY });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [zoom]);
  const columnsPerRow = Math.max(1, Math.floor((space.width - 20) / 360));
  const pins: Pin[] = notes.map((note, index) => ({
    id: note.id,
    x: draftPoints[note.id]?.x ?? note.noteX ?? defaultPoint(index, columnsPerRow).x,
    y: draftPoints[note.id]?.y ?? note.noteY ?? defaultPoint(index, columnsPerRow).y,
    targetBoardId: note.noteBoardId ?? null,
  }));
  const stageWidth = Math.max(380, Math.ceil(space.width / zoom), ...pins.map(pin => pin.x + NOTE_WIDTH + 30));
  const stageHeight = Math.max(800, Math.ceil(space.height / zoom), ...pins.map(pin => pin.y + NOTE_HEIGHT + 40));
  const zoomOut = ZOOM_STEPS.filter(step => step < zoom - 0.001).pop() ?? zoom;
  const zoomIn = ZOOM_STEPS.find(step => step > zoom + 0.001) ?? zoom;

  function changeZoom(next: number, focus?: Point) {
    const element = viewport.current;
    if (!element || next === zoom) return;
    const bounds = element.getBoundingClientRect();
    const focusX = focus ? focus.x - bounds.left : 0;
    const focusY = focus ? focus.y - bounds.top : 0;
    pendingZoom.current = { x: (element.scrollLeft + focusX) / zoom, y: (element.scrollTop + focusY) / zoom, focusX, focusY };
    setZoom(next);
  }

  // The whole note is the drag surface; controls inside it keep their own behaviour.
  function startDrag(event: PointerEvent<HTMLElement>, pin: Pin, locked: boolean) {
    if (!canEdit || busy || locked || event.button !== 0 || (event.target as HTMLElement).closest("button, a, input, textarea, select")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: pin.id, pointerId: event.pointerId, pointerX: event.clientX, pointerY: event.clientY, x: pin.x, y: pin.y, nextX: pin.x, nextY: pin.y };
    setDraggingId(pin.id);
    setLiftedId(pin.id);
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const x = clamp(current.x + (event.clientX - current.pointerX) / zoom, 5000);
    const y = clamp(current.y + (event.clientY - current.pointerY) / zoom, 5000);
    current.nextX = x;
    current.nextY = y;
    setDraftPoints(previous => ({ ...previous, [current.id]: { x, y } }));
  }

  function finishDrag(event: PointerEvent<HTMLElement>, cancelled = false) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    setDraggingId(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancelled && Math.hypot(current.nextX - current.x, current.nextY - current.y) > 3) {
      suppressClick.current = { id: current.id, until: performance.now() + 350 };
      void onMutate("updateNote", { id: current.id, noteX: Math.round(current.nextX), noteY: Math.round(current.nextY), bringToFront: true }).finally(() => {
        setDraftPoints(previous => { const next = { ...previous }; delete next[current.id]; return next; });
        setLiftedId(null);
      });
    } else { setLiftedId(null); setDraftPoints(previous => { const next = { ...previous }; delete next[current.id]; return next; }); }
  }

  const isCardDrag = (event: DragEvent) => event.dataTransfer.types.includes("application/cove-card") || event.dataTransfer.types.includes("text/plain");

  // Dropping a tray card onto the board turns that card into a note where it landed.
  async function dropCard(event: DragEvent) {
    event.preventDefault(); setDropping(false);
    if (!canEdit) return;
    try {
      const payload = JSON.parse(event.dataTransfer.getData("application/cove-card") || event.dataTransfer.getData("text/plain"));
      const bounds = stage.current?.getBoundingClientRect();
      const noteX = Math.round(clamp((event.clientX - (bounds?.left ?? 0)) / zoom - NOTE_WIDTH / 2, 5000));
      const noteY = Math.round(clamp((event.clientY - (bounds?.top ?? 0)) / zoom - 60, 5000));
      if (payload?.type === "tray") {
        const item = state.tray.find(entry => entry.id === payload.id);
        const cardId = state.placements.find(entry => entry.id === item?.placementId)?.cardId || item?.cardId;
        if (cardId) await onMutate("makeNote", { cardId, trayId: item!.id, noteX, noteY }, "Card is now a note");
      } else if (payload?.type === "placement") {
        const cardId = state.placements.find(entry => entry.id === payload.id)?.cardId;
        if (cardId) await onMutate("makeNote", { cardId, noteX, noteY }, "Card is now a note");
      }
    } catch { /* An unrelated drag has no effect. */ }
  }

  function noteKey(event: KeyboardEvent, note: Card) {
    if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) { event.preventDefault(); setEditing(note); }
  }

  return <div className="sticky-page">
    <div className="sticky-toolbar">
      <div className="sticky-zoom-controls" role="group" aria-label="Sticky notes zoom">
        <button aria-label="Zoom out" title="Zoom out" disabled={zoom <= 0.5} onClick={() => changeZoom(zoomOut)}>−</button>
        <button className="sticky-zoom-value" aria-label={`Reset zoom to 100% (currently ${Math.round(zoom * 100)}%)`} title="Reset zoom to 100%" onClick={() => changeZoom(1)}>{Math.round(zoom * 100)}%</button>
        <button aria-label="Zoom in" title="Zoom in" disabled={zoom >= 2} onClick={() => changeZoom(zoomIn)}>+</button>
      </div>
      <select className="tag-filter sticky-filter" aria-label="Filter notes by board" value={filter} onChange={event => onFilter(event.target.value)}>
        <option value="">All notes ({allNotes.length})</option>
        <option value="none">No board ({allNotes.filter(item => !item.noteBoardId).length})</option>
        {state.boards.filter(item => item.workspaceId === board.workspaceId && item.kind === "kanban" && !item.archived).map(item => <option key={item.id} value={item.id}>{item.name} ({allNotes.filter(note => note.noteBoardId === item.id).length})</option>)}
      </select>
      <div className="sticky-toolbar-actions">{canManage && <button className="button secondary" onClick={onSettings}><Icon name="more" size={16} />Board settings</button>}{canEdit && <button className="button primary" onClick={() => setEditing("new")}><Icon name="plus" size={16} />New note</button>}</div>
    </div>
    <div className="sticky-viewport" ref={viewport}>
      <div className="sticky-zoom-space" style={{ width: stageWidth * zoom, height: stageHeight * zoom }}>
        <div ref={stage} className={`sticky-stage ${dropping ? "sticky-drop" : ""}`} role="region" aria-label={`${board.name} sticky notes area`} style={{ width: stageWidth, height: stageHeight, transform: `scale(${zoom})` }} onDragOver={event => { if (canEdit && isCardDrag(event)) { event.preventDefault(); setDropping(true); } }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropping(false); }} onDrop={event => void dropCard(event)}>
          <PinboardCanvas width={stageWidth} height={stageHeight} pins={pins} draggingId={draggingId} />
          {notes.map((note, index) => {
            const pin = pins[index];
            const destination = state.boards.find(item => item.id === note.noteBoardId);
            const placement = state.placements.find(item => item.cardId === note.id && item.boardId === note.noteBoardId);
            const column = state.columns.find(item => item.id === placement?.columnId);
            const home = destination ? column ? `${destination.name} / ${column.name}` : `${destination.name} / Notes` : "";
            const locked = !!note.noteLocked;
            const label = note.title || note.description.slice(0, 40) || "note";
            return <article key={note.id} tabIndex={0} role="button" aria-label={`${locked ? "Edit" : "Drag to move or click to edit"} ${label}`} className={`sticky-note ${locked ? "is-pinned" : ""} ${draggingId === note.id ? "is-dragging" : ""} ${canEdit ? "is-draggable" : ""}`} style={{ background: note.noteColor || NOTE_COLORS[0].value, left: pin.x, top: pin.y, zIndex: liftedId === note.id ? 100000 : 1 + (note.noteZ ?? 0) }} onPointerDown={event => startDrag(event, pin, locked)} onPointerMove={moveDrag} onPointerUp={event => finishDrag(event)} onPointerCancel={event => finishDrag(event, true)} onKeyDown={event => noteKey(event, note)} onClick={event => { if ((event.target as HTMLElement).closest("button")) return; const suppressed = suppressClick.current?.id === note.id && performance.now() < suppressClick.current.until; suppressClick.current = null; if (!suppressed && canEdit) setEditing(note); }}>
              <button className={`sticky-pin ${locked ? "is-locked" : ""}`} aria-label={locked ? "Unpin note" : "Pin note in place"} aria-pressed={locked} title={locked ? "Unpin to move this note" : "Pin this note in place"} disabled={!canEdit || busy} onClick={() => void onMutate("updateNote", { id: note.id, noteLocked: !locked })}><span className="sticky-pin-head" /></button>
              <div className="sticky-note-text">{note.title && <strong>{note.title}</strong>}{note.description}</div>
              {home && <small className="sticky-note-home">{home}</small>}
            </article>;
          })}
          {canEdit && notes.length === 0 && <button className="sticky-add" style={{ left: 30, top: 30 }} onClick={() => setEditing("new")}><Icon name="plus" size={22} />{allNotes.length ? "No notes match this filter" : "Add a note, or drop a card from the tray"}</button>}
          {notes.length === 0 && !canEdit && <div className="sticky-empty">No notes yet.</div>}
        </div>
      </div>
    </div>
    {editing && <NoteEditor key={editing === "new" ? "new" : editing.id} note={editing} workspaceId={board.workspaceId} stickyBoardId={board.id} state={state} busy={busy} onMutate={onMutate} onClose={() => setEditing(null)} />}
  </div>;
}
