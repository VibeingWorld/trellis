import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasAdmin, publicUser, SESSION_COOKIE } from '@/lib/auth';
export const runtime='nodejs';
export async function GET(request:NextRequest){const user=getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);return NextResponse.json({setupRequired:!hasAdmin(),user:user?publicUser(user):null},{headers:{'Cache-Control':'no-store'}});}
