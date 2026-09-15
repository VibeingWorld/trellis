import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { dataDirectory } from '@/db';
import { addAttachment, AppError } from '@/lib/store';
export const runtime = 'nodejs';
const MAX_SIZE = 20 * 1024 * 1024;
function fileType(bytes: Buffer) {
  if(bytes.length>=24 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(bytes.length>=4 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255)return 'image/jpeg';
  if(bytes.length>=12 && bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
  if(bytes.length>=10 && ['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6)))return 'image/gif';
  if(bytes.length>=5 && bytes.toString('ascii',0,5)==='%PDF-')return 'application/pdf';
  return null;
}
export async function POST(request: NextRequest) {
  let filePath:string|undefined;
  try {
    const origin=request.headers.get('origin'),host=request.headers.get('host');if(origin&&(!host||new URL(origin).host!==host))throw new AppError('Request origin is not allowed.',403);
    if(Number(request.headers.get('content-length')||0)>MAX_SIZE+65536)throw new AppError('Attachments must be smaller than 20 MB.',413);
    const form=await request.formData(),file=form.get('file');
    if(!(file instanceof File))throw new AppError('Choose an image or PDF to upload.');
    if(file.size>MAX_SIZE)throw new AppError('Attachments must be smaller than 20 MB.',413);
    const bytes=Buffer.from(await file.arrayBuffer()),mimeType=fileType(bytes);
    if(!mimeType)throw new AppError('Upload a PNG, JPEG, WebP, GIF, or PDF file.');
    const cardId=form.get('cardId'),boardId=form.get('boardId');
    if((cardId && typeof cardId!=='string')||(boardId&&typeof boardId!=='string'))throw new AppError('Invalid image destination.');
    if(mimeType==='application/pdf' && !cardId)throw new AppError('PDFs can be attached to cards, but cannot be board backgrounds.');
    const id=randomUUID(),folder=path.join(dataDirectory,'uploads');await fs.mkdir(folder,{recursive:true});filePath=path.join(folder,id);await fs.writeFile(filePath,bytes,{flag:'wx'});
    return NextResponse.json(addAttachment({id,cardId:typeof cardId==='string'?cardId:null,boardId:typeof boardId==='string'?boardId:null,name:file.name.replace(/[\u0000-\u001f]/g,'').slice(0,255)||'Attachment',mimeType,size:file.size}));
  }catch(error){if(filePath)await fs.unlink(filePath).catch(()=>{});if(error instanceof AppError)return NextResponse.json({error:error.message},{status:error.status});console.error(error);return NextResponse.json({error:'This attachment could not be uploaded.'},{status:500});}
}
