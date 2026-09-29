"use client";

import { useState, type FormEvent } from "react";
import type { ActionResult, AppState, Card } from "./api";
import { Icon } from "./Icon";
import { NOTE_COLORS } from "@/lib/note-colors";

type Props = {
  note: Card | "new"; workspaceId: string; stickyBoardId?: string; state: AppState; busy: boolean;
  onMutate: (name: string, payload: Record<string, unknown>, message?: string) => Promise<ActionResult | false>;
  onClose: () => void;
};

export function NoteEditor({ note, workspaceId, stickyBoardId, state, busy, onMutate, onClose }: Props) {
  const existing = note === "new" ? null : note;
  const placement = existing ? state.placements.find(item => item.cardId === existing.id && item.boardId === existing.noteBoardId) : undefined;
  const [title, setTitle] = useState(existing?.title || "");
  const [body, setBody] = useState(existing?.description || "");
  const [color, setColor] = useState<string>(existing?.noteColor || NOTE_COLORS[0].value);
  const [boardId, setBoardId] = useState(existing?.noteBoardId || "");
  const [columnId, setColumnId] = useState(placement?.columnId || "");
  const destinations = state.boards.filter(item => item.workspaceId === workspaceId && item.kind === "kanban" && !item.archived && (state.currentUser?.role === "admin" || item.ownerUserId === state.currentUser?.id || state.boardMembers.some(member => member.boardId === item.id && member.userId === state.currentUser?.id)));
  const onCards = existing ? state.placements.some(item => item.cardId === existing.id) : false;
  const canSave = !!(title.trim() || body.trim());

  async function save(event: FormEvent) {
    event.preventDefault();
    const payload = { title: title.trim(), noteBody: body, color, noteBoardId: boardId || null, columnId: boardId ? columnId || null : null };
    const result = existing
      ? await onMutate("updateNote", { id: existing.id, ...payload }, "Note saved")
      : await onMutate("createNote", { boardId: stickyBoardId, ...payload }, "Note created");
    if (result) onClose();
  }

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="settings-modal sticky-editor" role="dialog" aria-modal="true" aria-label={existing ? "Edit note" : "New note"}>
      <div className="modal-heading"><div><h2>{existing ? "Edit note" : "New note"}</h2><p>Jot it down. Optionally file it on a board, and in a column.</p></div><button className="icon-button" aria-label="Close" onClick={onClose}><Icon name="close" /></button></div>
      <form onSubmit={event => void save(event)}>
        <label className="field-label">Note<textarea autoFocus rows={7} maxLength={100000} value={body} onChange={event => setBody(event.target.value)} placeholder="Write your idea here…" /></label>
        <label className="field-label">Title <span>(optional)</span><input maxLength={300} value={title} onChange={event => setTitle(event.target.value)} /></label>
        <fieldset className="sticky-colors"><legend>Note color</legend><div className="sticky-color-options">{NOTE_COLORS.map(item => <button key={item.value} type="button" className={`sticky-color-option ${color === item.value ? "is-selected" : ""}`} aria-label={item.name} aria-pressed={color === item.value} title={item.name} onClick={() => setColor(item.value)}><span style={{ background: item.value }} />{item.name}</button>)}</div></fieldset>
        <label className="field-label">Board <span>(optional)</span><select value={boardId} onChange={event => { setBoardId(event.target.value); setColumnId(""); }}><option value="">Notes only — no board</option>{destinations.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        {boardId && <label className="field-label">Column <span>(optional)</span><select value={columnId} onChange={event => setColumnId(event.target.value)}><option value="">No column — show in the board’s Notes column</option>{state.columns.filter(item => item.boardId === boardId).sort((a, b) => a.position - b.position).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
        <div className="modal-actions">
          {existing && onCards && <button type="button" className="button secondary sticky-unnote" disabled={busy} onClick={async () => { if (await onMutate("unNote", { id: existing.id }, "Note turned back into a card")) onClose(); }}>Back to card</button>}
          {existing && <button type="button" className="button sticky-delete" disabled={busy} onClick={async () => { if (!window.confirm(onCards ? "Delete this note and its card everywhere?" : "Delete this note?")) return; if (await onMutate("deleteNote", { id: existing.id }, "Note deleted")) onClose(); }}>Delete</button>}
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          <button className="button primary" disabled={busy || !canSave}>Save note</button>
        </div>
      </form>
    </div>
  </div>;
}
