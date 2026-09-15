import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { sqlite, dataDirectory } from '@/db';
export const runtime = 'nodejs';
export async function GET(_request:NextRequest,context:{params:Promise<{id:string}>}) {
 const {id}=await context.params;
 if(!/^[\w-]+$/.test(id))return NextResponse.json({error:'Image not found.'},{status:404});
 const attachment=sqlite.prepare('SELECT mime_type,name FROM attachments WHERE id=?').get(id) as {mime_type:string;name:string}|undefined;
 if(!attachment)return NextResponse.json({error:'Attachment not found.'},{status:404});
 try{const data=await fs.readFile(path.join(dataDirectory,'uploads',id));const safeName=attachment.name.replace(/[^\x20-\x7E]|["\\]/g,'_').slice(0,180)||'attachment';return new NextResponse(new Uint8Array(data),{headers:{'Content-Type':attachment.mime_type,'Content-Length':String(data.length),'Content-Disposition':`inline; filename="${safeName}"`,'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});}catch{return NextResponse.json({error:'Attachment file not found.'},{status:404});}
}
