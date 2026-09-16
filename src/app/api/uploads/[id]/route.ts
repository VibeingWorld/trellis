import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { sqlite, dataDirectory } from '@/db';
import { getSessionUser, requirePermission, SESSION_COOKIE } from '@/lib/auth';
export const runtime = 'nodejs';
export async function GET(_request:NextRequest,context:{params:Promise<{id:string}>}) {
 const {id}=await context.params;
 const user=getSessionUser(_request.cookies.get(SESSION_COOKIE)?.value);if(!user)return NextResponse.json({error:'Please sign in.'},{status:401});
 if(!/^[\w-]+$/.test(id))return NextResponse.json({error:'Image not found.'},{status:404});
 const attachment=sqlite.prepare('SELECT a.mime_type,a.name,coalesce(c.workspace_id,b.workspace_id) workspace_id FROM attachments a LEFT JOIN cards c ON c.id=a.card_id LEFT JOIN boards b ON b.id=a.board_id WHERE a.id=?').get(id) as {mime_type:string;name:string;workspace_id:string}|undefined;
 if(!attachment)return NextResponse.json({error:'Attachment not found.'},{status:404});
 try{requirePermission(user,attachment.workspace_id,'read');}catch{return NextResponse.json({error:'Attachment not found.'},{status:404});}
 try{const data=await fs.readFile(path.join(dataDirectory,'uploads',id));const safeName=attachment.name.replace(/[^\x20-\x7E]|["\\]/g,'_').slice(0,180)||'attachment',disposition=attachment.mime_type.startsWith('image/')||attachment.mime_type==='application/pdf'?'inline':'attachment';return new NextResponse(new Uint8Array(data),{headers:{'Content-Type':attachment.mime_type,'Content-Length':String(data.length),'Content-Disposition':`${disposition}; filename="${safeName}"`,'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});}catch{return NextResponse.json({error:'Attachment file not found.'},{status:404});}
}
