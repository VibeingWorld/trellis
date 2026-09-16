import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '@/lib/store';
import { createFirstAdmin, createSession, SESSION_COOKIE } from '@/lib/auth';
export const runtime='nodejs';
export async function POST(request:NextRequest){try{const origin=request.headers.get('origin'),host=request.headers.get('host');if(origin&&(!host||new URL(origin).host!==host))throw new AppError('Request origin is not allowed.',403);const body=await request.json();const user=await createFirstAdmin(body);const session=createSession(user.id);const response=NextResponse.json({ok:true});response.cookies.set(SESSION_COOKIE,session.token,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/',expires:new Date(session.expiresAt)});return response;}catch(error){if(error instanceof AppError)return NextResponse.json({error:error.message},{status:error.status});return NextResponse.json({error:'Setup could not be completed.'},{status:500});}}
