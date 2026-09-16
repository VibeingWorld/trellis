import { appPath } from "@/lib/app-path";

export type Workspace = { id: string; name: string; description?: string };
export type Board = { id: string; workspaceId: string; name: string; description?: string; background: string; visibility:"private"|"members"|"public"; ownerUserId?:string|null };
export type Column = { id: string; boardId: string; name: string; position: number; wipLimit: number | null; limitMode: "off" | "warning" | "strict" };
export type Card = { id: string; workspaceId: string; cardNumber: number; title: string; description: string; cover?: string | null; dueDate?: string | null; scheduledStart?: string | null; scheduledEnd?: string | null; version?: number; archived?: boolean };
export type Placement = { id: string; cardId: string; boardId: string; columnId: string; position: number; version?: number };
export type Tag = { id: string; workspaceId: string; name: string; color: string };
export type CardTag = { cardId: string; tagId: string };
export type CardLink = { id: string; cardId: string; title?: string; label?: string; url: string };
export type Attachment = { id: string; cardId?: string | null; name?: string; originalName?: string; filename?: string; url?: string; mimeType?: string; size?: number | null };
export type TrayItem = { id: string; placementId: string; mode: "move" | "link"; workspaceId?: string; cardId?: string };
export type AppUser = {id:string;name:string;email:string;role:"admin"|"member";active:boolean;memberships:{workspaceId:string;permissions:string[]}[];boardIds:string[]};
export type AppState = { workspaces: Workspace[]; boards: Board[]; columns: Column[]; cards: Card[]; placements: Placement[]; tags: Tag[]; cardTags: CardTag[]; links: CardLink[]; attachments: Attachment[]; tray: TrayItem[]; relations?: { id: string; cardId: string; relatedCardId: string }[]; boardMembers:{boardId:string;userId:string}[]; memberOptions?:{id:string;name:string;email:string;workspaceIds:string[]}[]; authenticationDisabled:boolean; currentUser?:Omit<AppUser,"memberships"|"boardIds">; permissionsByWorkspace?:Record<string,string[]>; users?:AppUser[] };
export type ActionResult = { ok?: boolean; error?: string; warning?: string; operationId?: string; undoId?: string; id?: string; [key: string]: unknown };

export async function readState(): Promise<AppState> {
  const response = await fetch(appPath("/api/state"), { cache: "no-store" });
  if (response.status === 401) { window.location.assign(appPath('/login')); throw new Error('Please sign in.'); }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load your workspace.");
  return data;
}

export async function action(name: string, payload: Record<string, unknown> = {}): Promise<ActionResult> {
  const response = await fetch(appPath("/api/actions"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name, ...payload }) });
  if (response.status === 401) { window.location.assign(appPath('/login')); throw new Error('Please sign in.'); }
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || "This change could not be saved.");
  return data;
}
