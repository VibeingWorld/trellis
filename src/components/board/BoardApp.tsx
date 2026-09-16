"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type FormEvent, type ReactNode } from "react";
import CardDetail from "@/components/card/CardDetail";
import { appPath } from "@/lib/app-path";
import { action, readState, signOut, type AppState, type AppUser, type Board, type Column, type Placement, type TrayItem } from "./api";
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

type Dialog = { kind: "workspace" } | { kind: "workspaceSettings" } | { kind: "board" } | { kind: "column" } | { kind: "columnSettings"; column: Column } | { kind: "background" } | { kind: "boardSettings" } | {kind:"account"} | {kind:"integrations"};
type BoardSettingsDialog = Exclude<Dialog,{kind:"account"}|{kind:"integrations"}>;
type Toast = { message: string; error?: boolean; undoId?: string };
type DragPayload = { type: "placement"; id: string } | { type: "tray"; id: string } | { type: "column"; id: string };

export default function BoardApp() {
  const [state, setState] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [activeBoardId, setActiveBoardId] = useState("");
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [workspaceMenu, setWorkspaceMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [trayOpen, setTrayOpen] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [sideExpanded, setSideExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [selectedPlacement, setSelectedPlacement] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragTarget, setDragTarget] = useState("");
  const [columnDragTarget, setColumnDragTarget] = useState("");
  const [activeTrayItem, setActiveTrayItem] = useState<string | null>(null);
  const [fileDropTarget, setFileDropTarget] = useState<string | null>(null);
  const mutationLock = useRef(false);
  const refreshLock = useRef(false);
  const interactionLock = useRef(false);
  const deepLinkHandled = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshLock.current) return;
    refreshLock.current = true;
    try {
      const next = await readState();
      setState(next);
      setLoadError("");
    } finally {
      refreshLock.current = false;
    }
  }, []);

  useEffect(() => {
    const initialBoard = new URLSearchParams(window.location.search).get("board") || localStorage.getItem("cove.board") || "";
    setActiveBoardId(initialBoard);
    setActiveWorkspaceId(localStorage.getItem("cove.workspace") || "");
    if (window.innerWidth <= 800) { setTrayOpen(false); setCalendarOpen(false); }
    refresh().catch((error: Error) => setLoadError(error.message));
    const sync = () => {
      if (document.visibilityState === "visible" && !mutationLock.current && !interactionLock.current) refresh().catch(() => {});
    };
    const onFocus = () => sync();
    const onDragStart = () => { interactionLock.current = true; };
    const onDragEnd = () => { interactionLock.current = false; sync(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", sync);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("dragend", onDragEnd);
    const interval = window.setInterval(sync, 5000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", sync);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("dragend", onDragEnd);
      window.clearInterval(interval);
    };
  }, [refresh]);

  useEffect(() => {
    if (!state) return;
    const selectedBoard = state.boards.find((item) => item.id === activeBoardId);
    if (selectedBoard) {
      if (selectedBoard.workspaceId !== activeWorkspaceId) setActiveWorkspaceId(selectedBoard.workspaceId);
      return;
    }
    const selectedWorkspace = state.workspaces.find((item) => item.id === activeWorkspaceId);
    const nextWorkspace = selectedWorkspace || state.workspaces[0];
    const nextWorkspaceId = nextWorkspace?.id || "";
    const nextBoard = nextWorkspace ? state.boards.find((item) => item.workspaceId === nextWorkspace.id) : undefined;
    const nextBoardId = nextBoard?.id || "";
    if (activeWorkspaceId !== nextWorkspaceId) setActiveWorkspaceId(nextWorkspaceId);
    if (activeBoardId !== nextBoardId) setActiveBoardId(nextBoardId);
    if (nextWorkspaceId) localStorage.setItem("cove.workspace", nextWorkspaceId);
    else localStorage.removeItem("cove.workspace");
    if (nextBoardId) localStorage.setItem("cove.board", nextBoardId);
    else localStorage.removeItem("cove.board");
    const url = nextBoardId ? `?board=${encodeURIComponent(nextBoardId)}` : window.location.pathname;
    if (`${window.location.pathname}${window.location.search}` !== url) window.history.replaceState({}, "", url);
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
  const isAdmin = state?.currentUser?.role === "admin";
  const can = (permission: string, workspaceId = activeWorkspaceId) => isAdmin || !!state?.permissionsByWorkspace?.[workspaceId]?.includes(permission);

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
    try { return JSON.parse(event.dataTransfer.getData("application/cove-column") || event.dataTransfer.getData("application/cove-card") || event.dataTransfer.getData("text/plain")) as DragPayload; } catch { return null; }
  }

  async function dropColumnBefore(event: DragEvent, targetId?: string) {
    event.preventDefault();
    event.stopPropagation();
    setColumnDragTarget("");
    const payload = dragData(event);
    if (payload?.type !== "column" || payload.id === targetId) return;
    const remaining = columns.filter((item) => item.id !== payload.id);
    const index = targetId ? remaining.findIndex((item) => item.id === targetId) : remaining.length;
    if (index < 0) return;
    const before = remaining[index - 1]?.position;
    const after = remaining[index]?.position;
    const nextPosition = before === undefined ? (after ?? 0) - 1 : after === undefined ? before + 1 : (before + after) / 2;
    await mutate("updateColumn", { id: payload.id, position: nextPosition }, "Column moved");
  }

  async function dropOnColumn(event: DragEvent, column: Column) {
    event.preventDefault();
    setDragTarget("");
    const payload = dragData(event);
    if (!payload) return;
    if (payload.type === "tray") await placeTrayItem(payload.id, column.id);
    else if (payload.type === "placement") await mutate("movePlacement", { placementId: payload.id, columnId: column.id, version: state?.placements.find((item) => item.id === payload.id)?.version }, `Moved to ${column.name}`);
  }

  async function dropOnCard(event: DragEvent, target: Placement) {
    const payload = dragData(event);
    if (payload?.type === "column") return;
    event.preventDefault(); event.stopPropagation(); setDragTarget("");
    if (event.dataTransfer.files.length) { setFileDropTarget(null); if(can("uploadFiles")) await uploadFilesToCard(target.cardId,Array.from(event.dataTransfer.files)); return; }
    if (!payload || !state) return;
    if (payload.type === "placement" && payload.id === target.id) return;
    const sorted = state.placements.filter((item) => item.columnId === target.columnId && !(payload.type === "placement" && item.id === payload.id)).sort((a, b) => a.position - b.position);
    const bounds = event.currentTarget.getBoundingClientRect();
    const index = sorted.findIndex((item) => item.id === target.id) + (event.clientY > bounds.top + bounds.height / 2 ? 1 : 0);
    const before = sorted[index - 1]?.position; const after = sorted[index]?.position;
    const position = before === undefined ? (after ?? 0) - 1 : after === undefined ? before + 1 : (before + after) / 2;
    if (payload.type === "tray") await placeTrayItem(payload.id, target.columnId, position);
    else await mutate("movePlacement", { placementId: payload.id, columnId: target.columnId, position, version: state.placements.find((item) => item.id === payload.id)?.version }, "Card moved");
  }

  async function uploadFilesToCard(cardId:string,files:File[]){
    const accepted=files;
    if(!accepted.length){setToast({message:"Drop a file onto the card.",error:true});return;}
    setBusy(true);
    try{for(const file of accepted){const form=new FormData();form.append("file",file);form.append("cardId",cardId);const response=await fetch(appPath("/api/uploads"),{method:"POST",body:form});const result=await response.json();if(!response.ok)throw new Error(result.error||`Could not upload ${file.name}.`);}await refresh();setToast({message:`${accepted.length} attachment${accepted.length===1?"":"s"} added`});}
    catch(error){setToast({message:error instanceof Error?error.message:"Files could not be uploaded.",error:true});}finally{setBusy(false);}
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
        {workspaceMenu && <div className="workspace-menu popover">{state.workspaces.map((item) => <button key={item.id} onClick={() => { const firstBoard = state.boards.find((b) => b.workspaceId === item.id); if (firstBoard) navigateBoard(firstBoard); else { setActiveWorkspaceId(item.id); setActiveBoardId(""); localStorage.removeItem("cove.board"); localStorage.setItem("cove.workspace", item.id); window.history.replaceState({}, "", window.location.pathname); } setWorkspaceMenu(false); setTagFilter(""); }}><span className="workspace-avatar small">{item.name.slice(0, 1)}</span>{item.name}{item.id === activeWorkspaceId && <Icon name="check" size={15} />}</button>)}{can("manageWorkspace")&&<button onClick={() => { setDialog({ kind: "workspaceSettings" }); setWorkspaceMenu(false); }}><Icon name="more" size={16} />Rename workspace</button>}{can("manageWorkspace")&&<button onClick={() => { setDialog({ kind: "integrations" }); setWorkspaceMenu(false); }}><Icon name="link" size={16} />Integrations & AI</button>}{isAdmin&&<button onClick={() => { setDialog({ kind: "workspace" }); setWorkspaceMenu(false); }}><Icon name="plus" size={16} />Create workspace</button>}</div>}
      </div>
      <div className="sidebar-section-title"><span>WORKSPACE</span></div>
      <button className="navigation-item is-active" onClick={() => { if (workspaceBoards[0]) navigateBoard(workspaceBoards[0]); }}><Icon name="board" />Boards<span className="nav-counter">{workspaceBoards.length}</span></button>
      <button className={`navigation-item ${trayOpen ? "is-active" : ""}`} onClick={() => { const opening = !trayOpen; setTrayOpen(opening); if (opening && window.innerWidth <= 800) setCalendarOpen(false); }}><Icon name="tray" />Card tray{trayItems.length > 0 && <span className="nav-counter">{trayItems.length}</span>}</button>
      <button className={`navigation-item ${calendarOpen ? "is-active" : ""}`} onClick={() => { const opening = !calendarOpen; setCalendarOpen(opening); if (opening && window.innerWidth <= 800) setTrayOpen(false); }}><Icon name="calendar" />Calendar<span className="nav-counter">{state.cards.filter((card) => card.workspaceId === activeWorkspaceId && card.dueDate && !card.archived).length}</span></button>
      <div className="sidebar-section-title boards-label"><span>YOUR BOARDS</span>{can("createBoard")&&<button className="icon-button" title="Create board" onClick={() => setDialog({ kind: "board" })}><Icon name="plus" size={16} /></button>}</div>
      <nav className="board-navigation" aria-label="Boards">{workspaceBoards.map((item) => <button key={item.id} className={`board-nav-item ${item.id === activeBoardId ? "is-current" : ""}`} onClick={() => navigateBoard(item)}><span className="board-swatch" style={boardStyle(item.background)} /><span>{item.name}</span>{item.id === activeBoardId && <span className="current-dot" />}</button>)}</nav>
      {can("createBoard")&&<button className="new-board-button" onClick={() => setDialog({ kind: "board" })}><Icon name="plus" size={16} />Create a board</button>}
      <div className="sidebar-bottom"><button className="profile-row" onClick={()=>setDialog({kind:"account"})}><div className="profile-avatar">{state.currentUser?.name?.slice(0,1).toUpperCase()||"Y"}</div><div><strong>{state.currentUser?.name||"Your space"}</strong><small>{isAdmin?"Administrator":state.currentUser?.email}</small></div><span className="local-status" title="Signed in" /></button></div>
    </aside>

    <main className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Icon name="menu" /></button><Icon name="folder" size={16} /><span>{workspace?.name || "Workspace"}</span><span className="breadcrumb-divider">/</span><strong>{board?.name || "Boards"}</strong></div><div className="topbar-right"><span className="local-pill"><span />{busy ? "Saving your changes…" : "Synced with your server"}</span><div className="panel-toggles"><button className={`icon-button tray-toggle ${trayOpen ? "active" : ""}`} title={trayOpen ? "Hide card tray" : "Show card tray"} aria-label={trayOpen ? "Hide card tray" : "Show card tray"} onClick={() => { const opening = !trayOpen; setTrayOpen(opening); if (opening && window.innerWidth <= 800) setCalendarOpen(false); }}><Icon name="tray" size={19} />{trayItems.length > 0 && <b>{trayItems.length}</b>}</button><button className={`icon-button tray-toggle ${calendarOpen ? "active" : ""}`} title={calendarOpen ? "Hide calendar" : "Show calendar"} aria-label={calendarOpen ? "Hide calendar" : "Show calendar"} onClick={() => { const opening = !calendarOpen; setCalendarOpen(opening); if (opening && window.innerWidth <= 800) setTrayOpen(false); }}><Icon name="calendar" size={19} /></button></div></div></header>
      <div className="board-and-tray">
        <section className={`board-surface ${board?.background === "midnight" || board?.background === "#253b42" ? "dark-board" : ""}`} style={boardStyle(board?.background)}>
          {board ? <>
            <div className="board-header"><div><div className="board-eyebrow"><span className="board-tiny-dot" />A LITTLE ROOM FOR BIG IDEAS</div><div className="board-title-row"><h1>{board.name}</h1><span className="visibility-badge">{board.visibility === "public" ? "Public read" : board.visibility === "members" ? "Members" : "Private"}</span>{can("manageWorkspace")&&<button className="icon-button board-menu" aria-label="Board settings" onClick={() => setDialog({ kind: "boardSettings" })}><Icon name="more" /></button>}</div><p>{board.description || "Make a little progress. Move the good things forward."}</p></div>{can("manageWorkspace")&&<button className="button background-button" onClick={() => setDialog({ kind: "background" })}><Icon name="image" size={16} /><span>Background</span></button>}</div>
            <div className="board-toolbar"><div className="board-view-label"><Icon name="board" size={17} /><span>Board</span><span className="view-count">{totalCards}</span></div><div className="toolbar-actions"><div className="board-search"><Icon name="search" size={15} /><input aria-label="Search cards" placeholder="Search cards…" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button className="icon-button" aria-label="Clear search" onClick={() => setSearch("")}><Icon name="close" size={13} /></button>}</div><select className="tag-filter" aria-label="Filter by tag" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}><option value="">All tags</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select>{can("createColumn")&&<button className="button add-column-top" onClick={() => setDialog({ kind: "column" })}><Icon name="plus" size={15} />Add column</button>}</div></div>
            <div className="columns-scroller"><div className="columns-row">{columns.map((column, index) => {
              const allPlacements = state.placements.filter((item) => item.columnId === column.id && !state.cards.find((card) => card.id === item.cardId)?.archived).sort((a, b) => a.position - b.position);
              const visiblePlacements = allPlacements.filter((item) => {
                const card = state.cards.find((entry) => entry.id === item.cardId);
                return card && card.title.toLowerCase().includes(search.toLowerCase()) && (!tagFilter || state.cardTags.some((entry) => entry.cardId === card.id && entry.tagId === tagFilter));
              });
              const atCapacity = column.limitMode !== "off" && !!column.wipLimit && allPlacements.length >= column.wipLimit;
              return <Fragment key={column.id}><section className={`kanban-column ${dragTarget === column.id ? "drag-over" : ""} ${columnDragTarget === column.id ? "column-drag-over" : ""} ${activeTrayItem ? "is-destination" : ""}`} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; if (Array.from(event.dataTransfer.types).includes("application/cove-column")) { setColumnDragTarget(column.id); setDragTarget(""); } else { setDragTarget(column.id); setColumnDragTarget(""); } }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) { setDragTarget(""); setColumnDragTarget(""); } }} onDrop={(event) => Array.from(event.dataTransfer.types).includes("application/cove-column") ? dropColumnBefore(event, column.id) : dropOnColumn(event, column)}>
                <div className="column-header">{can("createColumn")&&<button className="column-drag-handle" draggable aria-label={`Move ${column.name}`} title="Drag to reorder column" onDragStart={(event)=>{const payload=JSON.stringify({type:"column",id:column.id});event.dataTransfer.setData("application/cove-column",payload);event.dataTransfer.setData("text/plain",payload);event.dataTransfer.effectAllowed="move";}} onDragEnd={()=>setColumnDragTarget("")}><Icon name="drag" size={14}/></button>}<span className={`column-status status-${index % 5}`} /><h2>{column.name}</h2><span className={`column-count ${atCapacity ? "at-capacity" : ""}`} title={column.limitMode === "off" ? `${allPlacements.length} cards` : `${column.limitMode} limit`}>{allPlacements.length}{column.limitMode !== "off" && column.wipLimit ? ` / ${column.wipLimit}` : ""}</span>{can("createColumn")&&<button className="icon-button" aria-label={`Settings for ${column.name}`} onClick={() => setDialog({ kind: "columnSettings", column })}><Icon name="more" size={17} /></button>}</div>
                {column.limitMode !== "off" && column.wipLimit && <div className={`column-limit ${atCapacity ? "at-capacity" : ""}`}><div><span style={{ width: `${Math.min(100, allPlacements.length / column.wipLimit * 100)}%` }} /></div><small>{atCapacity ? "At capacity" : `${column.wipLimit - allPlacements.length} spaces left`}<span>{column.limitMode === "strict" ? "Strict limit" : "Soft limit"}</span></small></div>}
                {activeTrayItem && <button className="place-here-button" disabled={busy} onClick={() => placeTrayItem(activeTrayItem, column.id)}><Icon name="tray" size={16} />Place card here</button>}
                <div className="column-cards">{visiblePlacements.map((item) => <BoardCard key={item.id} state={state} placement={item} inTray={state.tray.some((entry) => entry.placementId === item.id)} fileDrop={fileDropTarget===item.id} canUpload={can("uploadFiles")} canMove={can("moveCard")} onFileHover={(active)=>setFileDropTarget(active?item.id:null)} onOpen={() => openCard(item.cardId)} onDrop={(event) => dropOnCard(event, item)} onCollect={() => { setTrayOpen(true); if (window.innerWidth <= 800) setCalendarOpen(false); mutate("addToTray", { placementId: item.id, mode: "move" }, "Card added to your tray"); }} />)}{visiblePlacements.length === 0 && (search || tagFilter) && <div className="no-match">No matching cards</div>}</div>
                {can("createCard")&&<AddCard disabled={busy} onAdd={async (title) => !!(await mutate("createCard", { columnId: column.id, boardId: board.id, workspaceId: activeWorkspaceId, title }, "Card created"))} />}
              </section></Fragment>;
            })}{can("createColumn")&&<div className={`column-end-zone ${columnDragTarget === "end" ? "column-drag-over" : ""}`} onDragOver={(event)=>{if(Array.from(event.dataTransfer.types).includes("application/cove-column")){event.preventDefault();event.dataTransfer.dropEffect="move";setColumnDragTarget("end");}}} onDragLeave={()=>setColumnDragTarget("")} onDrop={(event)=>dropColumnBefore(event)}><button className="add-column-end" onClick={() => setDialog({ kind: "column" })}><Icon name="plus" size={17} />Add a column</button></div>}</div></div>
            <footer className="board-footer"><span><span className="footer-dot" />{totalCards} cards across {columns.length} columns</span>{linkedCards > 0 && <span><Icon name="link" size={13} />{linkedCards} connected {linkedCards === 1 ? "card" : "cards"}</span>}<span className="board-footer-tip">A little progress, every day.</span></footer>
          </> : <div className="empty-board"><div className="empty-board-icon"><Icon name="board" size={32} /></div><h1>A fresh space for your ideas.</h1><p>Create your first board and make something happen.</p><button className="button primary" onClick={() => setDialog({ kind: state.workspaces.length ? "board" : "workspace" })}><Icon name="plus" size={16} />{state.workspaces.length ? "Create a board" : "Create a workspace"}</button></div>}
        </section>
        {trayOpen && <aside className={`card-tray side-panel tray-panel ${dragTarget === "tray" ? "drag-over" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragTarget("tray"); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragTarget(""); }} onDrop={async (event) => { event.preventDefault(); setDragTarget(""); const payload = dragData(event); if (payload?.type === "placement") await mutate("addToTray", { placementId: payload.id, mode: "move" }, "Card added to your tray"); }}>
          <div className="side-panel-top"><div className="side-panel-title"><Icon name="tray" size={15} /><strong>Tray</strong>{trayItems.length > 0 && <span>{trayItems.length}</span>}</div><button className="icon-button" aria-label="Close card tray" onClick={() => setTrayOpen(false)}><Icon name="close" size={17} /></button></div>
          <>
          <div className="tray-heading"><span className="tray-heading-icon"><Icon name="tray" size={20} /></span><h2>Card tray</h2><span className="tray-count">{trayItems.length}</span></div>
          <p className="tray-description">A pocket for cards on the move.<br />Collect here. Drop on any board.</p>
          <div className="tray-workspace-label"><span className="small-dot" />{workspace?.name || "Your workspace"}<span>PRIVATE TO YOU</span></div>
          <div className="tray-items">{trayItems.map((item) => <TrayCard key={item.id} item={item} state={state} board={board} selected={activeTrayItem === item.id} disabled={busy} onMode={(mode) => mutate("updateTray", { id: item.id, trayId: item.id, mode })} onRemove={() => mutate("removeFromTray", { id: item.id, trayId: item.id })} onSelect={() => { setActiveTrayItem(activeTrayItem === item.id ? null : item.id); if (window.innerWidth <= 800 && activeTrayItem !== item.id) setTrayOpen(false); }} />)}<div className={`tray-drop-zone ${trayItems.length === 0 ? "empty" : ""}`}><div className="tray-illustration"><span /><span /><span><Icon name="plus" size={21} /></span></div><strong>{trayItems.length ? "Room for one more idea" : "Good ideas travel."}</strong><p>Drag a card here, or use the<br />tray icon on any card.</p></div></div>
          <div className="tray-explainer"><div><span className="explain-icon move"><Icon name="arrow" size={15} /></span><p><strong>Move a card</strong><small>Take it from one board to another.</small></p></div><div><span className="explain-icon link"><Icon name="link" size={15} /></span><p><strong>Link a card</strong><small>One card, connected across boards.<br />Edits stay in sync everywhere.</small></p></div></div><div className="tray-bottom"><Icon name="check" size={13} />Your tray stays with you across boards</div>
          </>
        </aside>}
        {calendarOpen && <aside className={`card-tray side-panel calendar-panel-shell calendar-active ${sideExpanded ? "expanded" : ""}`}>
          <div className="side-panel-top"><div className="side-panel-title"><Icon name="calendar" size={15} /><strong>Calendar</strong></div><button className={`icon-button ${sideExpanded ? "active" : ""}`} aria-label={sideExpanded ? "Restore calendar width" : "Expand calendar to half screen"} title={sideExpanded ? "Restore width" : "Expand to half screen"} onClick={() => setSideExpanded(!sideExpanded)}><Icon name="expand" size={15} /></button><button className="icon-button" aria-label="Close calendar" onClick={() => setCalendarOpen(false)}><Icon name="close" size={17} /></button></div>
          <CalendarPanel state={state} workspaceId={activeWorkspaceId} busy={busy} onSchedule={async (cardId, schedule) => { const card = state.cards.find((item) => item.id === cardId); await mutate("updateCard", { id: cardId, ...schedule, version: card?.version }, schedule.dueDate ? `Scheduled for ${schedule.scheduledStart ? new Date(schedule.scheduledStart).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : new Date(`${schedule.dueDate}T12:00:00`).toLocaleDateString()}` : "Removed from calendar"); }} onOpenCard={openCard} onNotice={(message) => setToast({ message })} />
        </aside>}
      </div>
    </main>
    {toast && <div className={`toast ${toast.error ? "error" : ""}`} role={toast.error ? "alert" : "status"}><Icon name={toast.error ? "help" : "check"} size={17} /><span>{toast.message}</span>{toast.undoId && <button disabled={busy} onClick={async () => { if (await mutate("undo", { id: toast.undoId, operationId: toast.undoId }, "Change undone")) setToast({ message: "Change undone" }); }}>Undo</button>}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast(null)}><Icon name="close" size={15} /></button></div>}
    {dialog && dialog.kind!=="account"&&dialog.kind!=="integrations" && <BoardDialog dialog={dialog} board={board} workspaces={state.workspaces} workspace={workspace} workspaceId={activeWorkspaceId} boardMembers={state.boardMembers} memberOptions={state.memberOptions||[]} allowAccess={isAdmin||board?.ownerUserId===state.currentUser?.id} busy={busy} onClose={() => setDialog(null)} onSubmit={async (name, payload, message) => {
      const result = await mutate(name, payload, message);
      if (result) { setDialog(null); if (name === "createBoard" && result.id) { setActiveBoardId(result.id); localStorage.setItem("cove.board", result.id); } if (name === "createWorkspace" && result.id) { setActiveBoardId(""); setActiveWorkspaceId(result.id); localStorage.removeItem("cove.board"); localStorage.setItem("cove.workspace", result.id); window.history.replaceState({}, "", window.location.pathname); } if(name==="moveBoardWorkspace"&&result.workspaceId){setActiveWorkspaceId(String(result.workspaceId));localStorage.setItem("cove.workspace",String(result.workspaceId));} }
      return !!result;
    }} />}
    {dialog?.kind==="integrations"&&<IntegrationDialog state={state} workspaceId={activeWorkspaceId} busy={busy} onClose={()=>setDialog(null)} onSave={async(payload)=>!!(await mutate("saveWorkspaceIntegration",payload,"Integrations saved"))}/>}
    {dialog?.kind==="account"&&<AccountDialog state={state} busy={busy} onClose={()=>setDialog(null)} onSubmit={async(name,payload,message)=>!!(await mutate(name,payload,message))}/>}
    {placement && <CardDetail key={placement.id} cardId={placement.cardId} placementId={placement.id} state={state} onClose={closeCard} onRefresh={refresh} onNavigateBoard={(boardId, cardId) => { const destination = state.boards.find((item) => item.id === boardId); const destinationPlacement = state.placements.find((item) => item.boardId === boardId && item.cardId === cardId); if (destination && destinationPlacement) { setActiveBoardId(destination.id); setActiveWorkspaceId(destination.workspaceId); setSelectedPlacement(destinationPlacement.id); localStorage.setItem("cove.board", destination.id); window.history.replaceState({}, "", `?board=${encodeURIComponent(destination.id)}&card=${encodeURIComponent(cardId || placement.cardId)}`); } }} />}
  </div>;
}

function CoveLogo() { return <div className="cove-logo"><svg width="28" height="29" viewBox="0 0 28 29" fill="none" aria-hidden="true"><path d="M4 15c0-7 6-12 12-10 3 1 5 3 6 6-5-3-8 0-8 4 0 5 4 7 8 4-2 7-11 9-16 3-1-2-2-4-2-7Z" fill="currentColor"/><path d="M18 4c2 0 4 1 5 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg><span>cove<span className="logo-dot">.</span></span></div>; }

function BoardCard({ state, placement, inTray, fileDrop, canUpload, canMove, onFileHover, onOpen, onCollect, onDrop }: { state: AppState; placement: Placement; inTray: boolean; fileDrop:boolean; canUpload:boolean; canMove:boolean; onFileHover:(active:boolean)=>void; onOpen: () => void; onCollect: () => void; onDrop: (event: DragEvent) => void }) {
  const card = state.cards.find((item) => item.id === placement.cardId);
  if (!card) return null;
  const tags = state.tags.filter((tag) => state.cardTags.some((entry) => entry.cardId === card.id && entry.tagId === tag.id));
  const attachments = state.attachments.filter((item) => item.cardId === card.id);
  const links = state.links.filter((item) => item.cardId === card.id);
  const connections = state.placements.filter((item) => item.cardId === card.id && item.boardId !== placement.boardId);
  const cover = card.cover;
  const imageCover = cover && /^(https?:\/\/|\/api\/uploads\/)/.test(cover);
  const coverUrl = cover?.startsWith("/api/uploads/") ? appPath(cover) : cover;
  return <article className={`board-card ${fileDrop?"file-drop":""}`} draggable={canMove} onDragOver={(event)=>{if(canUpload&&Array.from(event.dataTransfer.types).includes("Files")){event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect="copy";onFileHover(true);}}} onDragLeave={(event)=>{if(!event.currentTarget.contains(event.relatedTarget as Node))onFileHover(false);}} onDrop={onDrop} onDragStart={(event) => { const payload = JSON.stringify({ type: "placement", id: placement.id }); event.dataTransfer.setData("application/cove-card", payload); event.dataTransfer.setData("text/plain", payload); event.dataTransfer.effectAllowed = "copyMove"; }}>
    {cover && <button className={`card-cover ${!imageCover ? "art-cover" : ""}`} style={!imageCover ? { background: cover } : undefined} onClick={onOpen} tabIndex={-1} aria-label={`Open ${card.title}`}>{imageCover ? <img src={coverUrl || undefined} alt="" /> : <span className="cover-art"><i /><i /><i /></span>}</button>}
    <div className="card-inner">{tags.length > 0 && <div className="card-tags">{tags.map((tag) => <span className="card-tag" key={tag.id} style={{ "--tag-color": tag.color } as CSSProperties}>{tag.name}</span>)}</div>}<button className="card-open" onClick={onOpen}><span className="card-number">#{card.cardNumber}</span><h3>{card.title}</h3></button>{card.description && <p className="card-description">{card.description.replace(/[#*`>\[\]]/g, "").slice(0, 105)}</p>}
    <div className="card-bottom"><div className="card-metadata">{connections.length > 0 && <span className="linked-card-badge" title={`Also on ${connections.map((item) => state.boards.find((b) => b.id === item.boardId)?.name).join(", ")}`}><Icon name="link" size={12} />{connections.length + 1} boards</span>}{card.dueDate && <span className="due-date" title={`Scheduled for ${card.dueDate}`}><Icon name="calendar" size={12} />{new Date(`${card.dueDate}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}{card.description && <span title="Has description"><Icon name="text" size={13} /></span>}{attachments.length > 0 && <span title={`${attachments.length} attachments`}><Icon name="paperclip" size={13} />{attachments.length}</span>}{links.length > 0 && <span title={`${links.length} links`}><Icon name="external" size={12} />{links.length}</span>}</div>{canMove&&<button className={`collect-button ${inTray ? "collected" : ""}`} title={inTray ? "Already in your tray" : "Add to card tray"} aria-label={inTray ? `${card.title} is in your tray` : `Add ${card.title} to card tray`} disabled={inTray} onClick={onCollect}><Icon name={inTray ? "check" : "tray"} size={14} /></button>}</div></div>
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

function BoardDialog({ dialog, board, workspace, workspaces, workspaceId, boardMembers, memberOptions, allowAccess, busy, onClose, onSubmit }: { dialog: BoardSettingsDialog; board?: Board; workspace?:AppState["workspaces"][number]; workspaces:AppState["workspaces"]; workspaceId: string; boardMembers:AppState["boardMembers"]; memberOptions:NonNullable<AppState["memberOptions"]>; allowAccess:boolean; busy: boolean; onClose: () => void; onSubmit: (name: string, payload: Record<string, unknown>, message: string) => Promise<boolean> }) {
  const [name, setName] = useState(dialog.kind === "columnSettings" ? dialog.column.name : dialog.kind === "boardSettings" ? board?.name || "" : dialog.kind==="workspaceSettings"?workspace?.name||"":"");
  const [limit, setLimit] = useState(dialog.kind === "columnSettings" ? String(dialog.column.wipLimit || 5) : "5");
  const [mode, setMode] = useState(dialog.kind === "columnSettings" ? dialog.column.limitMode : "off");
  const [background, setBackground] = useState(board?.background || backgrounds[0].value);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [targetWorkspace,setTargetWorkspace]=useState(workspaces.find(item=>item.id!==workspaceId)?.id||"");
  const [visibility,setVisibility]=useState<Board["visibility"]>(board?.visibility||"private");
  const [memberIds,setMemberIds]=useState<string[]>(()=>boardMembers.filter(item=>item.boardId===board?.id).map(item=>item.userId));
  const titles = { workspace: "A new workspace", workspaceSettings:"Workspace settings", board: "Make room for a new project", column: "Add a column", columnSettings: "Column settings", background: "Set the scene", boardSettings: "Board settings" };
  const subtitles = { workspace: "A home for related boards, cards, and ideas.", workspaceSettings:"Update how this workspace appears to everyone.", board: "Every good idea starts with a little space.", column: "Give the next step in your workflow a name.", columnSettings: "Keep your work moving at a comfortable pace.", background: "Find a background that feels like your space.", boardSettings: "Choose who can see this board, rename it, or move it." };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (dialog.kind === "workspace") await onSubmit("createWorkspace", { name: name.trim() }, "Workspace created");
    if (dialog.kind === "workspaceSettings") await onSubmit("updateWorkspace", { id: workspaceId, name: name.trim() }, "Workspace renamed");
    if (dialog.kind === "board") await onSubmit("createBoard", { workspaceId, name: name.trim(), background: backgrounds[0].value }, "Board created");
    if (dialog.kind === "column") await onSubmit("createColumn", { boardId: board?.id, name: name.trim() }, "Column created");
    if (dialog.kind === "columnSettings") await onSubmit("updateColumn", { id: dialog.column.id, columnId: dialog.column.id, name: name.trim(), wipLimit: mode === "off" ? null : Number(limit), limitMode: mode }, "Column settings saved");
    if (dialog.kind === "boardSettings") await onSubmit("updateBoard", { id: board?.id, boardId: board?.id, name: name.trim(), ...(allowAccess?{visibility,memberIds}:{}) }, "Board settings saved");
    if (dialog.kind === "background") await onSubmit("updateBoard", { id: board?.id, boardId: board?.id, background: backgrounds.find((item) => item.id === background)?.value || background }, "Background updated");
  }
  return <Modal title={titles[dialog.kind]} subtitle={subtitles[dialog.kind]} onClose={onClose}><form onSubmit={submit}>{dialog.kind !== "background" && <label className="field-label">{dialog.kind === "workspace"||dialog.kind==="workspaceSettings" ? "Workspace name" : dialog.kind === "board" || dialog.kind === "boardSettings" ? "Board name" : "Column name"}<input autoFocus required maxLength={100} value={name} placeholder={dialog.kind === "workspace" ? "e.g. Studio North" : dialog.kind === "board" ? "e.g. Our next big thing" : "e.g. In progress"} onChange={(event) => setName(event.target.value)} /></label>}
    {dialog.kind === "columnSettings" && <><div className="form-divider" /><label className="field-label">Work-in-progress limit<select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="off">Off — no limit</option><option value="warning">Warning — allow cards over the limit</option><option value="strict">Strict — stop new cards at the limit</option></select></label>{mode !== "off" && <label className="field-label">Maximum cards<input type="number" min="1" max="10000" required value={limit} onChange={(event) => setLimit(event.target.value)} /></label>}<p className="field-help">{mode === "strict" ? "Existing cards stay put. New cards and transfers are blocked when this column is full." : mode === "warning" ? "A visible reminder to finish work before starting more. You can still add cards." : "Cards can flow into this column without a capacity limit."}</p></>}
    {dialog.kind === "background" && <><div className="background-preview" style={boardStyle(background)}><span /><span /><span /></div><div className="background-options">{backgrounds.map((item) => <button type="button" className={background === item.value ? "selected" : ""} key={item.id} onClick={() => setBackground(item.value)}><span style={{ background: item.value }}>{background === item.value && <Icon name="check" size={20} style={{ color: item.ink }} />}</span><small>{item.name}</small></button>)}</div><label className="field-label">Or upload your own image<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading || busy} onChange={async (event) => {
      const file = event.target.files?.[0]; if (!file || !board) return;
      setUploading(true); setUploadError("");
      try { const form = new FormData(); form.append("file", file); form.append("boardId", board.id); const response = await fetch(appPath("/api/uploads"), { method: "POST", body: form }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Image could not be uploaded."); setBackground(result.attachment?.url || result.url); }
      catch (error) { setUploadError(error instanceof Error ? error.message : "Image could not be uploaded."); }
      finally { setUploading(false); }
    }} /></label>{uploading && <p className="field-help">Uploading your background…</p>}{uploadError && <p className="upload-error" role="alert">{uploadError}</p>}</>}
    {dialog.kind==="boardSettings"&&<div className="board-access-settings"><div className="form-divider"/><h3>Who can view this board?</h3><div className="visibility-options">{([ ["private","Private","Only the owner can view it."], ["members","Selected members","Choose from accounts added by an admin."], ["public","Public read-only","Anyone with the link can view it, but cannot make changes."] ] as const).map(([value,label,help])=><label key={value} className={visibility===value?"selected":""}><input type="radio" name="visibility" value={value} checked={visibility===value} onChange={()=>setVisibility(value)}/><span><strong>{label}</strong><small>{help}</small></span></label>)}</div>{visibility==="members"&&<div className="board-member-picker"><strong>People with access</strong>{memberOptions.filter(option=>option.workspaceIds.includes(workspaceId)&&option.id!==board?.ownerUserId).length?memberOptions.filter(option=>option.workspaceIds.includes(workspaceId)&&option.id!==board?.ownerUserId).map(option=><label key={option.id}><input type="checkbox" checked={memberIds.includes(option.id)} onChange={()=>setMemberIds(current=>current.includes(option.id)?current.filter(id=>id!==option.id):[...current,option.id])}/><span><b>{option.name}</b><small>{option.email}</small></span></label>):<p>No eligible accounts yet. Add an account with permission to view this workspace first.</p>}</div>}{visibility==="public"&&board&&<div className="public-link-box"><span>{appPath(`/public/boards/${board.id}`)}</span><button type="button" className="button secondary" onClick={()=>void navigator.clipboard.writeText(`${window.location.origin}${appPath(`/public/boards/${board.id}`)}`)}>Copy public link</button></div>}</div>}
    {dialog.kind==="boardSettings"&&workspaces.length>1&&<div className="move-board-box"><label className="field-label">Move board to<select value={targetWorkspace} onChange={event=>setTargetWorkspace(event.target.value)}>{workspaces.filter(item=>item.id!==workspaceId).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><p>Cards that appear on another board must be unlinked first. Workspace-specific tags are removed when moving.</p><button type="button" className="button secondary" disabled={busy||!targetWorkspace} onClick={()=>void onSubmit("moveBoardWorkspace",{id:board?.id,workspaceId:targetWorkspace},"Board moved to its new workspace")}>Move board</button></div>}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy || uploading || (dialog.kind !== "background" && !name.trim())}>{busy || uploading ? "Saving…" : ["background", "columnSettings", "boardSettings","workspaceSettings"].includes(dialog.kind) ? "Save changes" : dialog.kind === "workspace" ? "Create workspace" : dialog.kind === "board" ? "Create board" : "Add column"}</button></div></form></Modal>;
}

function IntegrationDialog({state,workspaceId,busy,onClose,onSave}:{state:AppState;workspaceId:string;busy:boolean;onClose:()=>void;onSave:(payload:Record<string,unknown>)=>Promise<boolean>}){
  const saved=state.workspaceIntegrations.find(item=>item.workspaceId===workspaceId);
  const [githubOwner,setGithubOwner]=useState(saved?.githubOwner||"");
  const [githubRepo,setGithubRepo]=useState(saved?.githubRepo||"");
  const [githubProjectUrl,setGithubProjectUrl]=useState(saved?.githubProjectUrl||"");
  const [codexProjectName,setCodexProjectName]=useState(saved?.codexProjectName||"");
  const [aiTriggerColumnId,setAiTriggerColumnId]=useState(saved?.aiTriggerColumnId||"");
  const workspaceBoards=state.boards.filter(board=>board.workspaceId===workspaceId);
  const columns=state.columns.filter(column=>workspaceBoards.some(board=>board.id===column.boardId));
  async function submit(event:FormEvent){event.preventDefault();if(await onSave({workspaceId,githubOwner,githubRepo,githubProjectUrl,codexProjectName,aiTriggerColumnId:aiTriggerColumnId||null}))onClose();}
  return <Modal title="Integrations & AI" subtitle="Connect this workspace to a code project and its GitHub work." onClose={onClose}><form className="integration-form" onSubmit={submit}>
    <section className="integration-card"><div className="integration-heading"><div><strong>GitHub</strong><span>Issues and Projects</span></div><b className={saved?.githubConfigured?"connected":"needs-key"}>{saved?.githubConfigured?"Server ready":"VPS key needed"}</b></div>
      <div className="user-fields"><label className="field-label">Owner or organization<input value={githubOwner} onChange={event=>setGithubOwner(event.target.value)} maxLength={100} placeholder="acme" /></label><label className="field-label">Repository<input value={githubRepo} onChange={event=>setGithubRepo(event.target.value)} maxLength={100} placeholder="web-app" /></label></div>
      <label className="field-label">GitHub Project URL <span>(optional)</span><input type="url" value={githubProjectUrl} onChange={event=>setGithubProjectUrl(event.target.value)} placeholder="https://github.com/orgs/acme/projects/1" /></label>
      <p className="field-help">Cards can create or link issues. When a Project URL is set, linked issues are also added to that Project. The token is read only from <code>GITHUB_TOKEN</code> on the VPS.</p>
    </section>
    <section className="integration-card"><div className="integration-heading"><div><strong>Codex desktop</strong><span>Queue a new coding task when a card moves</span></div><b className={saved?.codexConfigured?"connected":"needs-key"}>{saved?.codexConfigured?"Ready":"Setup needed"}</b></div>
      <label className="field-label">Saved Codex project name<input value={codexProjectName} onChange={event=>setCodexProjectName(event.target.value)} maxLength={200} placeholder="Trello-Clone" /></label>
      <label className="field-label">Start a new AI session when moved to<select value={aiTriggerColumnId} onChange={event=>setAiTriggerColumnId(event.target.value)}><option value="">Off</option>{workspaceBoards.map(board=><optgroup key={board.id} label={board.name}>{columns.filter(column=>column.boardId===board.id).map(column=><option value={column.id} key={column.id}>{column.name}</option>)}</optgroup>)}</select></label>
      <p className="field-help">Use the exact project name shown in the Codex desktop sidebar. Your Mac monitor creates the task with your ChatGPT account—there is no OpenAI API key on the VPS.</p>
    </section>
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy?"Checking & saving…":"Save integrations"}</button></div>
  </form></Modal>;
}

const permissionOptions=[
  ["read","View boards"],["createBoard","Create boards"],["createColumn","Create & edit columns"],["createCard","Create cards"],
  ["editCard","Edit cards"],["moveCard","Move & link cards"],["uploadFiles","Upload files"],["manageWorkspace","Rename & manage workspace"],
] as const;

function AccountDialog({state,busy,onClose,onSubmit}:{state:AppState;busy:boolean;onClose:()=>void;onSubmit:(name:string,payload:Record<string,unknown>,message:string)=>Promise<boolean>}){
  const isAdmin=state.currentUser?.role==="admin";
  const [selectedId,setSelectedId]=useState<string>("");
  const selected=state.users?.find(user=>user.id===selectedId);
  const [name,setName]=useState("");const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [role,setRole]=useState<"admin"|"member">("member");const [active,setActive]=useState(true);const [permissions,setPermissions]=useState<Record<string,string[]>>(()=>Object.fromEntries(state.workspaces.map(workspace=>[workspace.id,[]])));const [boardIds,setBoardIds]=useState<string[]>([]);
  function load(user?:AppUser){setSelectedId(user?.id||"");setName(user?.name||"");setEmail(user?.email||"");setPassword("");setRole(user?.role||"member");setActive(user?.active??true);setPermissions(Object.fromEntries(state.workspaces.map(workspace=>[workspace.id,user?.memberships.find(member=>member.workspaceId===workspace.id)?.permissions||[]])));setBoardIds(user?.boardIds||[]);}
  async function save(event:FormEvent){event.preventDefault();const payload={id:selectedId||undefined,name:name.trim(),email:email.trim(),password:password||undefined,role,active,permissionsByWorkspace:permissions,boardIds};if(await onSubmit(selectedId?"updateUser":"createUser",payload,selectedId?"Account updated":"Account created")){setPassword("");if(!selectedId){setName("");setEmail("");setBoardIds([]);}}}
  function toggle(workspaceId:string,permission:string){setPermissions(current=>{const values=new Set(current[workspaceId]||[]);if(values.has(permission))values.delete(permission);else values.add(permission);if(permission!=="read"&&values.size)values.add("read");return{...current,[workspaceId]:[...values]};});}
  function toggleBoard(boardId:string){setBoardIds(current=>current.includes(boardId)?current.filter(id=>id!==boardId):[...current,boardId]);}
  return <Modal title={isAdmin?"People & permissions":"Your account"} subtitle={isAdmin?"Place people in whole workspaces, selected boards, or keep them outside both.":"Your signed-in account details."} onClose={onClose}>
    <div className="account-summary"><span>{state.currentUser?.name?.slice(0,1).toUpperCase()}</span><div><strong>{state.currentUser?.name}</strong><small>{state.currentUser?.email}</small></div><b>{state.currentUser?.role}</b></div>
    {isAdmin&&<div className="account-admin">
      <div className="user-list"><button className={!selectedId?"selected":""} onClick={()=>load()}><span>+</span><div><strong>New account</strong><small>Email and password</small></div></button>{state.users?.map(user=><button key={user.id} className={selectedId===user.id?"selected":""} onClick={()=>load(user)}><span>{user.name.slice(0,1).toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.email}</small></div><i className={user.active?"":"inactive"}>{user.role}</i></button>)}</div>
      <form className="user-editor" onSubmit={save}>
        <h3>{selected?`Edit ${selected.name}`:"Create an account"}</h3>
        <div className="user-fields"><label className="field-label">Name<input required maxLength={100} value={name} onChange={event=>setName(event.target.value)}/></label><label className="field-label">Email<input required type="email" maxLength={255} value={email} onChange={event=>setEmail(event.target.value)}/></label></div>
        <div className="user-fields"><label className="field-label">Role<select value={role} onChange={event=>setRole(event.target.value as "admin"|"member")}><option value="member">Member</option><option value="admin">Administrator</option></select></label><label className="field-label">{selected?"New password (optional)":"Password"}<input required={!selected} type="password" minLength={password?12:undefined} maxLength={200} value={password} onChange={event=>setPassword(event.target.value)} placeholder={selected?"Leave unchanged":"At least 12 characters"}/></label></div>
        {selected&&<label className="active-account"><input type="checkbox" checked={active} onChange={event=>setActive(event.target.checked)}/><span>Account active</span></label>}
        {role==="member"&&<>
          <div className="permission-matrix"><h4>Workspace permissions</h4><p className="access-help">Leave every permission off to keep this account outside the workspace.</p>{state.workspaces.map(workspace=><section key={workspace.id}><div><strong>{workspace.name}</strong><button type="button" onClick={()=>setPermissions(current=>({...current,[workspace.id]:permissionOptions.map(([id])=>id)}))}>Allow all</button></div><div>{permissionOptions.map(([id,label])=><label key={id}><input type="checkbox" checked={(permissions[workspace.id]||[]).includes(id)} onChange={()=>toggle(workspace.id,id)}/><span>{label}</span></label>)}</div></section>)}</div>
          <div className="board-access-admin"><h4>Specific board access</h4><p className="access-help">Use this for people who should see only certain boards. Without workspace editing permissions, their access is read-only.</p>{state.workspaces.map(workspace=>{const boards=state.boards.filter(board=>board.workspaceId===workspace.id);const allSelected=boards.length>0&&boards.every(board=>boardIds.includes(board.id));return <section key={workspace.id}><div><strong>{workspace.name}</strong>{boards.length>0&&<button type="button" onClick={()=>setBoardIds(current=>allSelected?current.filter(id=>!boards.some(board=>board.id===id)):[...new Set([...current,...boards.map(board=>board.id)])])}>{allSelected?"Clear":"Select all"}</button>}</div>{boards.length?<div>{boards.map(board=><label key={board.id}><input type="checkbox" checked={boardIds.includes(board.id)} onChange={()=>toggleBoard(board.id)}/><span><b>{board.name}</b><small>{board.visibility}</small></span></label>)}</div>:<p>No boards in this workspace.</p>}</section>})}</div>
        </>}
        <button className="button primary" disabled={busy||!name.trim()||!email.trim()||(!selected&&password.length<12)}>{busy?"Saving…":selected?"Save account":"Create account"}</button>
      </form>
    </div>}
    <div className="account-footer">{state.authenticationDisabled?<small>Direct administrator access is enabled on this server.</small>:<button className="button secondary" onClick={async()=>{try{await signOut();window.location.assign(appPath('/login'));}catch(error){window.alert(error instanceof Error?error.message:'Could not sign out.');}}}>Sign out</button>}</div>
  </Modal>;
}
