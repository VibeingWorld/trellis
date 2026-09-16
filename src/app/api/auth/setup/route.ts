import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({ error: "The first administrator must be created directly on the server." }, { status: 403 });
}
