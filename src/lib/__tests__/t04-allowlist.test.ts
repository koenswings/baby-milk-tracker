// §7 #4 — LOGGED_KEYS allowlist + diff in writeSettings, history first.
import fs from "fs";
import { DEFAULT_SETTINGS, historyFile, writeSettings } from "@/lib/server-store";
import { readLines, tmpDataDir } from "@/lib/test-helpers";
import { Settings } from "@/types";

beforeEach(() => { tmpDataDir(); writeSettings({ ...DEFAULT_SETTINGS }, "web"); });
afterEach(() => jest.restoreAllMocks());

test("#4 changing one key → exactly one line with correct old/new, v:1", () => {
  const n0 = readLines(historyFile()).length;
  writeSettings({ ...DEFAULT_SETTINGS, preferredBottleWaterMl: 120 }, "web");
  const lines = readLines(historyFile()).slice(n0);
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatchObject({ v: 1, kind: "diff", source: "web", appVersion: "1.1.57",
    changes: { preferredBottleWaterMl: { old: 90, new: 120 } } });
  expect(Object.keys(lines[0].changes as object)).toEqual(["preferredBottleWaterMl"]);
  expect(lines[0].effectiveFrom).toBe(lines[0].changedAt);
  expect(String(lines[0].changedAt)).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
});

test("#4 no change → no line; display-only change → no line", () => {
  const n0 = readLines(historyFile()).length;
  writeSettings({ ...DEFAULT_SETTINGS }, "web");
  writeSettings({ ...DEFAULT_SETTINGS, timeFormat: "12h", feedingTimelineView: "cards" }, "web");
  expect(readLines(historyFile())).toHaveLength(n0);
});

test("#4 POST containing targetMlPerDay (and legacy keys) → absent from history", () => {
  const body = { ...DEFAULT_SETTINGS, mlPerKgPerDay: 160, targetMlPerDay: 940, standardBottleVolume: 120 } as unknown as Settings;
  writeSettings(body, "web");
  const raw = fs.readFileSync(historyFile(), "utf8");
  expect(raw).not.toMatch(/targetMlPerDay/);
  expect(raw).not.toMatch(/standardBottleVolume/);
});

test("#4 history is appended before settings.json is replaced", () => {
  const order: string[] = [];
  const realOpen = fs.openSync;
  jest.spyOn(fs, "openSync").mockImplementation(((p: fs.PathLike, f: fs.OpenMode) => {
    if (String(p).endsWith("settings-history.jsonl")) order.push("history");
    return realOpen(p, f);
  }) as typeof fs.openSync);
  const realRename = fs.renameSync;
  jest.spyOn(fs, "renameSync").mockImplementation((a, b) => { order.push("settings"); return realRename(a, b); });
  writeSettings({ ...DEFAULT_SETTINGS, redThresholdPct: 12 }, "web");
  expect(order).toEqual(["history", "settings"]);
});

test("#4 writeSettings is synchronous (no await/Promise)", () => {
  const r = writeSettings({ ...DEFAULT_SETTINGS, weightKg: 7 }, "web") as unknown;
  expect(r).toBeUndefined();
});
