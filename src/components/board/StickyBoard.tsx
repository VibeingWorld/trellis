"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent, type PointerEvent } from "react";
import type { ActionResult, AppState, Board, Column } from "./api";
import { Icon } from "./Icon";
import { PinboardCanvas, type Pin } from "./PinboardCanvas";

type Props = {
  board: Board; state: AppState; notes: Column[]; busy: boolean; canEdit: boolean; canMove: boolean; canManage: boolean;
  activeTrayItem: string | null; onSettings: () => void;
  onMutate: (name: string, payload: Record<string, unknown>, message?: string) => Promise<ActionResult | false>;
  onPlaceTray: (id: string, columnId: string) => Promise<void>;
  onOpenCard: (cardId: string) => void;
};
type Point = { x: number; y: number };
type ActiveDrag = { id: string; pointerId: number; pointerX: number; pointerY: number; x: number; y: number; nextX: number; nextY: number };

const defaultPoint = (index: number, columns: number): Point => ({ x: 30 + (index % columns) * 298, y: 30 + Math.floor(index / columns) * 280 });
const clamp = (value: number, maximum: number) => Math.max(0, Math.min(maximum, value));

export function StickyBoard({ board, state, notes, busy, canEdit, canMove, canManage, activeTrayItem, onSettings, onMutate, onPlaceTray, onOpenCard }: Props) {
  const page = useRef<HTMLDivElement>(null);
  const [space, setSpace] = useState({ width: 0, height: 0 });
  const [editing, setEditing] = useState<Column | "new" | null>(null);
  const [dropTarget, setDropTarget] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [targetBoardId, setTargetBoardId] = useState("");
  const [targetColumnId, setTargetColumnId] = useState("");
  const [localMinimized, setLocalMinimized] = useState<Record<string, boolean>>({});
  const [draftPoints, setDraftPoints] = useState<Record<string, Point>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const drag = useRef<ActiveDrag | null>(null);
  useEffect(() => {
    const element = page.current;
    if (!element) return;
    const measure = () => {
      const style = window.getComputedStyle(element);
      setSpace({
        width: element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
        height: element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - (canManage || canEdit ? 50 : 0),
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [canEdit, canManage]);
  const destinations = state.boards.filter(item => item.workspaceId === board.workspaceId && item.kind === "kanban" && !item.archived && (state.currentUser?.role === "admin" || item.ownerUserId === state.currentUser?.id || state.boardMembers.some(member => member.boardId === item.id && member.userId === state.currentUser?.id)));
  const columnsPerRow = space.width >= 900 ? Math.max(3, Math.floor((space.width - 30) / 298)) : space.width >= 620 ? 2 : 1;
  const pins: Pin[] = notes.map((note, index) => ({
    id: note.id,
    x: draftPoints[note.id]?.x ?? note.noteX ?? defaultPoint(index, columnsPerRow).x,
    y: draftPoints[note.id]?.y ?? note.noteY ?? defaultPoint(index, columnsPerRow).y,
    targetBoardId: note.targetBoardId,
  }));
  const stageWidth = Math.max(320, space.width, ...pins.map(pin => pin.x + 280));
  const stageHeight = Math.max(800, space.height, ...pins.map(pin => pin.y + 300));

  function edit(note: Column | "new") {
    setEditing(note);
    setNoteTitle(note === "new" ? "" : note.name);
    setNoteBody(note === "new" ? "" : note.noteBody);
    setTargetBoardId(note === "new" ? "" : note.targetBoardId || "");
    setTargetColumnId(note === "new" ? "" : note.targetColumnId || "");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const result = editing === "new"
      ? await onMutate("createNote", { boardId: board.id, name: noteTitle.trim(), noteBody }, "Note created")
      : await onMutate("updateNote", { id: editing.id, name: noteTitle.trim(), noteBody, targetBoardId: targetBoardId || null, targetColumnId: targetColumnId || null }, "Note saved");
    if (result) setEditing(null);
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, pin: Pin) {
    if (!canEdit || busy) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: pin.id, pointerId: event.pointerId, pointerX: event.clientX, pointerY: event.clientY, x: pin.x, y: pin.y, nextX: pin.x, nextY: pin.y };
    setDraggingId(pin.id);
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const x = clamp(current.x + event.clientX - current.pointerX, 5000);
    const y = clamp(current.y + event.clientY - current.pointerY, 5000);
    current.nextX = x;
    current.nextY = y;
    setDraftPoints(previous => ({ ...previous, [current.id]: { x, y } }));
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    setDraggingId(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancelled && Math.hypot(current.nextX - current.x, current.nextY - current.y) > 3) {
      void onMutate("updateNote", { id: current.id, noteX: Math.round(current.nextX), noteY: Math.round(current.nextY) }, "Note position saved").finally(() => {
        setDraftPoints(previous => { const next = { ...previous }; delete next[current.id]; return next; });
      });
    } else setDraftPoints(previous => { const next = { ...previous }; delete next[current.id]; return next; });
  }

  async function drop(event: DragEvent, note: Column) {
    event.preventDefault(); event.stopPropagation(); setDropTarget("");
    try {
      const payload = JSON.parse(event.dataTransfer.getData("application/cove-card") || event.dataTransfer.getData("text/plain"));
      if (payload?.type === "tray") await onPlaceTray(payload.id, note.id);
      else if (payload?.type === "placement" && canMove) await onMutate("movePlacement", { placementId: payload.id, columnId: note.id, version: state.placements.find(item => item.id === payload.id)?.version }, "Card added to note");
    } catch { /* An unrelated drag has no effect. */ }
  }

  return <div className="sticky-page" ref={page}>
    {(canManage || canEdit) && <div className="sticky-toolbar">{canManage && <button className="button secondary" onClick={onSettings}><Icon name="more" size={16} />Board settings</button>}{canEdit && <button className="button primary" onClick={() => edit("new")}><Icon name="plus" size={16} />New note</button>}</div>}
    <div className="sticky-stage" role="region" aria-label={`${board.name} sticky notes area`} style={{ width: stageWidth, height: stageHeight }}>
      <PinboardCanvas width={stageWidth} height={stageHeight} pins={pins} draggingId={draggingId} />
      {notes.map((note, index) => {
        const pin = pins[index];
        const items = state.placements.filter(item => item.columnId === note.id && !state.cards.find(card => card.id === item.cardId)?.archived).sort((a,b) => a.position-b.position);
        const destination = destinations.find(item => item.id === note.targetBoardId);
        const column = state.columns.find(item => item.id === note.targetColumnId && item.boardId === destination?.id);
        const minimized = canEdit ? note.minimized : localMinimized[note.id] ?? note.minimized;
        return <article key={note.id} className={`sticky-note ${dropTarget === note.id ? "sticky-drop" : ""} ${minimized ? "is-minimized" : ""} ${draggingId === note.id ? "is-dragging" : ""}`} style={{ background: note.color, left: pin.x, top: pin.y }} onDragOver={event => { if (event.dataTransfer.types.includes("application/cove-card") || event.dataTransfer.types.includes("text/plain")) { event.preventDefault(); setDropTarget(note.id); } }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(""); }} onDrop={event => void drop(event, note)}>
          <div className="sticky-note-top">{canEdit && <button className="sticky-grip" aria-label={`Move ${note.name}`} title="Drag to move note" onPointerDown={event => startDrag(event, pin)} onPointerMove={moveDrag} onPointerUp={event => finishDrag(event)} onPointerCancel={event => finishDrag(event, true)}><Icon name="drag" size={15} /></button>}<button className="sticky-note-title" onClick={() => canEdit && edit(note)} title={canEdit ? "Edit note" : note.name}><strong>{note.name}</strong><small>{items.length} {items.length === 1 ? "card" : "cards"}</small></button><button className="icon-button" aria-label={minimized ? `Expand ${note.name}` : `Minimize ${note.name}`} onClick={() => { setLocalMinimized(current => ({ ...current, [note.id]: !minimized })); if (canEdit) void onMutate("updateNote", { id: note.id, minimized: !minimized }, minimized ? "Note expanded" : "Note minimized"); }}><Icon name={minimized ? "plus" : "chevron"} size={16} /></button></div>
          {!minimized && <div className="sticky-note-content">{note.noteBody && <button className="sticky-note-body" onClick={() => canEdit && edit(note)}>{note.noteBody}</button>}<div className="sticky-target"><button onClick={() => canEdit && edit(note)}>{destination && column ? `${destination.name} / ${column.name}` : canEdit ? "Choose board and column" : "No destination"}</button></div><div className="sticky-card-list">{items.map(item => { const card = state.cards.find(entry => entry.id === item.cardId); return card && <div className="sticky-card" key={item.id}><button onClick={() => onOpenCard(card.id)}><span>#{card.cardNumber}</span>{card.title}</button>{canMove && <button className="sticky-card-remove" title={`Remove ${card.title} from note`} aria-label={`Remove ${card.title} from note`} onClick={() => { const last = state.placements.filter(p => p.cardId === card.id).length === 1; if (last && !window.confirm(`Remove “${card.title}” and archive it? This is its last board.`)) return; void onMutate("removePlacement", { id: item.id, archiveIfLast: last }, "Card removed from note"); }}><Icon name="close" size={13} /></button>}</div>; })}</div>{activeTrayItem && canMove && <button className="sticky-place" disabled={busy} onClick={() => void onPlaceTray(activeTrayItem, note.id)}>Place tray card here</button>}{items.length > 0 && destination && column && canMove && <button className="sticky-send" disabled={busy} onClick={() => void onMutate("sendNoteCards", { id: note.id }, "Cards linked to destination")}>Send cards to {destination.name} / {column.name}</button>}</div>}
        </article>;
      })}
      {canEdit && notes.length === 0 && <button className="sticky-add" style={{ left: 30, top: 30 }} onClick={() => edit("new")}><Icon name="plus" size={22} />Add a sticky note</button>}
    </div>
    {notes.length === 0 && !canEdit && <div className="sticky-empty">No notes yet.</div>}
    {editing && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setEditing(null); }}><div className="settings-modal sticky-editor" role="dialog" aria-modal="true" aria-label={editing === "new" ? "New sticky note" : "Edit sticky note"}><div className="modal-heading"><div><h2>{editing === "new" ? "New sticky note" : "Edit sticky note"}</h2><p>Write an idea and choose where its cards belong.</p></div><button className="icon-button" aria-label="Close" onClick={() => setEditing(null)}><Icon name="close" /></button></div><form onSubmit={event => void save(event)}><label className="field-label">Title<input autoFocus required maxLength={100} value={noteTitle} onChange={event => setNoteTitle(event.target.value)} /></label><label className="field-label">Note<textarea rows={6} maxLength={100000} value={noteBody} onChange={event => setNoteBody(event.target.value)} placeholder="Write your idea here…" /></label>{editing !== "new" && <><label className="field-label">Board<select value={targetBoardId} onChange={event => { const next = event.target.value; setTargetBoardId(next); setTargetColumnId(state.columns.find(column => column.boardId === next)?.id || ""); }}><option value="">No destination yet</option>{destinations.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>{targetBoardId && <label className="field-label">Column<select value={targetColumnId} onChange={event => setTargetColumnId(event.target.value)}>{state.columns.filter(item => item.boardId === targetBoardId).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}</>}<div className="modal-actions">{editing !== "new" && <button type="button" className="button sticky-delete" disabled={busy} onClick={async () => { if (!window.confirm(`Delete “${editing.name}”? Move its cards out first.`)) return; if (await onMutate("deleteNote", { id: editing.id }, "Note deleted")) setEditing(null); }}>Delete note</button>}<button type="button" className="button secondary" onClick={() => setEditing(null)}>Cancel</button><button className="button primary" disabled={busy || !noteTitle.trim()}>Save note</button></div></form></div></div>}
  </div>;
}
