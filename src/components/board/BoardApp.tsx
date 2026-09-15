"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type FormEvent, type ReactNode } from "react";
import CardDetail from "@/components/card/CardDetail";
import { appPath } from "@/lib/app-path";
import { action, readState, type AppState, type Board, type Column, type Placement, type TrayItem } from "./api";
import { CalendarPanel } from "./CalendarPanel";
import { Icon } from "./Icon";

const backgrounds = [
  { id: "sage", name: "Sage", value: "#e8eee8", ink: "#304937" },
  { id: "sand", name: "Sand", value: "#f0eae0", ink: "#66523c" },
  { id: "sky", name: "Sky", value: "#e7edf4", ink: "#3b526d" },
  { id: "rose", name: "Rose", value: "#f1e6e7", ink: "#714952" },
  { id: "lavender", name: "Lavender", value: "#ece8f3", ink: "#5d4c75" },
  { id: "midnight", name: "Midnight", value: "#253b42", ink: "#dce9e5" },
  { id: "coast", name: "Coast", value: "linear-gradient(135deg, #dbe9e5 0%, #e5edf2 50%, #f0e8d9 100%)", ink: "#385b57" },
  { id: "sunset", name: "Sunset", value: "linear-gradient(135deg, #ebd3c7, #e8d8e6 60%, #d8e1ed)", ink: "#694d5a" },
];

function boardStyle(background: string | undefined): CSSProperties {
  const preset = backgrounds.find((item) => item.id === background);
  const value = preset?.value || background || backgrounds[0].value;
  if (/^(https?:\/\/|\/api\/uploads\/)/.test(value)) {
    const imageUrl = value.startsWith("/api/uploads/") ? appPath(value) : value;
    return { backgroundImage: `linear-gradient(#eef3ee30,#eef3ee30),url("${imageUrl.replaceAll('"', '%22')}")`, backgroundSize: "cover", backgroundPosition: "center" };
  }
  return { background: value };
}

type Dialog = { kind: "workspace" } | { kind: "board" } | { kind: "column" } | { kind: "columnSettings"; column: Column } | { kind: "background" } | { kind: "boardSettings" };
type Toast = { message: string; error?: boolean; undoId?: string };
type DragPayload = { type: "placement"; id: string } | { type: "tray"; id: string };

export default function BoardApp() {
  const [state, setState] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [activeBoardId, setActiveBoardId] = useState("");
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [workspaceMenu, setWorkspaceMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [trayOpen, setTrayOpen] = useState(true);
  const [sideTab, setSideTab] = useState<"tray" | "calendar">("tray");
  const [sideExpanded, setSideExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [selectedPlacement, setSelectedPlacement] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragTarget, setDragTarget] = useState("");
  const [activeTrayItem, setActiveTrayItem] = useState<string | null>(null);
  const mutationLock = useRef(false);
  const deepLinkHandled = useRef(false);

  const refresh = useCallback(async () => {
    const next = await readState();
    setState(next);
    setLoadError("");
  }, []);

  useEffect(() => {
    const initialBoard = new URLSearchParams(window.location.search).get("board") || localStorage.getItem("cove.board") || "";
    setActiveBoardId(initialBoard);
    setActiveWorkspaceId(localStorage.getItem("cove.workspace") || "");
    if (window.innerWidth <= 800) setTrayOpen(false);
    refresh().catch((error: Error) => setLoadError(error.message));
    const onFocus = () => { refresh().catch(() => {}); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  useEffect(() => {
    if (!state) return;
    const selectedBoard = state.boards.find((item) => item.id === activeBoardId);
    if (selectedBoard) {
      setActiveWorkspaceId(selectedBoard.workspaceId);
    } else {
      const nextBoard = state.boards.find((item) => item.workspaceId === activeWorkspaceId) || (!activeWorkspaceId ? state.boards[0] : undefined);
      setActiveBoardId(nextBoard?.id || "");
      if (!activeWorkspaceId) setActiveWorkspaceId(nextBoard?.workspaceId || state.workspaces[0]?.id || "");
    }
  }, [state, activeBoardId, activeWorkspaceId]);

  useEffect(() => {
    if (!state || deepLinkHandled.current) return;
    deepLinkHandled.current = true;
    const cardId = new URLSearchParams(window.location.search).get("card");
    if (!cardId) return;
    const linkedPlacement = state.placements.find((item) => item.cardId === cardId && item.boardId === activeBoardId) || state.placements.find((item) => item.cardId === cardId);
    if (!linkedPlacement) return;
    const linkedBoard = state.boards.find((item) => item.id === linkedPlacement.boardId);
    if (linkedBoard) {
      setActiveBoardId(linkedBoard.id);
      setActiveWorkspaceId(linkedBoard.workspaceId);
    }
    setSelectedPlacement(linkedPlacement.id);
  }, [state, activeBoardId]);

  useEffect(() => {
    if (!toast || toast.undoId) return;
    const timeout = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(timeout);
  }, [toast]);

  const mutate = useCallback(async (name: string, payload: Record<string, unknown>, message?: string) => {
    if (mutationLock.current) return false;
    mutationLock.current = true;
    setBusy(true);
    try {
      const result = await action(name, payload);
      if (result.state) setState(result.state as AppState);
      else await refresh();
      const undoId = result.operationId || result.undoId;
      const warning = result.calendarWarning || result.warning;
      if (message || warning) setToast({ message: warning ? `${message || "Saved"} · ${warning}` : message!, undoId });
      return result;
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "This change could not be saved.", error: true });
      return false;
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }, [refresh]);

  const board = state?.boards.find((item) => item.id === activeBoardId);
  const workspace = state?.workspaces.find((item) => item.id === activeWorkspaceId);
  const workspaceBoards = state?.boards.filter((item) => item.workspaceId === activeWorkspaceId) || [];
  const columns = useMemo(() => state?.columns.filter((item) => item.boardId === activeBoardId).sort((a, b) => a.position - b.position) || [], [state, activeBoardId]);
  const tags = state?.tags.filter((item) => item.workspaceId === activeWorkspaceId) || [];
  const trayItems = state?.tray.filter((item) => {
    const placement = state.placements.find((p) => p.id === item.placementId);
    const card = state.cards.find((c) => c.id === (placement?.cardId || item.cardId));
    return item.workspaceId === activeWorkspaceId || card?.workspaceId === activeWorkspaceId;
  }) || [];
  const placement = state?.placements.find((item) => item.id === selectedPlacement);
  const totalCards = state?.placements.filter((item) => item.boardId === activeBoardId && !state.cards.find((card) => card.id === item.cardId)?.archived).length || 0;
  const linkedCards = state?.placements.filter((item) => item.boardId === activeBoardId && !state.cards.find((card) => card.id === item.cardId)?.archived && state.placements.some((other) => other.cardId === item.cardId && other.boardId !== item.boardId)).length || 0;

  function navigateBoard(item: Board) {
    setActiveBoardId(item.id);
    setActiveWorkspaceId(item.workspaceId);
    setTagFilter("");
    setSearch("");
    setSidebarOpen(false);
    setActiveTrayItem(null);
    localStorage.setItem("cove.board", item.id);
    localStorage.setItem("cove.workspace", item.workspaceId);
    window.history.replaceState({}, "", `?board=${encodeURIComponent(item.id)}`);
  }

  function openCard(cardId: string, preferredBoardId = activeBoardId) {
    const nextPlacement = state?.placements.find((item) => item.cardId === cardId && item.boardId === preferredBoardId) || state?.placements.find((item) => item.cardId === cardId);
    if (!nextPlacement) return;
    const nextBoard = state?.boards.find((item) => item.id === nextPlacement.boardId);
    if (nextBoard && nextBoard.id !== activeBoardId) {
      setActiveBoardId(nextBoard.id);
      setActiveWorkspaceId(nextBoard.workspaceId);
      localStorage.setItem("cove.board", nextBoard.id);
      localStorage.setItem("cove.workspace", nextBoard.workspaceId);
    }
    setSelectedPlacement(nextPlacement.id);
    window.history.replaceState({}, "", `?board=${encodeURIComponent(nextPlacement.boardId)}&card=${encodeURIComponent(cardId)}`);
  }

  function closeCard() {
    setSelectedPlacement(null);
    window.history.replaceState({}, "", activeBoardId ? `?board=${encodeURIComponent(activeBoardId)}` : window.location.pathname);
  }

  function dragData(event: DragEvent): DragPayload | null {
    try { return JSON.parse(event.dataTransfer.getData("application/cove-card") || event.dataTransfer.getData("text/plain")) as DragPayload; } catch { return null; }
  }

  async function dropOnColumn(event: DragEvent, column: Column) {
    event.preventDefault();
    setDragTarget("");
    const payload = dragData(event);
    if (!payload) return;
    if (payload.type === "tray") await placeTrayItem(payload.id, column.id);
    else await mutate("movePlacement", { placementId: payload.id, columnId: column.id, version: state?.placements.find((item) => item.id === payload.id)?.version }, `Moved to ${column.name}`);
  }

  async function dropOnCard(event: DragEvent, target: Placement) {
    event.preventDefault(); event.stopPropagation(); setDragTarget("");
    const payload = dragData(event); if (!payload || !state) return;
    if (payload.type === "placement" && payload.id === target.id) return;
    const sorted = state.placements.filter((item) => item.columnId === target.columnId && !(payload.type === "placement" && item.id === payload.id)).sort((a, b) => a.position - b.position);
    const bounds = event.currentTarget.getBoundingClientRect();
    const index = sorted.findIndex((item) => item.id === target.id) + (event.clientY > bounds.top + bounds.height / 2 ? 1 : 0);
    const before = sorted[index - 1]?.position; const after = sorted[index]?.position;
    const position = before === undefined ? (after ?? 0) - 1 : after === undefined ? before + 1 : (before + after) / 2;
    if (payload.type === "tray") await placeTrayItem(payload.id, target.columnId, position);
    else await mutate("movePlacement", { placementId: payload.id, columnId: target.columnId, position, version: state.placements.find((item) => item.id === payload.id)?.version }, "Card moved");
  }

  async function placeTrayItem(id: string, columnId: string, position?: number) {
    const item = state?.tray.find((entry) => entry.id === id);
    const result = await mutate("dropTray", { id, trayId: id, columnId, position }, item?.mode === "link" ? "Card linked to this board" : "Card moved to this board");
    if (result) setActiveTrayItem(null);
  }

  if (!state) return <div className="startup"><CoveLogo /><div className="startup-copy">{loadError || "Making room for your ideas…"}</div>{loadError ? <button className="button primary" onClick={() => refresh().catch((error: Error) => setLoadError(error.message))}>Try again</button> : <div className="loading-line" />}</div>;

  return <div className="app-shell">
    {sidebarOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? "is-open" : ""}`}>
      <div className="brand-row"><CoveLogo /><span className="brand-beta">PERSONAL</span></div>
      <div className="workspace-control">
        <button className="workspace-switch" onClick={() => setWorkspaceMenu(!workspaceMenu)} aria-expanded={workspaceMenu}>
          <span className="workspace-avatar">{workspace?.name?.slice(0, 1) || "W"}</span><span><strong>{workspace?.name || "Your workspace"}</strong><small>Workspace</small></span><Icon name="chevron" size={15} />
        </button>
        {workspaceMenu && <div className="workspace-menu popover">{state.workspaces.map((item) => <button key={item.id} onClick={() => { const firstBoard = state.boards.find((b) => b.workspaceId === item.id); if (firstBoard) navigateBoard(firstBoard); else { setActiveWorkspaceId(item.id); setActiveBoardId(""); localStorage.removeItem("cove.board"); localStorage.setItem("cove.workspace", item.id); window.history.replaceState({}, "", window.location.pathname); } setWorkspaceMenu(false); setTagFilter(""); }}><span className="workspace-avatar small">{item.name.slice(0, 1)}</span>{item.name}{item.id === activeWorkspaceId && <Icon name="check" size={15} />}</button>)}<button onClick={() => { setDialog({ kind: "workspace" }); setWorkspaceMenu(false); }}><Icon name="plus" size={16} />Create workspace</button></div>}
      </div>
      <div className="sidebar-section-title"><span>WORKSPACE</span></div>
      <button className="navigation-item is-active" onClick={() => { if (workspaceBoards[0]) navigateBoard(workspaceBoards[0]); }}><Icon name="board" />Boards<span className="nav-counter">{workspaceBoards.length}</span></button>
      <button className={`navigation-item ${trayOpen && sideTab === "tray" ? "is-active" : ""}`} onClick={() => { setSideTab("tray"); setTrayOpen(true); }}><Icon name="tray" />Card tray{trayItems.length > 0 && <span className="nav-counter">{trayItems.length}</span>}</button>
      <button className={`navigation-item ${trayOpen && sideTab === "calendar" ? "is-active" : ""}`} onClick={() => { setSideTab("calendar"); setTrayOpen(true); }}><Icon name="calendar" />Calendar<span className="nav-counter">{state.cards.filter((card) => card.workspaceId === activeWorkspaceId && card.dueDate && !card.archived).length}</span></button>
      <div className="sidebar-section-title boards-label"><span>YOUR BOARDS</span><button className="icon-button" title="Create board" onClick={() => setDialog({ kind: "board" })}><Icon name="plus" size={16} /></button></div>
      <nav className="board-navigation" aria-label="Boards">{workspaceBoards.map((item) => <button key={item.id} className={`board-nav-item ${item.id === activeBoardId ? "is-current" : ""}`} onClick={() => navigateBoard(item)}><span className="board-swatch" style={boardStyle(item.background)} /><span>{item.name}</span>{item.id === activeBoardId && <span className="current-dot" />}</button>)}</nav>
      <button className="new-board-button" onClick={() => setDialog({ kind: "board" })}><Icon name="plus" size={16} />Create a board</button>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="note-icon"><Icon name="link" size={20} /></span><strong>Ideas belong together.</strong><p>Carry cards between boards.<br />Keep the whole picture in view.</p><button onClick={() => setTrayOpen(true)}>Meet your card tray <Icon name="arrow" size={14} /></button></div><div className="profile-row"><div className="profile-avatar">Y</div><div><strong>Your space</strong><small>Saved on this device</small></div><span className="local-status" title="Local workspace" /></div></div>
    </aside>

    <main className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Icon name="menu" /></button><Icon name="folder" size={16} /><span>{workspace?.name || "Workspace"}</span><span className="breadcrumb-divider">/</span><strong>{board?.name || "Boards"}</strong></div><div className="topbar-right"><span className="local-pill"><span />{busy ? "Saving your changes…" : "All changes saved locally"}</span><button className={`icon-button tray-toggle ${trayOpen ? "active" : ""}`} title={trayOpen ? "Hide side panel" : "Show side panel"} onClick={() => setTrayOpen(!trayOpen)}><Icon name={sideTab === "calendar" ? "calendar" : "tray"} size={19} />{sideTab === "tray" && trayItems.length > 0 && <b>{trayItems.length}</b>}</button></div></header>
      <div className="board-and-tray">
        <section className={`board-surface ${board?.background === "midnight" || board?.background === "#253b42" ? "dark-board" : ""}`} style={boardStyle(board?.background)}>
          {board ? <>
            <div className="board-header"><div><div className="board-eyebrow"><span className="board-tiny-dot" />A LITTLE ROOM FOR BIG IDEAS</div><div className="board-title-row"><h1>{board.name}</h1><button className="icon-button board-menu" aria-label="Board settings" onClick={() => setDialog({ kind: "boardSettings" })}><Icon name="more" /></button></div><p>{board.description || "Make a little progress. Move the good things forward."}</p></div><button className="button background-button" onClick={() => setDialog({ kind: "background" })}><Icon name="image" size={16} /><span>Background</span></button></div>
            <div className="board-toolbar"><div className="board-view-label"><Icon name="board" size={17} /><span>Board</span><span className="view-count">{totalCards}</span></div><div className="toolbar-actions"><div className="board-search"><Icon name="search" size={15} /><input aria-label="Search cards" placeholder="Search cards…" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button className="icon-button" aria-label="Clear search" onClick={() => setSearch("")}><Icon name="close" size={13} /></button>}</div><select className="tag-filter" aria-label="Filter by tag" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}><option value="">All tags</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select><button className="button add-column-top" onClick={() => setDialog({ kind: "column" })}><Icon name="plus" size={15} />Add column</button></div></div>
            <div className="columns-scroller"><div className="columns-row">{columns.map((column, index) => {
              const allPlacements = state.placements.filter((item) => item.columnId === column.id && !state.cards.find((card) => card.id === item.cardId)?.archived).sort((a, b) => a.position - b.position);
              const visiblePlacements = allPlacements.filter((item) => {
                const card = state.cards.find((entry) => entry.id === item.cardId);
                return card && card.title.toLowerCase().includes(search.toLowerCase()) && (!tagFilter || state.cardTags.some((entry) => entry.cardId === card.id && entry.tagId === tagFilter));
              });
              const atCapacity = column.limitMode !== "off" && !!column.wipLimit && allPlacements.length >= column.wipLimit;
              return <section key={column.id} className={`kanban-column ${dragTarget === column.id ? "drag-over" : ""} ${activeTrayItem ? "is-destination" : ""}`} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDragTarget(column.id); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragTarget(""); }} onDrop={(event) => dropOnColumn(event, column)}>
                <div className="column-header"><span className={`column-status status-${index % 5}`} /><h2>{column.name}</h2><span className={`column-count ${atCapacity ? "at-capacity" : ""}`} title={column.limitMode === "off" ? `${allPlacements.length} cards` : `${column.limitMode} limit`}>{allPlacements.length}{column.limitMode !== "off" && column.wipLimit ? ` / ${column.wipLimit}` : ""}</span><button className="icon-button" aria-label={`Settings for ${column.name}`} onClick={() => setDialog({ kind: "columnSettings", column })}><Icon name="more" size={17} /></button></div>
                {column.limitMode !== "off" && column.wipLimit && <div className={`column-limit ${atCapacity ? "at-capacity" : ""}`}><div><span style={{ width: `${Math.min(100, allPlacements.length / column.wipLimit * 100)}%` }} /></div><small>{atCapacity ? "At capacity" : `${column.wipLimit - allPlacements.length} spaces left`}<span>{column.limitMode === "strict" ? "Strict limit" : "Soft limit"}</span></small></div>}
                {activeTrayItem && <button className="place-here-button" disabled={busy} onClick={() => placeTrayItem(activeTrayItem, column.id)}><Icon name="tray" size={16} />Place card here</button>}
                <div className="column-cards">{visiblePlacements.map((item) => <BoardCard key={item.id} state={state} placement={item} inTray={state.tray.some((entry) => entry.placementId === item.id)} onOpen={() => openCard(item.cardId)} onDrop={(event) => dropOnCard(event, item)} onCollect={() => { setSideTab("tray"); setTrayOpen(true); mutate("addToTray", { placementId: item.id, mode: "move" }, "Card added to your tray"); }} />)}{visiblePlacements.length === 0 && (search || tagFilter) && <div className="no-match">No matching cards</div>}</div>
                <AddCard disabled={busy} onAdd={async (title) => !!(await mutate("createCard", { columnId: column.id, boardId: board.id, workspaceId: activeWorkspaceId, title }, "Card created"))} />
              </section>;
            })}<button className="add-column-end" onClick={() => setDialog({ kind: "column" })}><Icon name="plus" size={17} />Add a column</button></div></div>
            <footer className="board-footer"><span><span className="footer-dot" />{totalCards} cards across {columns.length} columns</span>{linkedCards > 0 && <span><Icon name="link" size={13} />{linkedCards} connected {linkedCards === 1 ? "card" : "cards"}</span>}<span className="board-footer-tip">A little progress, every day.</span></footer>
          </> : <div className="empty-board"><div className="empty-board-icon"><Icon name="board" size={32} /></div><h1>A fresh space for your ideas.</h1><p>Create your first board and make something happen.</p><button className="button primary" onClick={() => setDialog({ kind: state.workspaces.length ? "board" : "workspace" })}><Icon name="plus" size={16} />{state.workspaces.length ? "Create a board" : "Create a workspace"}</button></div>}
        </section>
        {trayOpen && <aside className={`card-tray side-panel ${sideExpanded ? "expanded" : ""} ${sideTab === "calendar" ? "calendar-active" : ""} ${dragTarget === "tray" ? "drag-over" : ""}`} onDragOver={(event) => { if (sideTab !== "tray") return; event.preventDefault(); setDragTarget("tray"); }} onDragLeave={(event) => { if (sideTab === "tray" && !event.currentTarget.contains(event.relatedTarget as Node)) setDragTarget(""); }} onDrop={async (event) => { if (sideTab !== "tray") return; event.preventDefault(); setDragTarget(""); const payload = dragData(event); if (payload?.type === "placement") await mutate("addToTray", { placementId: payload.id, mode: "move" }, "Card added to your tray"); }}>
          <div className="side-panel-top"><div className="side-panel-tabs" role="tablist" aria-label="Side panel"><button type="button" role="tab" aria-selected={sideTab === "tray"} className={sideTab === "tray" ? "active" : ""} onClick={() => setSideTab("tray")}><Icon name="tray" size={15} />Tray{trayItems.length > 0 && <span>{trayItems.length}</span>}</button><button type="button" role="tab" aria-selected={sideTab === "calendar"} className={sideTab === "calendar" ? "active" : ""} onClick={() => setSideTab("calendar")}><Icon name="calendar" size={15} />Calendar</button></div><button className={`icon-button ${sideExpanded ? "active" : ""}`} aria-label={sideExpanded ? "Restore side panel width" : "Expand side panel to half screen"} title={sideExpanded ? "Restore width" : "Expand to half screen"} onClick={() => setSideExpanded(!sideExpanded)}><Icon name="expand" size={15} /></button><button className="icon-button" aria-label="Close side panel" onClick={() => setTrayOpen(false)}><Icon name="close" size={17} /></button></div>
          {sideTab === "tray" ? <>
          <div className="tray-heading"><span className="tray-heading-icon"><Icon name="tray" size={20} /></span><h2>Card tray</h2><span className="tray-count">{trayItems.length}</span></div>
          <p className="tray-description">A pocket for cards on the move.<br />Collect here. Drop on any board.</p>
          <div className="tray-workspace-label"><span className="small-dot" />{workspace?.name || "Your workspace"}<span>PRIVATE TO YOU</span></div>
          <div className="tray-items">{trayItems.map((item) => <TrayCard key={item.id} item={item} state={state} board={board} selected={activeTrayItem === item.id} disabled={busy} onMode={(mode) => mutate("updateTray", { id: item.id, trayId: item.id, mode })} onRemove={() => mutate("removeFromTray", { id: item.id, trayId: item.id })} onSelect={() => { setActiveTrayItem(activeTrayItem === item.id ? null : item.id); if (window.innerWidth <= 800 && activeTrayItem !== item.id) setTrayOpen(false); }} />)}<div className={`tray-drop-zone ${trayItems.length === 0 ? "empty" : ""}`}><div className="tray-illustration"><span /><span /><span><Icon name="plus" size={21} /></span></div><strong>{trayItems.length ? "Room for one more idea" : "Good ideas travel."}</strong><p>Drag a card here, or use the<br />tray icon on any card.</p></div></div>
          <div className="tray-explainer"><div><span className="explain-icon move"><Icon name="arrow" size={15} /></span><p><strong>Move a card</strong><small>Take it from one board to another.</small></p></div><div><span className="explain-icon link"><Icon name="link" size={15} /></span><p><strong>Link a card</strong><small>One card, connected across boards.<br />Edits stay in sync everywhere.</small></p></div></div><div className="tray-bottom"><Icon name="check" size={13} />Your tray stays with you across boards</div>
          </> : <CalendarPanel state={state} workspaceId={activeWorkspaceId} trayItems={trayItems} busy={busy} onSchedule={async (cardId, schedule) => { const card = state.cards.find((item) => item.id === cardId); await mutate("updateCard", { id: cardId, ...schedule, version: card?.version }, schedule.dueDate ? `Scheduled for ${schedule.scheduledStart ? new Date(schedule.scheduledStart).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : new Date(`${schedule.dueDate}T12:00:00`).toLocaleDateString()}` : "Removed from calendar"); }} onOpenCard={openCard} onNotice={(message) => setToast({ message })} />}
        </aside>}
      </div>
    </main>
    {toast && <div className={`toast ${toast.error ? "error" : ""}`} role={toast.error ? "alert" : "status"}><Icon name={toast.error ? "help" : "check"} size={17} /><span>{toast.message}</span>{toast.undoId && <button disabled={busy} onClick={async () => { if (await mutate("undo", { id: toast.undoId, operationId: toast.undoId }, "Change undone")) setToast({ message: "Change undone" }); }}>Undo</button>}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast(null)}><Icon name="close" size={15} /></button></div>}
    {dialog && <BoardDialog dialog={dialog} board={board} workspaceId={activeWorkspaceId} busy={busy} onClose={() => setDialog(null)} onSubmit={async (name, payload, message) => {
      const result = await mutate(name, payload, message);
      if (result) { setDialog(null); if (name === "createBoard" && result.id) { setActiveBoardId(result.id); localStorage.setItem("cove.board", result.id); } if (name === "createWorkspace" && result.id) { setActiveBoardId(""); setActiveWorkspaceId(result.id); localStorage.removeItem("cove.board"); localStorage.setItem("cove.workspace", result.id); window.history.replaceState({}, "", window.location.pathname); } }
      return !!result;
    }} />}
    {placement && <CardDetail key={placement.id} cardId={placement.cardId} placementId={placement.id} state={state} onClose={closeCard} onRefresh={refresh} onNavigateBoard={(boardId, cardId) => { const destination = state.boards.find((item) => item.id === boardId); const destinationPlacement = state.placements.find((item) => item.boardId === boardId && item.cardId === cardId); if (destination && destinationPlacement) { setActiveBoardId(destination.id); setActiveWorkspaceId(destination.workspaceId); setSelectedPlacement(destinationPlacement.id); localStorage.setItem("cove.board", destination.id); window.history.replaceState({}, "", `?board=${encodeURIComponent(destination.id)}&card=${encodeURIComponent(cardId || placement.cardId)}`); } }} />}
  </div>;
}

function CoveLogo() { return <div className="cove-logo"><svg width="28" height="29" viewBox="0 0 28 29" fill="none" aria-hidden="true"><path d="M4 15c0-7 6-12 12-10 3 1 5 3 6 6-5-3-8 0-8 4 0 5 4 7 8 4-2 7-11 9-16 3-1-2-2-4-2-7Z" fill="currentColor"/><path d="M18 4c2 0 4 1 5 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg><span>cove<span className="logo-dot">.</span></span></div>; }

function BoardCard({ state, placement, inTray, onOpen, onCollect, onDrop }: { state: AppState; placement: Placement; inTray: boolean; onOpen: () => void; onCollect: () => void; onDrop: (event: DragEvent) => void }) {
  const card = state.cards.find((item) => item.id === placement.cardId);
  if (!card) return null;
  const tags = state.tags.filter((tag) => state.cardTags.some((entry) => entry.cardId === card.id && entry.tagId === tag.id));
  const attachments = state.attachments.filter((item) => item.cardId === card.id);
  const links = state.links.filter((item) => item.cardId === card.id);
  const connections = state.placements.filter((item) => item.cardId === card.id && item.boardId !== placement.boardId);
  const cover = card.cover;
  const imageCover = cover && /^(https?:\/\/|\/api\/uploads\/)/.test(cover);
  const coverUrl = cover?.startsWith("/api/uploads/") ? appPath(cover) : cover;
  return <article className="board-card" draggable onDrop={onDrop} onDragStart={(event) => { const payload = JSON.stringify({ type: "placement", id: placement.id }); event.dataTransfer.setData("application/cove-card", payload); event.dataTransfer.setData("text/plain", payload); event.dataTransfer.effectAllowed = "copyMove"; }}>
    {cover && <button className={`card-cover ${!imageCover ? "art-cover" : ""}`} style={!imageCover ? { background: cover } : undefined} onClick={onOpen} tabIndex={-1} aria-label={`Open ${card.title}`}>{imageCover ? <img src={coverUrl || undefined} alt="" /> : <span className="cover-art"><i /><i /><i /></span>}</button>}
    <div className="card-inner">{tags.length > 0 && <div className="card-tags">{tags.map((tag) => <span className="card-tag" key={tag.id} style={{ "--tag-color": tag.color } as CSSProperties}>{tag.name}</span>)}</div>}<button className="card-open" onClick={onOpen}><h3>{card.title}</h3></button>{card.description && <p className="card-description">{card.description.replace(/[#*`>\[\]]/g, "").slice(0, 105)}</p>}
    <div className="card-bottom"><div className="card-metadata">{connections.length > 0 && <span className="linked-card-badge" title={`Also on ${connections.map((item) => state.boards.find((b) => b.id === item.boardId)?.name).join(", ")}`}><Icon name="link" size={12} />{connections.length + 1} boards</span>}{card.dueDate && <span className="due-date" title={`Scheduled for ${card.dueDate}`}><Icon name="calendar" size={12} />{new Date(`${card.dueDate}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}{card.description && <span title="Has description"><Icon name="text" size={13} /></span>}{attachments.length > 0 && <span title={`${attachments.length} attachments`}><Icon name="paperclip" size={13} />{attachments.length}</span>}{links.length > 0 && <span title={`${links.length} links`}><Icon name="external" size={12} />{links.length}</span>}</div><button className={`collect-button ${inTray ? "collected" : ""}`} title={inTray ? "Already in your tray" : "Add to card tray"} aria-label={inTray ? `${card.title} is in your tray` : `Add ${card.title} to card tray`} disabled={inTray} onClick={onCollect}><Icon name={inTray ? "check" : "tray"} size={14} /></button></div></div>
  </article>;
}

function AddCard({ onAdd, disabled }: { onAdd: (title: string) => Promise<boolean>; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); if (title.trim() && await onAdd(title.trim())) { setTitle(""); setOpen(false); } }
  return open ? <form className="add-card-form" onSubmit={submit}><textarea autoFocus placeholder="What needs to happen?" aria-label="New card title" value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (title.trim()) void submit(event); } }} rows={3} maxLength={200} /><div><button className="button primary small" disabled={disabled || !title.trim()}>Add card</button><button type="button" className="icon-button" aria-label="Cancel new card" onClick={() => setOpen(false)}><Icon name="close" size={17} /></button></div></form> : <button className="add-card-button" onClick={() => setOpen(true)}><Icon name="plus" size={16} />Add a card</button>;
}

function TrayCard({ item, state, board, selected, disabled, onMode, onRemove, onSelect }: { item: TrayItem; state: AppState; board?: Board; selected: boolean; disabled: boolean; onMode: (mode: "move" | "link") => unknown; onRemove: () => unknown; onSelect: () => void }) {
  const placement = state.placements.find((entry) => entry.id === item.placementId);
  const card = state.cards.find((entry) => entry.id === (placement?.cardId || item.cardId));
  const source = state.boards.find((entry) => entry.id === placement?.boardId);
  const unavailable = !placement || !card || card.archived;
  return <div className={`tray-card ${selected ? "selected" : ""}`} draggable={!unavailable} onDragStart={(event) => { event.dataTransfer.setData("application/cove-card", JSON.stringify({ type: "tray", id: item.id })); event.dataTransfer.effectAllowed = "copyMove"; }}><div className="tray-card-source"><Icon name="board" size={12} /><span>{source?.name || "Unavailable source"}</span><button className="icon-button" title="Remove from tray" onClick={onRemove}><Icon name="close" size={13} /></button></div><h3>{card?.title || "This card is no longer available"}</h3><div className="tray-card-controls"><div className="mode-toggle" aria-label="Transfer mode"><button disabled={disabled || unavailable} aria-pressed={item.mode === "move"} className={item.mode === "move" ? "selected" : ""} onClick={() => onMode("move")}><Icon name="arrow" size={12} />Move</button><button disabled={disabled || unavailable} aria-pressed={item.mode === "link"} className={item.mode === "link" ? "selected" : ""} onClick={() => onMode("link")}><Icon name="link" size={12} />Link</button></div><button className={`tray-place-button ${selected ? "selected" : ""}`} disabled={disabled || unavailable || !board} title={selected ? "Cancel placement" : "Choose a column on the current board"} onClick={onSelect}>{selected ? "Cancel" : "Place"}<Icon name={selected ? "close" : "arrow"} size={12} /></button></div>{selected && <p className="tray-selection-hint">Choose a column on {board?.name}.</p>}{unavailable && <p className="tray-selection-hint">Remove this unavailable item to clear your tray.</p>}</div>;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const controls = panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, textarea, [tabindex="0"]');
        if (!controls?.length) return;
        const first = controls[0]; const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="settings-modal" ref={panel} role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="modal-heading"><div><h2 id="settings-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></div>{children}</div></div>;
}

function BoardDialog({ dialog, board, workspaceId, busy, onClose, onSubmit }: { dialog: Dialog; board?: Board; workspaceId: string; busy: boolean; onClose: () => void; onSubmit: (name: string, payload: Record<string, unknown>, message: string) => Promise<boolean> }) {
  const [name, setName] = useState(dialog.kind === "columnSettings" ? dialog.column.name : dialog.kind === "boardSettings" ? board?.name || "" : "");
  const [limit, setLimit] = useState(dialog.kind === "columnSettings" ? String(dialog.column.wipLimit || 5) : "5");
  const [mode, setMode] = useState(dialog.kind === "columnSettings" ? dialog.column.limitMode : "off");
  const [background, setBackground] = useState(board?.background || backgrounds[0].value);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const titles = { workspace: "A new workspace", board: "Make room for a new project", column: "Add a column", columnSettings: "Column settings", background: "Set the scene", boardSettings: "Board settings" };
  const subtitles = { workspace: "A home for related boards, cards, and ideas.", board: "Every good idea starts with a little space.", column: "Give the next step in your workflow a name.", columnSettings: "Keep your work moving at a comfortable pace.", background: "Find a background that feels like your space.", boardSettings: "Give your board a name that feels right." };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (dialog.kind === "workspace") await onSubmit("createWorkspace", { name: name.trim() }, "Workspace created");
    if (dialog.kind === "board") await onSubmit("createBoard", { workspaceId, name: name.trim(), background: backgrounds[0].value }, "Board created");
    if (dialog.kind === "column") await onSubmit("createColumn", { boardId: board?.id, name: name.trim() }, "Column created");
    if (dialog.kind === "columnSettings") await onSubmit("updateColumn", { id: dialog.column.id, columnId: dialog.column.id, name: name.trim(), wipLimit: mode === "off" ? null : Number(limit), limitMode: mode }, "Column settings saved");
    if (dialog.kind === "boardSettings") await onSubmit("updateBoard", { id: board?.id, boardId: board?.id, name: name.trim() }, "Board updated");
    if (dialog.kind === "background") await onSubmit("updateBoard", { id: board?.id, boardId: board?.id, background: backgrounds.find((item) => item.id === background)?.value || background }, "Background updated");
  }
  return <Modal title={titles[dialog.kind]} subtitle={subtitles[dialog.kind]} onClose={onClose}><form onSubmit={submit}>{dialog.kind !== "background" && <label className="field-label">{dialog.kind === "workspace" ? "Workspace name" : dialog.kind === "board" || dialog.kind === "boardSettings" ? "Board name" : "Column name"}<input autoFocus required maxLength={100} value={name} placeholder={dialog.kind === "workspace" ? "e.g. Studio North" : dialog.kind === "board" ? "e.g. Our next big thing" : "e.g. In progress"} onChange={(event) => setName(event.target.value)} /></label>}
    {dialog.kind === "columnSettings" && <><div className="form-divider" /><label className="field-label">Work-in-progress limit<select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="off">Off — no limit</option><option value="warning">Warning — allow cards over the limit</option><option value="strict">Strict — stop new cards at the limit</option></select></label>{mode !== "off" && <label className="field-label">Maximum cards<input type="number" min="1" max="10000" required value={limit} onChange={(event) => setLimit(event.target.value)} /></label>}<p className="field-help">{mode === "strict" ? "Existing cards stay put. New cards and transfers are blocked when this column is full." : mode === "warning" ? "A visible reminder to finish work before starting more. You can still add cards." : "Cards can flow into this column without a capacity limit."}</p></>}
    {dialog.kind === "background" && <><div className="background-preview" style={boardStyle(background)}><span /><span /><span /></div><div className="background-options">{backgrounds.map((item) => <button type="button" className={background === item.value ? "selected" : ""} key={item.id} onClick={() => setBackground(item.value)}><span style={{ background: item.value }}>{background === item.value && <Icon name="check" size={20} style={{ color: item.ink }} />}</span><small>{item.name}</small></button>)}</div><label className="field-label">Or upload your own image<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading || busy} onChange={async (event) => {
      const file = event.target.files?.[0]; if (!file || !board) return;
      setUploading(true); setUploadError("");
      try { const form = new FormData(); form.append("file", file); form.append("boardId", board.id); const response = await fetch(appPath("/api/uploads"), { method: "POST", body: form }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Image could not be uploaded."); setBackground(result.attachment?.url || result.url); }
      catch (error) { setUploadError(error instanceof Error ? error.message : "Image could not be uploaded."); }
      finally { setUploading(false); }
    }} /></label>{uploading && <p className="field-help">Uploading your background…</p>}{uploadError && <p className="upload-error" role="alert">{uploadError}</p>}</>}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy || uploading || (dialog.kind !== "background" && !name.trim())}>{busy || uploading ? "Saving…" : ["background", "columnSettings", "boardSettings"].includes(dialog.kind) ? "Save changes" : dialog.kind === "workspace" ? "Create workspace" : dialog.kind === "board" ? "Create board" : "Add column"}</button></div></form></Modal>;
}
