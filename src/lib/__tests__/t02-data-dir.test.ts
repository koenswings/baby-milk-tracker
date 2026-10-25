// §7 #2 — shared DATA_DIR resolver used by all stores; env wins; default <cwd>/data.
import fs from "fs";
import path from "path";
import { getDataDir } from "@/lib/data-dir";
import { readLines, tmpDataDir } from "@/lib/test-helpers";
import { writeFeeds, writeSettings, initDataStore, historyFile, DEFAULT_SETTINGS } from "@/lib/server-store";
import { writeWeights } from "@/lib/server-weights";

const ORIG = process.env.DATA_DIR;
afterEach(() => { if (ORIG === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = ORIG; });

test("#2 DATA_DIR set → used by feeds, settings, weights and history", () => {
  const d = tmpDataDir();
  writeFeeds([{ id: "a", timestamp: 1, volume: 90 }]);
  writeWeights([{ id: "w", timestamp: 1, weightKg: 6 }]);
  writeSettings({ ...DEFAULT_SETTINGS, preferredBottleWaterMl: 120 }, "web");
  for (const f of ["feeds.json", "weights.json", "settings.json", "settings-history.jsonl"]) {
    expect(fs.existsSync(path.join(d, f))).toBe(true);
  }
  expect(historyFile()).toBe(path.join(d, "settings-history.jsonl"));
  expect(readLines(historyFile())).toHaveLength(1);
});

test("#2 DATA_DIR unset → <cwd>/data for every store", () => {
  delete process.env.DATA_DIR;
  expect(getDataDir()).toBe(path.join(process.cwd(), "data"));
  expect(historyFile()).toBe(path.join(process.cwd(), "data", "settings-history.jsonl"));
  process.env.DATA_DIR = "";
  expect(getDataDir()).toBe(path.join(process.cwd(), "data"));
});

test("#2 production value /app/data wins", () => {
  process.env.DATA_DIR = "/app/data";
  expect(getDataDir()).toBe("/app/data");
});

test("#2 startup logs the resolved DATA_DIR", () => {
  const d = tmpDataDir();
  const logs: string[] = [];
  initDataStore((m) => logs.push(m));
  expect(logs[0]).toBe(`[milkwise] DATA_DIR resolved to ${d}`);
});

test("#2 start.js only sets DATA_DIR when unset, with the shared default", () => {
  const src = fs.readFileSync(path.join(__dirname, "../../../start.js"), "utf8");
  expect(src).not.toMatch(/agent-app-dev/);
  expect(src).toMatch(/if \(!process\.env\.DATA_DIR\)/);
  expect(src).toMatch(/path\.join\(process\.cwd\(\), 'data'\)/);
});

test("#2 no store keeps its own default", () => {
  for (const f of ["server-store.ts", "server-weights.ts"]) {
    const src = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
    expect(src).not.toMatch(/process\.env\.DATA_DIR/);
    expect(src).toMatch(/data-dir/);
  }
});
