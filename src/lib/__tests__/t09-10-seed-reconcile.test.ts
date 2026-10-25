// §7 #9 seed on first start, #10 startup reconcile.
import fs from "fs";
import path from "path";
import { DEFAULT_SETTINGS, historyFile, initDataStore, seedOrReconcileHistory, writeSettings } from "@/lib/server-store";
import { LOGGED_KEYS } from "@/lib/settingsHistory";
import { readLines, tmpDataDir } from "@/lib/test-helpers";

test("#9 missing file → one snapshot/seed line equal to current settings", () => {
  const d = tmpDataDir();
  const cur = { ...DEFAULT_SETTINGS, preferredBottleWaterMl: 120, dateOfBirthMs: 1750000000000, sex: "F" as const, targetMlPerDay: 900 };
  fs.writeFileSync(path.join(d, "settings.json"), JSON.stringify(cur));
  expect(seedOrReconcileHistory()).toBe("seed");
  const lines = readLines(historyFile());
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatchObject({ v: 1, kind: "snapshot", source: "seed" });
  const ch = lines[0].changes as Record<string, { new: unknown }>;
  expect(Object.keys(ch).sort()).toEqual([...LOGGED_KEYS].sort());
  for (const k of LOGGED_KEYS) expect(ch[k].new).toEqual((cur as Record<string, unknown>)[k]);
  expect(JSON.stringify(lines[0])).not.toMatch(/targetMlPerDay/);
});

test("#10 equal → nothing appended (second start)", () => {
  tmpDataDir();
  initDataStore(() => {});
  writeSettings({ ...DEFAULT_SETTINGS, preferredBottleWaterMl: 120 }, "web");
  const n = readLines(historyFile()).length;
  expect(seedOrReconcileHistory()).toBe("none");
  expect(readLines(historyFile())).toHaveLength(n);
});

test("#10 history older than settings.json (restore/manual edit/crash) → one reconcile snapshot", () => {
  const d = tmpDataDir();
  initDataStore(() => {});
  fs.writeFileSync(path.join(d, "settings.json"), JSON.stringify({ ...DEFAULT_SETTINGS, mlPerKgPerDay: 170 }));
  const n = readLines(historyFile()).length;
  expect(seedOrReconcileHistory()).toBe("reconcile");
  const lines = readLines(historyFile());
  expect(lines).toHaveLength(n + 1);
  expect(lines.at(-1)).toMatchObject({ kind: "snapshot", source: "reconcile", changes: { mlPerKgPerDay: { new: 170 } } });
  expect(seedOrReconcileHistory()).toBe("none");
});
