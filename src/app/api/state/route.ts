import { NextResponse } from 'next/server';
import { getState } from '@/lib/store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {return NextResponse.json(getState(),{headers:{'Cache-Control':'no-store'}});}
