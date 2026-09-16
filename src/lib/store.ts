import { randomUUID } from 'node:crypto';
import { db, sqlite } from '../db';
import * as s from '../db/schema';
import type { AppState } from './types';
import { AppError } from './errors';
export { AppError } from './errors';
import { isAuthenticationDisabled, permissionsFor, requirePermission, type Permission, type SessionUser } from './auth';

type Row = Record<string, any>;
const uid = () => randomUUID();
const row = (table: string, id: unknown): Row => { if (typeof id !== 'string') throw new AppError('An item ID is required.'); const value = sqlite.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Row | undefined; if (!value) throw new AppError('This item is no longer available.', 404); return value; };
const str = (value: unknown, label = 'Name', max = 300) => {if (typeof value !== 'string' || !value.trim()) throw new AppError(`${label} is required.`); if (value.length > max) throw new AppError(`${label} is too long.`); return value.trim();};
const optionalText = (value: unknown, max = 100000) => {if(typeof value !== 'string' || value.length > max)throw new AppError('Invalid text.');return value;};
const mode = (value: unknown) => {if(!['off','warning','strict'].includes(String(value)))throw new AppError('Choose Off, Warning, or Strict.');return String(value);};
const trayMode = (value: unknown) => {if(value !== 'move' && value !== 'link')throw new AppError('Choose Move or Link.');return value;};
const limit = (value: unknown) => {if(value === null || value === '')return null;if(typeof value !== 'number'||!Number.isInteger(value)||value<1||value>10000)throw new AppError('Column limit must be a whole number from 1 to 10,000.');return value;};
const position = (value: unknown, fallback: number) => {if(value === undefined)return fallback;if(typeof value !== 'number'||!Number.isFinite(value))throw new AppError('Invalid position.');return value;};
function nextPosition(columnId: string) {return Number((sqlite.prepare('SELECT coalesce(max(position),-1)+1 AS n FROM placements WHERE column_id=?').get(columnId) as Row).n);}
function sameWorkspace(...ids: string[]) {if(!ids.every(x=>x===ids[0]))throw new AppError('Cards can only be shared within the same workspace.',403);}
function activeCard(id: unknown) {const card = row('cards',id);if(card.archived)throw new AppError('This card has been archived.',409);return card;}
function capacity(column: Row, exclude?: string) {
  const count = Number((sqlite.prepare('SELECT count(*) AS n FROM placements p JOIN cards c ON c.id=p.card_id WHERE p.column_id=? AND c.archived=0 AND p.id!=?').get(column.id,exclude||'') as Row).n);
  if(column.wip_limit && count >= column.wip_limit) {if(column.limit_mode==='strict')throw new AppError(`“${column.name}” has reached its limit of ${column.wip_limit} cards.`,409);if(column.limit_mode==='warning')return `“${column.name}” is above its ${column.wip_limit}-card limit.`;}
  return undefined;
}
function safeUrl(value: unknown) {const result = str(value,'URL',2000);try{const u=new URL(result);if(!['https:','http:'].includes(u.protocol))throw new Error();return u.href;}catch{throw new AppError('Use a valid http or https link.');}}
function safeBackground(value: unknown) {const v=str(value,'Background',2000);if(/^#[\da-f]{3,8}$/i.test(v)||/^(linear|radial)-gradient\([#\w\s.,%()+-]+\)$/.test(v)||/^\/api\/uploads\/[\w-]+$/.test(v))return v;throw new AppError('Choose a color, gradient, or uploaded image.');}
function patch(table: string, id: string, fields: Row) {const entries=Object.entries(fields);if(!entries.length)return;sqlite.prepare(`UPDATE ${table} SET ${entries.map(([k])=>`${k}=?`).join(',')} WHERE id=?`).run(...entries.map(([,v])=>v),id);}
function setBoardAccess(board:Row,visibilityValue:unknown,memberValue:unknown){
  const visibility=String(visibilityValue);
  if(!['private','members','public'].includes(visibility))throw new AppError('Choose a valid board visibility.');
  const memberIds=Array.isArray(memberValue)?[...new Set(memberValue.filter((value:unknown):value is string=>typeof value==='string'))]:[];
  for(const userId of memberIds){const account=sqlite.prepare('SELECT id,active FROM users WHERE id=?').get(userId) as Row|undefined;if(!account||!account.active)throw new AppError('Choose an active account.');}
  sqlite.prepare('DELETE FROM board_members WHERE board_id=?').run(board.id);
  if(visibility==='members'){const insert=sqlite.prepare('INSERT OR IGNORE INTO board_members (board_id,user_id) VALUES (?,?)');memberIds.filter(id=>id!==board.owner_user_id).forEach(id=>insert.run(board.id,id));}
  return visibility;
}
function canWriteBoard(user:SessionUser,board:Row){return user.role==='admin'||board.owner_user_id===user.id||Boolean(sqlite.prepare('SELECT 1 FROM board_members WHERE board_id=? AND user_id=?').get(board.id,user.id));}
function canReadBoard(user:SessionUser,board:Row){return board.visibility==='public'||canWriteBoard(user,board);}
function requireBoardWrite(user:SessionUser,boardId:string){const board=row('boards',boardId);if(!canWriteBoard(user,board))throw new AppError('You do not have access to this board.',403);return board;}
export function userCanReadBoard(user:SessionUser,boardId:string){const board=sqlite.prepare('SELECT id,visibility,owner_user_id FROM boards WHERE id=?').get(boardId) as Row|undefined;return Boolean(board&&canReadBoard(user,board));}
export function getState(user?:SessionUser): AppState {
  const allWorkspaces=db.select().from(s.workspaces).all();
  const workspaceIds=new Set(user&&user.role!=='admin'?[...(sqlite.prepare('SELECT workspace_id FROM workspace_members WHERE user_id=?').all(user.id) as {workspace_id:string}[]).filter(item=>permissionsFor(user,item.workspace_id).includes('read')).map(item=>item.workspace_id),...(sqlite.prepare('SELECT DISTINCT b.workspace_id FROM board_members bm JOIN boards b ON b.id=bm.board_id WHERE bm.user_id=?').all(user.id) as {workspace_id:string}[]).map(item=>item.workspace_id)]:allWorkspaces.map(item=>item.id));
  const workspaces=allWorkspaces.filter(item=>workspaceIds.has(item.id));
  const boards=db.select().from(s.boards).all().filter(item=>workspaceIds.has(item.workspaceId)&&(!user||canReadBoard(user,{id:item.id,visibility:item.visibility,owner_user_id:item.ownerUserId})));
  const boardIds=new Set(boards.map(item=>item.id));
  const allPlacements=db.select().from(s.placements).all(),placements=allPlacements.filter(item=>boardIds.has(item.boardId));
  const cardIds=new Set(placements.map(item=>item.cardId)),cards=db.select().from(s.cards).all().filter(item=>cardIds.has(item.id));
  const boardMembers=db.select().from(s.boardMembers).all().filter(item=>boardIds.has(item.boardId));
  const base={workspaces,boards,columns:db.select().from(s.columns).all().filter(item=>boardIds.has(item.boardId)),cards,placements,tags:db.select().from(s.tags).all().filter(item=>workspaceIds.has(item.workspaceId)),cardTags:db.select().from(s.cardTags).all().filter(item=>cardIds.has(item.cardId)),links:db.select().from(s.links).all().filter(item=>cardIds.has(item.cardId)),attachments:db.select().from(s.attachments).all().filter(item=>(item.cardId&&cardIds.has(item.cardId))||(item.boardId&&boardIds.has(item.boardId))),tray:db.select().from(s.tray).all().filter(item=>placements.some(p=>p.id===item.placementId)),relations:db.select().from(s.relations).all().filter(item=>cardIds.has(item.cardId)&&cardIds.has(item.relatedCardId)),boardMembers,authenticationDisabled:isAuthenticationDisabled()};
  if(!user)return base;
  const permissionsByWorkspace=Object.fromEntries(workspaces.map(item=>[item.id,permissionsFor(user,item.id)]));
  const users=user.role==='admin'?(sqlite.prepare('SELECT id,email,name,role,active FROM users ORDER BY created_at').all() as {id:string;email:string;name:string;role:'admin'|'member';active:number}[]).map(item=>({...item,active:Boolean(item.active),memberships:(sqlite.prepare('SELECT workspace_id,permissions FROM workspace_members WHERE user_id=?').all(item.id) as {workspace_id:string;permissions:string}[]).map(member=>({workspaceId:member.workspace_id,permissions:JSON.parse(member.permissions)})),boardIds:(sqlite.prepare('SELECT board_id FROM board_members WHERE user_id=?').all(item.id) as {board_id:string}[]).map(member=>member.board_id)})):undefined;
  const memberOptions=users?.filter(item=>item.active).map(item=>({id:item.id,name:item.name,email:item.email,workspaceIds:workspaces.map(workspace=>workspace.id)}));
  return {...base,currentUser:{id:user.id,email:user.email,name:user.name,role:user.role,active:user.active},permissionsByWorkspace,users,memberOptions};
}
export function getPublicBoardState(boardId:string){
  const board=db.select().from(s.boards).all().find(item=>item.id===boardId);
  if(!board||board.visibility!=='public')throw new AppError('This board is private.',404);
  const workspace=db.select().from(s.workspaces).all().find(item=>item.id===board.workspaceId)!;
  const columns=db.select().from(s.columns).all().filter(item=>item.boardId===board.id);
  const placements=db.select().from(s.placements).all().filter(item=>item.boardId===board.id);
  const cardIds=new Set(placements.map(item=>item.cardId));
  const cards=db.select().from(s.cards).all().filter(item=>cardIds.has(item.id)&&!item.archived);
  const visibleIds=new Set(cards.map(item=>item.id));
  const tags=db.select().from(s.tags).all().filter(item=>item.workspaceId===workspace.id);
  return {workspace,board,columns,cards,placements:placements.filter(item=>visibleIds.has(item.cardId)),tags,cardTags:db.select().from(s.cardTags).all().filter(item=>visibleIds.has(item.cardId))};
}
function saveUndo(payload: Row) {const id=uid();sqlite.prepare('INSERT INTO undo_operations (id,payload) VALUES (?,?)').run(id,JSON.stringify(payload));return id;}
function relocate(p: Row, column: Row, data: Row, link=false) {
  const card=activeCard(p.card_id),board=row('boards',column.board_id);sameWorkspace(card.workspace_id,board.workspace_id);
  if(data.version!==undefined && data.version!==p.version)throw new AppError('This card moved since you last viewed it. Refresh and try again.',409);
  if(sqlite.prepare('SELECT id FROM placements WHERE card_id=? AND board_id=? AND id!=?').get(p.card_id,column.board_id,link?'':p.id))throw new AppError('This board already contains this card. Open its existing appearance instead.',409);
  const warning = p.column_id===column.id && !link ? undefined : capacity(column,link?undefined:p.id);
  const targetPosition=position(data.position,nextPosition(column.id));
  if(link){const id=uid();sqlite.prepare('INSERT INTO placements (id,card_id,board_id,column_id,position) VALUES (?,?,?,?,?)').run(id,p.card_id,column.board_id,column.id,targetPosition);return {id,warning,undoId:saveUndo({kind:'link',placementId:id,expectedVersion:1})};}
  patch('placements',p.id,{board_id:column.board_id,column_id:column.id,position:targetPosition,version:p.version+1});
  return {id:p.id,warning,undoId:saveUndo({kind:'move',placementId:p.id,previous:p,expectedVersion:p.version+1})};
}
function perform(data: Row,user?:SessionUser): Row {
  const now=Date.now();
  switch(data.action){
    case 'createWorkspace': {const id=uid(),name=str(data.name);sqlite.prepare('INSERT INTO workspaces (id,name,icon,color,created_at) VALUES (?,?,?,?,?)').run(id,name,name.charAt(0).toUpperCase(),'#8474eb',now);return{id};}
    case 'updateWorkspace': {const w=row('workspaces',data.id);patch('workspaces',w.id,{name:str(data.name)});return{id:w.id};}
    case 'createBoard': {row('workspaces',data.workspaceId);const id=uid();sqlite.prepare('INSERT INTO boards (id,workspace_id,name,description,background,visibility,owner_user_id,created_at) VALUES (?,?,?,?,?,?,?,?)').run(id,data.workspaceId,str(data.name),data.description===undefined?'':optionalText(data.description),data.background===undefined?'#f2f3f7':safeBackground(data.background),'private',user?.id||null,now);const insert=sqlite.prepare('INSERT INTO columns (id,board_id,name,position,color) VALUES (?,?,?,?,?)');['To do','In progress','Done'].forEach((name,i)=>insert.run(uid(),id,name,i,['#a1a8b8','#9579dc','#68af93'][i]));return{id};}
    case 'updateBoard': {const b=row('boards',data.id),f:Row={};if(data.name!==undefined)f.name=str(data.name);if(data.description!==undefined)f.description=optionalText(data.description);if(data.background!==undefined)f.background=safeBackground(data.background);if(data.favorite!==undefined)f.favorite=data.favorite?1:0;if(data.visibility!==undefined)f.visibility=setBoardAccess(b,data.visibility,data.memberIds);patch('boards',b.id,f);return{id:b.id};}
    case 'updateBoardAccess': {const b=row('boards',data.id),visibility=setBoardAccess(b,data.visibility,data.memberIds);patch('boards',b.id,{visibility});return{id:b.id};}
    case 'moveBoardWorkspace': {const b=row('boards',data.id),target=row('workspaces',data.workspaceId);if(b.workspace_id===target.id)return{id:b.id};const shared=sqlite.prepare('SELECT c.id,c.title FROM placements p JOIN cards c ON c.id=p.card_id WHERE p.board_id=? AND EXISTS(SELECT 1 FROM placements p2 WHERE p2.card_id=p.card_id AND p2.board_id!=?) LIMIT 1').get(b.id,b.id) as Row|undefined;if(shared)throw new AppError(`“${shared.title}” also appears on another board. Remove shared appearances before moving this board.`,409);const cardIds=(sqlite.prepare('SELECT DISTINCT card_id id FROM placements WHERE board_id=?').all(b.id) as {id:string}[]).map(item=>item.id);for(const cardId of cardIds){sqlite.prepare('DELETE FROM card_tags WHERE card_id=?').run(cardId);sqlite.prepare('DELETE FROM relations WHERE card_id=? OR related_card_id=?').run(cardId,cardId);patch('cards',cardId,{workspace_id:target.id,card_number:Number((sqlite.prepare('SELECT coalesce(max(card_number),0)+1 n FROM cards WHERE workspace_id=?').get(target.id) as Row).n)});sqlite.prepare('UPDATE tray SET workspace_id=? WHERE placement_id IN (SELECT id FROM placements WHERE card_id=?)').run(target.id,cardId);}patch('boards',b.id,{workspace_id:target.id});return{id:b.id,workspaceId:target.id};}
    case 'deleteBoard': {const b=row('boards',data.id);sqlite.prepare('DELETE FROM tray WHERE placement_id IN (SELECT id FROM placements WHERE board_id=?)').run(b.id);sqlite.prepare('DELETE FROM boards WHERE id=?').run(b.id);sqlite.prepare('UPDATE cards SET archived=1,version=version+1,updated_at=? WHERE workspace_id=? AND NOT EXISTS(SELECT 1 FROM placements WHERE card_id=cards.id)').run(now,b.workspace_id);return{};}
    case 'createColumn': {row('boards',data.boardId);const id=uid(),n=(sqlite.prepare('SELECT coalesce(max(position),-1)+1 n FROM columns WHERE board_id=?').get(data.boardId) as Row).n;sqlite.prepare('INSERT INTO columns VALUES (?,?,?,?,?,?,?)').run(id,data.boardId,str(data.name),position(data.position,n),data.wipLimit===undefined?null:limit(data.wipLimit),data.limitMode===undefined?'off':mode(data.limitMode),data.color===undefined?'#a1a8b8':safeBackground(data.color));return{id};}
    case 'updateColumn': {const c=row('columns',data.id),f:Row={};if(data.name!==undefined)f.name=str(data.name);if(data.wipLimit!==undefined)f.wip_limit=limit(data.wipLimit);if(data.limitMode!==undefined)f.limit_mode=mode(data.limitMode);if(data.position!==undefined)f.position=position(data.position,c.position);if(data.color!==undefined)f.color=safeBackground(data.color);patch('columns',c.id,f);return{id:c.id};}
    case 'deleteColumn': {const c=row('columns',data.id);if(sqlite.prepare('SELECT p.id FROM placements p JOIN cards c ON c.id=p.card_id WHERE p.column_id=? AND c.archived=0 LIMIT 1').get(c.id))throw new AppError('Move or archive the cards before deleting this column.',409);sqlite.prepare('DELETE FROM tray WHERE placement_id IN (SELECT id FROM placements WHERE column_id=?)').run(c.id);sqlite.prepare('DELETE FROM columns WHERE id=?').run(c.id);return{};}
    case 'createCard': {const c=row('columns',data.columnId),b=row('boards',c.board_id),warning=capacity(c),id=uid(),placementId=uid(),cardNumber=Number((sqlite.prepare('SELECT coalesce(max(card_number),0)+1 n FROM cards WHERE workspace_id=?').get(b.workspace_id) as Row).n);sqlite.prepare('INSERT INTO cards (id,workspace_id,card_number,title,description,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(id,b.workspace_id,cardNumber,str(data.title,'Card title'),data.description===undefined?'':optionalText(data.description),now,now);sqlite.prepare('INSERT INTO placements (id,card_id,board_id,column_id,position) VALUES (?,?,?,?,?)').run(placementId,id,b.id,c.id,position(data.position,nextPosition(c.id)));return{id,placementId,cardNumber,warning};}
    case 'updateCard': {const c=row('cards',data.id),f:Row={version:c.version+1,updated_at:now};if(data.version!==undefined && data.version!==c.version)throw new AppError('This card changed. Reload it before saving your changes.',409);if(data.title!==undefined)f.title=str(data.title,'Card title');if(data.description!==undefined)f.description=optionalText(data.description);if(data.cover!==undefined)f.cover=data.cover===null?null:safeBackground(data.cover);if(data.dueDate!==undefined){if(data.dueDate!==null && !/^\d{4}-\d{2}-\d{2}$/.test(data.dueDate))throw new AppError('Choose a valid due date.');f.due_date=data.dueDate;}if(data.scheduledStart!==undefined){if(data.scheduledStart!==null && (typeof data.scheduledStart!=='string'||!Number.isFinite(Date.parse(data.scheduledStart))))throw new AppError('Choose a valid start time.');f.scheduled_start=data.scheduledStart;}if(data.scheduledEnd!==undefined){if(data.scheduledEnd!==null && (typeof data.scheduledEnd!=='string'||!Number.isFinite(Date.parse(data.scheduledEnd))))throw new AppError('Choose a valid end time.');f.scheduled_end=data.scheduledEnd;}const nextStart=f.scheduled_start===undefined?c.scheduled_start:f.scheduled_start,nextEnd=f.scheduled_end===undefined?c.scheduled_end:f.scheduled_end;if(nextStart&&nextEnd&&Date.parse(nextEnd)<=Date.parse(nextStart))throw new AppError('End time must be after start time.');if(f.scheduled_start)f.due_date=String(f.scheduled_start).slice(0,10);if(data.dueDate===null&&data.scheduledStart===undefined){f.scheduled_start=null;f.scheduled_end=null;}if(data.archived!==undefined){f.archived=data.archived?1:0;if(c.archived&&!f.archived){const appearances=sqlite.prepare('SELECT * FROM placements WHERE card_id=?').all(c.id) as Row[];for(const p of appearances)capacity(row('columns',p.column_id),p.id);}}patch('cards',c.id,f);return{id:c.id};}
    case 'deleteCard': {const c=row('cards',data.id);patch('cards',c.id,{archived:1,version:c.version+1,updated_at:now});return{};}
    case 'removePlacement': {const p=row('placements',data.id),count=(sqlite.prepare('SELECT count(*) n FROM placements WHERE card_id=?').get(p.card_id) as Row).n;if(count===1&&!data.archiveIfLast)throw new AppError('This is the card’s last board. Archive the card everywhere instead.',409);if(count===1)patch('cards',p.card_id,{archived:1,updated_at:now});sqlite.prepare('DELETE FROM placements WHERE id=?').run(p.id);sqlite.prepare('DELETE FROM tray WHERE placement_id=?').run(p.id);return{};}
    case 'movePlacement': return relocate(row('placements',data.placementId),row('columns',data.columnId),data);
    case 'linkPlacement': return relocate(row('placements',data.placementId),row('columns',data.columnId),data,true);
    case 'addToTray': {const p=row('placements',data.placementId),c=activeCard(p.card_id),m=trayMode(data.mode||'move'),existing=sqlite.prepare('SELECT id FROM tray WHERE placement_id=?').get(p.id) as Row|undefined;if(existing){patch('tray',existing.id,{mode:m,source_version:p.version});return{id:existing.id};}const id=uid();sqlite.prepare('INSERT INTO tray VALUES (?,?,?,?,?,?)').run(id,c.workspace_id,p.id,m,p.version,now);return{id};}
    case 'updateTray': {const t=row('tray',data.id);patch('tray',t.id,{mode:trayMode(data.mode)});return{id:t.id};}
    case 'removeFromTray': {sqlite.prepare('DELETE FROM tray WHERE id=?').run(str(data.id));return{};}
    case 'dropTray': {const t=row('tray',data.id),p=row('placements',t.placement_id);if(p.version!==t.source_version)throw new AppError('This card moved after you collected it. Remove it from the tray and collect it again.',409);const result=relocate(p,row('columns',data.columnId),data,trayMode(data.mode||t.mode)==='link');sqlite.prepare('DELETE FROM tray WHERE id=?').run(t.id);return result;}
    case 'createTag': {row('workspaces',data.workspaceId);const id=uid();sqlite.prepare('INSERT INTO tags VALUES (?,?,?,?)').run(id,data.workspaceId,str(data.name,'Tag name',60),safeBackground(data.color||'#e9dff8'));return{id};}
    case 'updateTag': {const t=row('tags',data.id),f:Row={};if(data.name!==undefined)f.name=str(data.name,'Tag name',60);if(data.color!==undefined)f.color=safeBackground(data.color);patch('tags',t.id,f);return{id:t.id};}
    case 'deleteTag': {row('tags',data.id);sqlite.prepare('DELETE FROM tags WHERE id=?').run(data.id);return{};}
    case 'toggleTag': {const c=activeCard(data.cardId),t=row('tags',data.tagId);sameWorkspace(c.workspace_id,t.workspace_id);const existing=sqlite.prepare('SELECT 1 FROM card_tags WHERE card_id=? AND tag_id=?').get(c.id,t.id);if(existing)sqlite.prepare('DELETE FROM card_tags WHERE card_id=? AND tag_id=?').run(c.id,t.id);else sqlite.prepare('INSERT INTO card_tags VALUES (?,?)').run(c.id,t.id);return{};}
    case 'addLink': {const c=activeCard(data.cardId),id=uid(),url=safeUrl(data.url);sqlite.prepare('INSERT INTO links VALUES (?,?,?,?)').run(id,c.id,data.title?str(data.title,'Link title'):new URL(url).hostname,url);return{id};}
    case 'deleteLink': {row('links',data.id);sqlite.prepare('DELETE FROM links WHERE id=?').run(data.id);return{};}
    case 'addRelation': {const c=activeCard(data.cardId),other=activeCard(data.relatedCardId);sameWorkspace(c.workspace_id,other.workspace_id);if(c.id===other.id)throw new AppError('Choose a different card.');const existing=sqlite.prepare('SELECT id FROM relations WHERE (card_id=? AND related_card_id=?) OR (card_id=? AND related_card_id=?)').get(c.id,other.id,other.id,c.id) as Row|undefined;if(existing)return{id:existing.id};const id=uid();sqlite.prepare('INSERT INTO relations VALUES (?,?,?)').run(id,c.id,other.id);return{id};}
    case 'deleteRelation': {row('relations',data.id);sqlite.prepare('DELETE FROM relations WHERE id=?').run(data.id);return{};}
    case 'deleteAttachment': {const a=row('attachments',data.id);sqlite.prepare('UPDATE cards SET cover=NULL WHERE cover=?').run(a.url);sqlite.prepare("UPDATE boards SET background='#f2f3f7' WHERE background=?").run(a.url);sqlite.prepare('DELETE FROM attachments WHERE id=?').run(a.id);return{};}
    case 'undo': {const op=row('undo_operations',data.id);if(op.used)throw new AppError('This change has already been undone.',409);const payload=JSON.parse(op.payload),p=row('placements',payload.placementId);activeCard(p.card_id);if(p.version!==payload.expectedVersion)throw new AppError('The card moved again, so this change cannot be undone.',409);if(payload.kind==='link'){sqlite.prepare('DELETE FROM placements WHERE id=?').run(p.id);sqlite.prepare('DELETE FROM tray WHERE placement_id=?').run(p.id);}else{const prev=payload.previous;relocate(p,row('columns',prev.column_id),{position:prev.position});}patch('undo_operations',op.id,{used:1});return{};}
    default: throw new AppError('Unknown action.');
  }
}
function workspaceForAction(data:Row):string {
  const action=String(data.action||'');
  if(['createBoard','createTag'].includes(action))return row('workspaces',data.workspaceId).id;
  if(['updateWorkspace'].includes(action))return row('workspaces',data.id).id;
  if(['updateBoard','updateBoardAccess','deleteBoard','moveBoardWorkspace'].includes(action))return row('boards',data.id).workspace_id;
  if(action==='createColumn')return row('boards',data.boardId).workspace_id;
  if(['updateColumn','deleteColumn'].includes(action))return row('boards',row('columns',data.id).board_id).workspace_id;
  if(action==='createCard')return row('boards',row('columns',data.columnId).board_id).workspace_id;
  if(['updateCard','deleteCard'].includes(action))return row('cards',data.id).workspace_id;
  if(['movePlacement','linkPlacement','addToTray'].includes(action))return row('cards',row('placements',data.placementId).card_id).workspace_id;
  if(action==='removePlacement')return row('cards',row('placements',data.id).card_id).workspace_id;
  if(['updateTray','removeFromTray','dropTray'].includes(action))return row('tray',data.id).workspace_id;
  if(['updateTag','deleteTag'].includes(action))return row('tags',data.id).workspace_id;
  if(['toggleTag','addLink','addRelation'].includes(action))return row('cards',data.cardId).workspace_id;
  if(action==='deleteLink')return row('cards',row('links',data.id).card_id).workspace_id;
  if(action==='deleteRelation')return row('cards',row('relations',data.id).card_id).workspace_id;
  if(action==='deleteAttachment'){const attachment=row('attachments',data.id);return attachment.card_id?row('cards',attachment.card_id).workspace_id:row('boards',attachment.board_id).workspace_id;}
  if(action==='undo'){const op=row('undo_operations',data.id),payload=JSON.parse(op.payload),placement=row('placements',payload.placementId);return row('cards',placement.card_id).workspace_id;}
  throw new AppError('Unknown action.');
}
function boardIdsForAction(data:Row):string[]{
  const action=String(data.action||'');
  if(['updateBoard','updateBoardAccess','deleteBoard','moveBoardWorkspace'].includes(action))return[row('boards',data.id).id];
  if(action==='createColumn')return[row('boards',data.boardId).id];
  if(['updateColumn','deleteColumn'].includes(action))return[row('columns',data.id).board_id];
  if(action==='createCard')return[row('columns',data.columnId).board_id];
  if(['updateCard','deleteCard','toggleTag','addLink','addRelation'].includes(action))return(sqlite.prepare('SELECT board_id FROM placements WHERE card_id=?').all(data.id||data.cardId) as {board_id:string}[]).map(item=>item.board_id);
  if(['movePlacement','linkPlacement'].includes(action))return[ row('placements',data.placementId).board_id,row('columns',data.columnId).board_id ];
  if(['addToTray'].includes(action))return[row('placements',data.placementId).board_id];
  if(action==='removePlacement')return[row('placements',data.id).board_id];
  if(action==='dropTray')return[row('placements',row('tray',data.id).placement_id).board_id,row('columns',data.columnId).board_id];
  if(['updateTray','removeFromTray'].includes(action))return[row('placements',row('tray',data.id).placement_id).board_id];
  if(action==='deleteLink')return(sqlite.prepare('SELECT board_id FROM placements WHERE card_id=?').all(row('links',data.id).card_id) as {board_id:string}[]).map(item=>item.board_id);
  if(action==='deleteRelation')return(sqlite.prepare('SELECT board_id FROM placements WHERE card_id=?').all(row('relations',data.id).card_id) as {board_id:string}[]).map(item=>item.board_id);
  if(action==='deleteAttachment'){const attachment=row('attachments',data.id);return attachment.board_id?[attachment.board_id]:(sqlite.prepare('SELECT board_id FROM placements WHERE card_id=?').all(attachment.card_id) as {board_id:string}[]).map(item=>item.board_id);}
  if(action==='undo'){const payload=JSON.parse(row('undo_operations',data.id).payload);return[row('placements',payload.placementId).board_id];}
  return[];
}
function authorizeMutation(data:Row,user?:SessionUser){
  if(!user)return;
  const action=String(data.action||'');
  if(action==='createWorkspace'){if(user.role!=='admin')throw new AppError('Only an admin can create workspaces.',403);return;}
  const workspaceId=workspaceForAction(data);
  const boardIds=[...new Set(boardIdsForAction(data))];
  if(boardIds.length&&!boardIds.some(boardId=>canWriteBoard(user,row('boards',boardId))))throw new AppError('You do not have access to this board.',403);
  if(['movePlacement','linkPlacement','dropTray'].includes(action))boardIds.forEach(boardId=>requireBoardWrite(user,boardId));
  if(action==='updateBoardAccess'||(action==='updateBoard'&&data.visibility!==undefined)){const board=row('boards',data.id);if(user.role!=='admin'&&board.owner_user_id!==user.id)throw new AppError('Only the board owner or an admin can change access.',403);}
  const permission:Permission = ['createBoard'].includes(action)?'createBoard':
    ['createColumn','updateColumn','deleteColumn'].includes(action)?'createColumn':
    ['createCard'].includes(action)?'createCard':
    ['movePlacement','linkPlacement','addToTray','updateTray','removeFromTray','dropTray','removePlacement','undo'].includes(action)?'moveCard':
    ['updateWorkspace','updateBoard','updateBoardAccess','deleteBoard','moveBoardWorkspace'].includes(action)?'manageWorkspace':
    ['deleteAttachment'].includes(action)?'uploadFiles':'editCard';
  requirePermission(user,workspaceId,permission);
  if(action==='moveBoardWorkspace')requirePermission(user,String(data.workspaceId),'manageWorkspace');
}
export function mutate(data: Row,user?:SessionUser) {
  return sqlite.transaction(() => {
    authorizeMutation(data,user);
    if(data.operationId){const id=str(data.operationId,'Operation ID',100),existing=sqlite.prepare('SELECT result FROM operations WHERE id=?').get(id) as Row|undefined;if(existing)return{ok:true,...JSON.parse(existing.result),state:getState(user)};}
    const result=perform(data,user);
    if(data.operationId)sqlite.prepare('INSERT INTO operations VALUES (?,?,?)').run(data.operationId,JSON.stringify(result),Date.now());
    return{ok:true,...result,state:getState(user)};
  }).immediate();
}
export function addAttachment(input: {id:string;cardId:string|null;boardId:string|null;name:string;mimeType:string;size:number},user?:SessionUser) {
 return sqlite.transaction(()=>{if(Boolean(input.cardId)===Boolean(input.boardId))throw new AppError('Choose one card or board for this attachment.');const workspaceId=input.cardId?activeCard(input.cardId).workspace_id:row('boards',input.boardId).workspace_id;if(user){requirePermission(user,workspaceId,'uploadFiles');const boardIds=input.boardId?[input.boardId]:(sqlite.prepare('SELECT board_id FROM placements WHERE card_id=?').all(input.cardId) as {board_id:string}[]).map(item=>item.board_id);if(!boardIds.some(boardId=>canWriteBoard(user,row('boards',boardId))))throw new AppError('You do not have access to this board.',403);}const url=`/api/uploads/${input.id}`;sqlite.prepare('INSERT INTO attachments VALUES (?,?,?,?,?,?,?,?)').run(input.id,input.cardId,input.boardId,input.name,url,input.mimeType,input.size,Date.now());return{attachment:db.select().from(s.attachments).all().find(a=>a.id===input.id),state:getState(user)};}).immediate();
}
