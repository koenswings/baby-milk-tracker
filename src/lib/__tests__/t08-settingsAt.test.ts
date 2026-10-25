// §7 #8 — settingsAt in src/lib/settingsHistory.ts.
import { HistoryEntry, settingsAt } from "@/lib/settingsHistory";
import { DEFAULT_SETTINGS } from "@/lib/server-store";

const T = (s: string) => Date.parse(s);
const e = (at: string, changes: HistoryEntry["changes"], kind: "diff" | "snapshot" = "diff", source: HistoryEntry["source"] = "web", changedAt = at): HistoryEntry =>
  ({ v: 1, kind, effectiveFrom: at, changedAt, source, appVersion: "1.1.57", changes });
const current = { ...DEFAULT_SETTINGS, preferredBottleWaterMl: 150, mlPerKgPerDay: 160 };
const seed = e("2026-10-10T00:00:00Z", { preferredBottleWaterMl: { new: 90 }, mlPerKgPerDay: { new: 150 } }, "snapshot", "seed");
const d1 = e("2026-10-15T00:00:00Z", { preferredBottleWaterMl: { old: 90, new: 120 } });
const d2 = e("2026-10-20T00:00:00Z", { preferredBottleWaterMl: { old: 120, new: 150 }, mlPerKgPerDay: { old: 150, new: 160 } });

test("#8 before seed → seed values, approximate", () => {
  const r = settingsAt([seed, d1, d2], current, T("2026-10-01T00:00:00Z"));
  expect(r.approximate).toBe(true);
  expect(r.settings.preferredBottleWaterMl).toBe(90);
  expect(r.settings.mlPerKgPerDay).toBe(150);
});

test("#8 between entries", () => {
  const r = settingsAt([seed, d1, d2], current, T("2026-10-17T00:00:00Z"));
  expect(r).toEqual({ settings: expect.objectContaining({ preferredBottleWaterMl: 120, mlPerKgPerDay: 150 }), approximate: false });
});

test("#8 exactly at an entry's effectiveFrom → that entry applies", () => {
  expect(settingsAt([seed, d1, d2], current, T("2026-10-15T00:00:00Z")).settings.preferredBottleWaterMl).toBe(120);
});

test("#8 after last", () => {
  const r = settingsAt([seed, d1, d2], current, T("2026-10-25T00:00:00Z"));
  expect(r.settings.preferredBottleWaterMl).toBe(150);
  expect(r.settings.mlPerKgPerDay).toBe(160);
});

test("#8 out-of-order effectiveFrom in file sorted correctly (tiebreak changedAt)", () => {
  const a = e("2026-10-15T00:00:00Z", { preferredBottleWaterMl: { old: 90, new: 100 } }, "diff", "web", "2026-10-15T00:00:00Z");
  const b = e("2026-10-15T00:00:00Z", { preferredBottleWaterMl: { old: 100, new: 110 } }, "diff", "web", "2026-10-15T00:05:00Z");
  const r = settingsAt([d2, b, a, seed], current, T("2026-10-16T00:00:00Z"));
  expect(r.settings.preferredBottleWaterMl).toBe(110);
});

test("#8 snapshot entries applied (reconcile resets earlier diffs)", () => {
  const rec = e("2026-10-18T00:00:00Z", { preferredBottleWaterMl: { new: 60 }, mlPerKgPerDay: { new: 140 } }, "snapshot", "reconcile");
  const r = settingsAt([seed, d1, rec], current, T("2026-10-19T00:00:00Z"));
  expect(r.settings.preferredBottleWaterMl).toBe(60);
  expect(r.settings.mlPerKgPerDay).toBe(140);
});

test("#8 keys never logged come from current", () => {
  const r = settingsAt([seed], { ...current, timeFormat: "12h" }, T("2026-10-12T00:00:00Z"));
  expect(r.settings.timeFormat).toBe("12h");
  expect(r.settings.redThresholdPct).toBe(current.redThresholdPct);
});
