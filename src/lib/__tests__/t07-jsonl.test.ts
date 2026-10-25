// §7 #7 — JSONL reader skips bad lines, warns with line number, never rewrites the file.
import fs from "fs";
import { historyFile, readSettingsHistory } from "@/lib/server-store";
import { tmpDataDir } from "@/lib/test-helpers";

test("#7 garbage middle line → other entries read, warning logged, file untouched", () => {
  tmpDataDir();
  const ok = (p: number) => JSON.stringify({ v: 1, kind: "diff", effectiveFrom: "2026-10-01T10:00:00+02:00", changedAt: "2026-10-01T10:00:00+02:00", source: "web", appVersion: "1.1.57", changes: { preferredBottleWaterMl: { old: 90, new: p } } });
  const content = `${ok(120)}\n{"v":1,"effec\u0000garbage\n${ok(150)}\n`;
  fs.writeFileSync(historyFile(), content);
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  const entries = readSettingsHistory();
  expect(entries.map((e) => e.changes.preferredBottleWaterMl!.new)).toEqual([120, 150]);
  expect(warn).toHaveBeenCalledTimes(1);
  expect(String(warn.mock.calls[0][0])).toMatch(/line 2/);
  expect(fs.readFileSync(historyFile(), "utf8")).toBe(content);
  warn.mockRestore();
});
