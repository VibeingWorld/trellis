import { NextRequest, NextResponse } from 'next/server';
import { getState } from '@/lib/store';
import { getSessionUser, SESSION_COOKIE } from '@/lib/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request:NextRequest) {const user=getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);if(!user)return NextResponse.json({error:'Please sign in.'},{status:401});return NextResponse.json(getState(user),{headers:{'Cache-Control':'no-store'}});}
