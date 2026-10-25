// §7 #11 — GET /api/settings/history returns parsed entries, sorted.
import fs from "fs";
import { GET } from "@/app/api/settings/history/route";
import { historyFile } from "@/lib/server-store";
import { tmpDataDir } from "@/lib/test-helpers";

test("#11 returns parsed, sorted entries; skips bad lines", async () => {
  tmpDataDir();
  const mk = (at: string, n: number) => JSON.stringify({ v: 1, kind: "diff", effectiveFrom: at, changedAt: at, source: "web", appVersion: "1.1.57", changes: { preferredBottleWaterMl: { new: n } } });
  fs.writeFileSync(historyFile(), [mk("2026-10-20T00:00:00Z", 2), "garbage", mk("2026-10-10T00:00:00Z", 1)].join("\n") + "\n");
  jest.spyOn(console, "warn").mockImplementation(() => {});
  const res = await GET();
  const body = await res.json();
  expect(body.map((e: { changes: { preferredBottleWaterMl: { new: number } } }) => e.changes.preferredBottleWaterMl.new)).toEqual([1, 2]);
});

test("#11 empty when no history", async () => {
  tmpDataDir();
  expect(await (await GET()).json()).toEqual([]);
});
