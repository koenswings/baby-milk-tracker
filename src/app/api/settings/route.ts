import { NextRequest, NextResponse } from "next/server";
import { readSettings, writeSettings } from "@/lib/server-store";
import { sourceFromHeaders } from "@/lib/request-source";
import { Settings } from "@/types";
import { pickPersisted } from "@/lib/settingsHistory";

export async function GET() {
  return NextResponse.json(readSettings());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  // Only allowlisted keys are persisted; unknown keys and targetMlPerDay are dropped silently.
  const settings = pickPersisted(body) as Settings;
  writeSettings(settings, sourceFromHeaders(req.headers));
  return NextResponse.json({ ok: true });
}
