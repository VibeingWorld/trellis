"use client";

import { useState, type DragEvent, type FormEvent } from "react";
import type { ActionResult, AppState, Board, Column } from "./api";
import { Icon } from "./Icon";

type Props = {
  board: Board; state: AppState; notes: Column[]; busy: boolean; canEdit: boolean; canMove: boolean; canManage: boolean;
  activeTrayItem: string | null; onSettings: () => void;
  onMutate: (name: string, payload: Record<string, unknown>, message?: string) => Promise<ActionResult | false>;
  onPlaceTray: (id: string, columnId: string) => Promise<void>;
  onOpenCard: (cardId: string) => void;
};

export function StickyBoard({ board, state, notes, busy, canEdit, canMove, canManage, activeTrayItem, onSettings, onMutate, onPlaceTray, onOpenCard }: Props) {
  const [editing, setEditing] = useState<Column | "new" | null>(null);
  const [dropTarget, setDropTarget] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [targetBoardId, setTargetBoardId] = useState("");
  const [targetColumnId, setTargetColumnId] = useState("");
  const [localMinimized, setLocalMinimized] = useState<Record<string, boolean>>({});
  const destinations = state.boards.filter(item => item.workspaceId === board.workspaceId && item.kind === "kanban" && !item.archived && (state.currentUser?.role === "admin" || item.ownerUserId === state.currentUser?.id || state.boardMembers.some(member => member.boardId === item.id && member.userId === state.currentUser?.id)));

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

  async function drop(event: DragEvent, note: Column) {
    event.preventDefault(); event.stopPropagation(); setDropTarget("");
    try {
      const payload = JSON.parse(event.dataTransfer.getData("application/cove-card") || event.dataTransfer.getData("text/plain"));
      if (payload?.type === "tray") await onPlaceTray(payload.id, note.id);
      else if (payload?.type === "placement" && canMove) await onMutate("movePlacement", { placementId: payload.id, columnId: note.id, version: state.placements.find(item => item.id === payload.id)?.version }, "Card added to note");
    } catch { /* An unrelated drag has no effect. */ }
  }

  return <div className="sticky-page">
    <div className="sticky-heading"><div><div className="sticky-kicker">SHARED WORKSPACE BOARD</div><h1>{board.name}</h1><p>{board.description || "Collect ideas together. Give each note a destination when it is ready."}</p></div><div className="sticky-heading-actions">{canManage && <button className="button secondary" onClick={onSettings}><Icon name="more" size={16} />Board settings</button>}{canEdit && <button className="button primary" onClick={() => edit("new")}><Icon name="plus" size={16} />New note</button>}</div></div>
    <div className="sticky-help">Drag a card from the tray onto a note. A note can point to a board and column; “Send cards” links its cards there.</div>
    <div className="sticky-grid">{notes.map(note => {
      const items = state.placements.filter(item => item.columnId === note.id && !state.cards.find(card => card.id === item.cardId)?.archived).sort((a,b) => a.position-b.position);
      const destination = destinations.find(item => item.id === note.targetBoardId);
      const column = state.columns.find(item => item.id === note.targetColumnId && item.boardId === destination?.id);
      const minimized = canEdit ? note.minimized : localMinimized[note.id] ?? note.minimized;
      return <article key={note.id} className={`sticky-note ${dropTarget === note.id ? "sticky-drop" : ""} ${minimized ? "is-minimized" : ""}`} style={{ background: note.color }} onDragOver={event => { if (event.dataTransfer.types.includes("application/cove-card") || event.dataTransfer.types.includes("text/plain")) { event.preventDefault(); setDropTarget(note.id); } }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(""); }} onDrop={event => void drop(event, note)}>
        <div className="sticky-note-top"><button className="sticky-note-title" onClick={() => canEdit && edit(note)} title={canEdit ? "Edit note" : note.name}><strong>{note.name}</strong><small>{items.length} {items.length === 1 ? "card" : "cards"}</small></button><button className="icon-button" aria-label={minimized ? `Expand ${note.name}` : `Minimize ${note.name}`} onClick={() => { setLocalMinimized(current => ({ ...current, [note.id]: !minimized })); if (canEdit) void onMutate("updateNote", { id: note.id, minimized: !minimized }, minimized ? "Note expanded" : "Note minimized"); }}><Icon name={minimized ? "plus" : "chevron"} size={16} /></button></div>
        {!minimized && <div className="sticky-note-content">{note.noteBody && <button className="sticky-note-body" onClick={() => canEdit && edit(note)}>{note.noteBody}</button>}<div className="sticky-target"><button onClick={() => canEdit && edit(note)}>{destination && column ? `${destination.name} / ${column.name}` : canEdit ? "Choose board and column" : "No destination"}</button></div><div className="sticky-card-list">{items.map(item => { const card = state.cards.find(entry => entry.id === item.cardId); return card && <div className="sticky-card" key={item.id}><button onClick={() => onOpenCard(card.id)}><span>#{card.cardNumber}</span>{card.title}</button>{canMove && <button className="sticky-card-remove" title={`Remove ${card.title} from note`} aria-label={`Remove ${card.title} from note`} onClick={() => { const last = state.placements.filter(p => p.cardId === card.id).length === 1; if (last && !window.confirm(`Remove “${card.title}” and archive it? This is its last board.`)) return; void onMutate("removePlacement", { id: item.id, archiveIfLast: last }, "Card removed from note"); }}><Icon name="close" size={13} /></button>}</div>; })}</div>{activeTrayItem && canMove && <button className="sticky-place" disabled={busy} onClick={() => void onPlaceTray(activeTrayItem, note.id)}>Place tray card here</button>}{items.length > 0 && destination && column && canMove && <button className="sticky-send" disabled={busy} onClick={() => void onMutate("sendNoteCards", { id: note.id }, "Cards linked to destination")}>Send cards to {destination.name} / {column.name}</button>}</div>}
      </article>;
    })}{canEdit && <button className="sticky-add" onClick={() => edit("new")}><Icon name="plus" size={22} />Add a sticky note</button>}</div>
    {notes.length === 0 && !canEdit && <div className="sticky-empty">No notes yet.</div>}
    {editing && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setEditing(null); }}><div className="settings-modal sticky-editor" role="dialog" aria-modal="true" aria-label={editing === "new" ? "New sticky note" : "Edit sticky note"}><div className="modal-heading"><div><h2>{editing === "new" ? "New sticky note" : "Edit sticky note"}</h2><p>Write an idea and choose where its cards belong.</p></div><button className="icon-button" aria-label="Close" onClick={() => setEditing(null)}><Icon name="close" /></button></div><form onSubmit={event => void save(event)}><label className="field-label">Title<input autoFocus required maxLength={100} value={noteTitle} onChange={event => setNoteTitle(event.target.value)} /></label><label className="field-label">Note<textarea rows={6} maxLength={100000} value={noteBody} onChange={event => setNoteBody(event.target.value)} placeholder="Write your idea here…" /></label>{editing !== "new" && <><label className="field-label">Board<select value={targetBoardId} onChange={event => { const next = event.target.value; setTargetBoardId(next); setTargetColumnId(state.columns.find(column => column.boardId === next)?.id || ""); }}><option value="">No destination yet</option>{destinations.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>{targetBoardId && <label className="field-label">Column<select value={targetColumnId} onChange={event => setTargetColumnId(event.target.value)}>{state.columns.filter(item => item.boardId === targetBoardId).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}</>}<div className="modal-actions">{editing !== "new" && <button type="button" className="button sticky-delete" disabled={busy} onClick={async () => { if (!window.confirm(`Delete “${editing.name}”? Move its cards out first.`)) return; if (await onMutate("deleteNote", { id: editing.id }, "Note deleted")) setEditing(null); }}>Delete note</button>}<button type="button" className="button secondary" onClick={() => setEditing(null)}>Cancel</button><button className="button primary" disabled={busy || !noteTitle.trim()}>Save note</button></div></form></div></div>}
  </div>;
}
