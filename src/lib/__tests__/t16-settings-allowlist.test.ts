// Follow-up (1.1.58): settings.json persists only allowlisted keys; targetMlPerDay can't land anywhere.
import fs from "fs";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/settings/route";
import { historyFile, readSettings, settingsFile, writeSettings, DEFAULT_SETTINGS } from "@/lib/server-store";
import { PERSISTED_KEYS, LOGGED_KEYS } from "@/lib/settingsHistory";
import { tmpDataDir } from "@/lib/test-helpers";

const post = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/settings", { method: "POST", body: JSON.stringify(body) }));
const onDisk = () => JSON.parse(fs.readFileSync(settingsFile(), "utf8"));
const historyText = () => (fs.existsSync(historyFile()) ? fs.readFileSync(historyFile(), "utf8") : "");

test("allowlist is the history allowlist plus display-only keys, never targetMlPerDay", () => {
  for (const k of LOGGED_KEYS) expect(PERSISTED_KEYS).toContain(k);
  expect(PERSISTED_KEYS).not.toContain("targetMlPerDay");
});

test("targetMlPerDay posted -> absent from settings.json and history; response shape unchanged", async () => {
  tmpDataDir();
  const res = await post({ ...DEFAULT_SETTINGS, mlPerKgPerDay: 160, targetMlPerDay: 999 });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
  expect(onDisk()).not.toHaveProperty("targetMlPerDay");
  expect(onDisk().mlPerKgPerDay).toBe(160);
  expect(historyText()).toContain("mlPerKgPerDay");
  expect(historyText()).not.toContain("targetMlPerDay");
});

test("unknown key is dropped", async () => {
  tmpDataDir();
  await post({ ...DEFAULT_SETTINGS, bogus: 1, __proto__x: "y" });
  expect(onDisk()).not.toHaveProperty("bogus");
  expect(onDisk()).not.toHaveProperty("__proto__x");
  expect(readSettings()).not.toHaveProperty("bogus");
});

test("allowlisted keys round-trip", async () => {
  tmpDataDir();
  const full = {
    weightKg: 5.1, mlPerKgPerDay: 155, preferredBottleWaterMl: 120, yellowThresholdPct: 6,
    redThresholdPct: 12, timeFormat: "12h", feedingTimelineView: "cards", dateOfBirthMs: 1750000000000, sex: "F",
  };
  await post(full);
  expect(onDisk()).toEqual(full);
  expect(readSettings()).toEqual(full);
});

test("targetMlPerDay in an existing settings.json is stripped on next write", () => {
  tmpDataDir();
  fs.writeFileSync(settingsFile(), JSON.stringify({ ...DEFAULT_SETTINGS, targetMlPerDay: 900 }));
  expect(readSettings()).not.toHaveProperty("targetMlPerDay");
  writeSettings({ ...readSettings(), weightKg: 6.5 }, "web");
  expect(onDisk()).not.toHaveProperty("targetMlPerDay");
  expect(historyText()).not.toContain("targetMlPerDay");
});
