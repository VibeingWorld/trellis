import { NextRequest, NextResponse } from 'next/server';
import { AppError, mutate } from '@/lib/store';
import { dataDirectory, sqlite } from '@/db';
import fs from 'node:fs/promises';
import path from 'node:path';
import { syncCardToGoogle } from '@/lib/google-calendar';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    const origin=request.headers.get('origin'),host=request.headers.get('host');if(origin && (!host || new URL(origin).host!==host))return NextResponse.json({error:'Request origin is not allowed.'},{status:403});
    const data=await request.json();if(!data||typeof data!=='object'||Array.isArray(data))throw new AppError('Invalid request.');
    const storedFile=data.action==='deleteAttachment'&&typeof data.id==='string'?sqlite.prepare('SELECT id FROM attachments WHERE id=?').get(data.id) as {id:string}|undefined:undefined;
    const result=mutate(data);
    let calendarWarning: string | undefined;
    if(data.action==='updateCard' && typeof data.id==='string') {
      try { await syncCardToGoogle(data.id, request.nextUrl.origin); }
      catch (syncError) { console.error(syncError); calendarWarning=syncError instanceof Error ? syncError.message : 'Google Calendar sync failed.'; }
    }
    if(storedFile)await fs.unlink(path.join(dataDirectory,'uploads',storedFile.id)).catch(()=>{});
    return NextResponse.json(calendarWarning ? {...result,calendarWarning} : result);
  } catch(error){if(error instanceof AppError)return NextResponse.json({error:error.message},{status:error.status});if(error instanceof SyntaxError)return NextResponse.json({error:'Invalid request.'},{status:400});console.error(error);return NextResponse.json({error:'Unable to save this change. Please try again.'},{status:500});}
}
