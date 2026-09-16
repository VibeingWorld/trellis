import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { sqlite } from '@/db';
import { AppError } from '@/lib/errors';

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = 'cove_session';
export const PERMISSIONS = ['read','createBoard','createColumn','createCard','editCard','moveCard','uploadFiles','manageWorkspace'] as const;
export type Permission = typeof PERMISSIONS[number];
export type SessionUser = { id:string; email:string; name:string; role:'admin'|'member'; active:boolean };
type UserRow = {id:string;email:string;name:string;role:'admin'|'member';active:number;password_hash:string;password_salt:string};

const emailPattern = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const tokenHash = (token:string) => createHash('sha256').update(token).digest('hex');
const normalizeEmail = (email:unknown) => {
  if(typeof email !== 'string' || !emailPattern.test(email.trim().toLowerCase())) throw new AppError('Enter a valid email address.');
  return email.trim().toLowerCase();
};
const validatePassword = (password:unknown) => {
  if(typeof password !== 'string' || password.length < 12 || password.length > 200) throw new AppError('Use a password with at least 12 characters.');
  return password;
};
async function hashPassword(password:string,salt:string) { return (await scrypt(password,salt,64) as Buffer).toString('hex'); }

export function hasUsers() { return Number((sqlite.prepare('SELECT count(*) n FROM users').get() as {n:number}).n)>0; }
export function hasAdmin() { return Number((sqlite.prepare("SELECT count(*) n FROM users WHERE role='admin' AND active=1").get() as {n:number}).n)>0; }

export async function createFirstAdmin(input:{email:unknown;name:unknown;password:unknown}) {
  if(hasAdmin()) throw new AppError('An administrator already exists.',409);
  const email=normalizeEmail(input.email), password=validatePassword(input.password);
  if(typeof input.name!=='string'||!input.name.trim()||input.name.length>100)throw new AppError('Enter your name.');const name=input.name.trim();
  const id=randomUUID(),salt=randomBytes(24).toString('hex'),hash=await hashPassword(password,salt),now=Date.now();
  sqlite.transaction(()=>{if(hasAdmin())throw new AppError('An administrator already exists.',409);sqlite.prepare("INSERT INTO users (id,email,name,password_hash,password_salt,role,active,created_at,updated_at) VALUES (?,?,?,?,?,'admin',1,?,?)").run(id,email,name,hash,salt,now,now);}).immediate();
  return {id,email,name,role:'admin' as const,active:true};
}

export async function verifyLogin(emailInput:unknown,passwordInput:unknown):Promise<SessionUser> {
  const email=normalizeEmail(emailInput), password=typeof passwordInput==='string'?passwordInput:'';
  const user=sqlite.prepare('SELECT * FROM users WHERE email=?').get(email) as UserRow|undefined;
  // Keep the expensive path for unknown accounts to reduce account-enumeration timing differences.
  const salt=user?.password_salt||'000000000000000000000000000000000000000000000000';
  const attempted=Buffer.from(await hashPassword(password,salt),'hex');
  const expected=Buffer.from(user?.password_hash||'0'.repeat(128),'hex');
  if(!user||attempted.length!==expected.length||!timingSafeEqual(attempted,expected)||!user.active)throw new AppError('Email or password is incorrect.',401);
  return {id:user.id,email:user.email,name:user.name,role:user.role,active:Boolean(user.active)};
}

export function createSession(userId:string) {
  const token=randomBytes(32).toString('base64url'),now=Date.now(),expiresAt=now+30*24*60*60*1000;
  sqlite.prepare('DELETE FROM sessions WHERE expires_at<?').run(now);
  sqlite.prepare('INSERT INTO sessions VALUES (?,?,?,?,?)').run(randomUUID(),userId,tokenHash(token),expiresAt,now);
  return {token,expiresAt};
}
export function deleteSession(token:string|undefined) { if(token)sqlite.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(token)); }
export function isAuthenticationDisabled(){return process.env.COVE_DISABLE_AUTH==='1';}
export function getSessionUser(token:string|undefined):SessionUser|null {
  if(isAuthenticationDisabled()){
    const admin=sqlite.prepare("SELECT id,email,name,role,active FROM users WHERE role='admin' AND active=1 ORDER BY created_at LIMIT 1").get() as Omit<SessionUser,'active'>&{active:number}|undefined;
    if(admin)return{...admin,active:true};
  }
  if(!token)return null;
  const user=sqlite.prepare(`SELECT u.id,u.email,u.name,u.role,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`).get(tokenHash(token),Date.now()) as Omit<SessionUser,'active'>&{active:number}|undefined;
  return user&&user.active?{...user,active:true}:null;
}
export function permissionsFor(user:SessionUser,workspaceId:string):Permission[] {
  if(user.role==='admin')return [...PERMISSIONS];
  const membership=sqlite.prepare('SELECT permissions FROM workspace_members WHERE user_id=? AND workspace_id=?').get(user.id,workspaceId) as {permissions:string}|undefined;
  if(!membership)return [];
  try{return (JSON.parse(membership.permissions) as string[]).filter((item):item is Permission=>PERMISSIONS.includes(item as Permission));}catch{return [];}
}
export function requirePermission(user:SessionUser|undefined,workspaceId:string,permission:Permission) {
  if(!user)throw new AppError('Please sign in.',401);
  if(user.role!=='admin'&&!permissionsFor(user,workspaceId).includes(permission))throw new AppError('You do not have permission to do that.',403);
}
export function publicUser(user:SessionUser){return{id:user.id,email:user.email,name:user.name,role:user.role};}
export async function passwordRecord(passwordInput:unknown){const password=validatePassword(passwordInput),salt=randomBytes(24).toString('hex');return{salt,hash:await hashPassword(password,salt)};}
export function cleanEmail(value:unknown){return normalizeEmail(value);}

function requireAdmin(actor:SessionUser){if(actor.role!=='admin')throw new AppError('Only an admin can manage accounts.',403);}
function cleanName(value:unknown){if(typeof value!=='string'||!value.trim()||value.length>100)throw new AppError('Enter a name.');return value.trim();}
function cleanRole(value:unknown):'admin'|'member'{if(value!=='admin'&&value!=='member')throw new AppError('Choose a valid role.');return value;}
function saveMemberships(userId:string,value:unknown){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new AppError('Invalid workspace permissions.');
  sqlite.prepare('DELETE FROM workspace_members WHERE user_id=?').run(userId);
  const insert=sqlite.prepare('INSERT INTO workspace_members (user_id,workspace_id,permissions) VALUES (?,?,?)');
  for(const [workspaceId,raw] of Object.entries(value as Record<string,unknown>)){
    if(!sqlite.prepare('SELECT 1 FROM workspaces WHERE id=?').get(workspaceId))continue;
    const permissions=Array.isArray(raw)?raw.filter((item):item is Permission=>typeof item==='string'&&PERMISSIONS.includes(item as Permission)):[];
    if(permissions.length)insert.run(userId,workspaceId,JSON.stringify([...new Set(permissions)]));
  }
}
function saveBoardMemberships(userId:string,value:unknown){
  if(!Array.isArray(value))throw new AppError('Invalid board access.');
  const boardIds=[...new Set(value.filter((item):item is string=>typeof item==='string'))];
  sqlite.prepare('DELETE FROM board_members WHERE user_id=?').run(userId);
  const insert=sqlite.prepare('INSERT INTO board_members (board_id,user_id) VALUES (?,?)');
  for(const boardId of boardIds){
    const board=sqlite.prepare('SELECT id,visibility,owner_user_id FROM boards WHERE id=?').get(boardId) as {id:string;visibility:string;owner_user_id:string|null}|undefined;
    if(!board||board.owner_user_id===userId)continue;
    insert.run(board.id,userId);
    if(board.visibility==='private')sqlite.prepare("UPDATE boards SET visibility='members' WHERE id=?").run(board.id);
  }
}
export async function createManagedUser(input:Record<string,unknown>,actor:SessionUser){
  requireAdmin(actor);const email=normalizeEmail(input.email),name=cleanName(input.name),role=cleanRole(input.role||'member');
  if(sqlite.prepare('SELECT 1 FROM users WHERE email=?').get(email))throw new AppError('An account already uses that email.',409);
  const password=await passwordRecord(input.password),id=randomUUID(),now=Date.now();
  sqlite.transaction(()=>{sqlite.prepare('INSERT INTO users (id,email,name,password_hash,password_salt,role,active,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?)').run(id,email,name,password.hash,password.salt,role,now,now);saveMemberships(id,input.permissionsByWorkspace||{});if(role==='member')saveBoardMemberships(id,input.boardIds||[]);}).immediate();
  return{id};
}
export async function updateManagedUser(input:Record<string,unknown>,actor:SessionUser){
  requireAdmin(actor);if(typeof input.id!=='string')throw new AppError('Choose an account.');const existing=sqlite.prepare('SELECT id,role,active FROM users WHERE id=?').get(input.id) as {id:string;role:string;active:number}|undefined;if(!existing)throw new AppError('Account not found.',404);
  const role=cleanRole(input.role),active=input.active!==false,name=cleanName(input.name),email=normalizeEmail(input.email);
  if((existing.role==='admin'&&(role!=='admin'||!active))&&Number((sqlite.prepare("SELECT count(*) n FROM users WHERE role='admin' AND active=1").get() as {n:number}).n)<=1)throw new AppError('Keep at least one active admin account.',409);
  const password=input.password?await passwordRecord(input.password):null,now=Date.now();
  sqlite.transaction(()=>{if(password)sqlite.prepare('UPDATE users SET email=?,name=?,role=?,active=?,password_hash=?,password_salt=?,updated_at=? WHERE id=?').run(email,name,role,active?1:0,password.hash,password.salt,now,input.id);else sqlite.prepare('UPDATE users SET email=?,name=?,role=?,active=?,updated_at=? WHERE id=?').run(email,name,role,active?1:0,now,input.id);if(role==='member'){saveMemberships(input.id as string,input.permissionsByWorkspace||{});saveBoardMemberships(input.id as string,input.boardIds||[]);}else{sqlite.prepare('DELETE FROM workspace_members WHERE user_id=?').run(input.id);sqlite.prepare('DELETE FROM board_members WHERE user_id=?').run(input.id);}if(!active)sqlite.prepare('DELETE FROM sessions WHERE user_id=?').run(input.id);}).immediate();
  return{id:input.id};
}
