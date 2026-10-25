import { NextResponse } from "next/server";
import { readSettingsHistorySorted } from "@/lib/server-store";

export const dynamic = "force-dynamic";

/** Read-only settings history, sorted by effectiveFrom. */
export async function GET() {
  return NextResponse.json(readSettingsHistorySorted());
}
