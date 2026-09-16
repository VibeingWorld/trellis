import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { sqlite, dataDirectory } from '@/db';
import { getSessionUser, SESSION_COOKIE } from '@/lib/auth';
import { userCanReadBoard } from '@/lib/store';
export const runtime = 'nodejs';
export async function GET(_request:NextRequest,context:{params:Promise<{id:string}>}) {
 const {id}=await context.params;
 if(!/^[\w-]+$/.test(id))return NextResponse.json({error:'Image not found.'},{status:404});
 const attachment=sqlite.prepare('SELECT a.mime_type,a.name,a.card_id,a.board_id,coalesce(c.workspace_id,b.workspace_id) workspace_id,b.visibility board_visibility FROM attachments a LEFT JOIN cards c ON c.id=a.card_id LEFT JOIN boards b ON b.id=a.board_id WHERE a.id=?').get(id) as {mime_type:string;name:string;card_id:string|null;board_id:string|null;workspace_id:string;board_visibility:string|null}|undefined;
 if(!attachment)return NextResponse.json({error:'Attachment not found.'},{status:404});
 const user=getSessionUser(_request.cookies.get(SESSION_COOKIE)?.value);
 if(!user){if(attachment.board_visibility!=='public'||!attachment.mime_type.startsWith('image/'))return NextResponse.json({error:'Attachment not found.'},{status:404});}
 else{const boardIds=attachment.board_id?[attachment.board_id]:(sqlite.prepare('SELECT board_id FROM placements WHERE card_id=?').all(attachment.card_id) as {board_id:string}[]).map(item=>item.board_id);if(!boardIds.some(boardId=>userCanReadBoard(user,boardId)))return NextResponse.json({error:'Attachment not found.'},{status:404});}
 try{const data=await fs.readFile(path.join(dataDirectory,'uploads',id));const safeName=attachment.name.replace(/[^\x20-\x7E]|["\\]/g,'_').slice(0,180)||'attachment',disposition=attachment.mime_type.startsWith('image/')||attachment.mime_type==='application/pdf'?'inline':'attachment';return new NextResponse(new Uint8Array(data),{headers:{'Content-Type':attachment.mime_type,'Content-Length':String(data.length),'Content-Disposition':`${disposition}; filename="${safeName}"`,'Cache-Control':user?'private, max-age=3600':'public, max-age=3600','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});}catch{return NextResponse.json({error:'Attachment file not found.'},{status:404});}
}
