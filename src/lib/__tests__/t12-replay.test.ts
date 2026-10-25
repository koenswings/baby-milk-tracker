// §7 #12 — replay uses settingsAt(lastFeed.timestamp), never Date.now().
import fs from "fs";
import path from "path";
import { HistoryEntry, settingsForFeed, settingsForReplay } from "@/lib/settingsHistory";
import { DEFAULT_SETTINGS } from "@/lib/server-store";

const at = (s: string) => Date.parse(s);
const seed: HistoryEntry = { v: 1, kind: "snapshot", effectiveFrom: "2026-10-01T00:00:00Z", changedAt: "2026-10-01T00:00:00Z", source: "seed", appVersion: "1.1.57", changes: { preferredBottleWaterMl: { new: 90 } } };
const change: HistoryEntry = { v: 1, kind: "diff", effectiveFrom: "2026-10-23T09:58:47Z", changedAt: "2026-10-23T09:58:47Z", source: "web", appVersion: "1.1.57", changes: { preferredBottleWaterMl: { old: 90, new: 120 } } };
const current = { ...DEFAULT_SETTINGS, preferredBottleWaterMl: 120 };

test("#12 no Date.now()/new Date() in the replay path", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "settingsHistory.ts"), "utf8");
  expect(src).not.toMatch(/Date\.now\(/);
  expect(src).not.toMatch(/new Date\(\)/);
});

test("#12 replay frozen at lastFeed.timestamp — independent of the wall clock", () => {
  const spy = jest.spyOn(Date, "now").mockReturnValue(at("2030-01-01T00:00:00Z"));
  const feedsBefore = [{ timestamp: at("2026-10-22T08:00:00Z") }, { timestamp: at("2026-10-23T08:00:00Z") }];
  expect(settingsForReplay([seed, change], current, feedsBefore)!.settings.preferredBottleWaterMl).toBe(90);
  const feedsAfter = [...feedsBefore, { timestamp: at("2026-10-23T12:00:00Z") }];
  expect(settingsForReplay([seed, change], current, feedsAfter)!.settings.preferredBottleWaterMl).toBe(120);
  spy.mockRestore();
  expect(settingsForReplay([seed, change], current, [])).toBeNull();
});

test("#12 per-feed verdicts use the feed's own timestamp around a preferred-bottle change", () => {
  expect(settingsForFeed([seed, change], current, { timestamp: at("2026-10-23T09:00:00Z") }).settings.preferredBottleWaterMl).toBe(90);
  expect(settingsForFeed([seed, change], current, { timestamp: at("2026-10-23T10:00:00Z") }).settings.preferredBottleWaterMl).toBe(120);
});
