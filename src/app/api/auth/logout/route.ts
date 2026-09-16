import { NextRequest, NextResponse } from 'next/server';
import { deleteSession, SESSION_COOKIE } from '@/lib/auth';
export const runtime='nodejs';
export async function POST(request:NextRequest){deleteSession(request.cookies.get(SESSION_COOKIE)?.value);const response=NextResponse.json({ok:true});response.cookies.set(SESSION_COOKIE,'',{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0});return response;}
