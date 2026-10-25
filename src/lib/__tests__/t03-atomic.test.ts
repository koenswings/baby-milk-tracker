// §7 #3 — temp + rename writes; simulated crash after temp write leaves old file intact.
import fs from "fs";
import path from "path";
import { writeFileAtomicSync } from "@/lib/atomic-write";
import { tmpDataDir } from "@/lib/test-helpers";
import { DEFAULT_SETTINGS, readSettings, writeSettings, writeFeeds, readFeeds } from "@/lib/server-store";

afterEach(() => jest.restoreAllMocks());

test("#3 writes new content and leaves no temp files", () => {
  const d = tmpDataDir();
  const f = path.join(d, "x.json");
  writeFileAtomicSync(f, "1");
  writeFileAtomicSync(f, "2");
  expect(fs.readFileSync(f, "utf8")).toBe("2");
  expect(fs.readdirSync(d)).toEqual(["x.json"]);
});

test("#3 crash after temp write (rename fails) → old settings.json intact and parseable", () => {
  const d = tmpDataDir();
  writeSettings({ ...DEFAULT_SETTINGS, preferredBottleWaterMl: 120 }, "web");
  const before = fs.readFileSync(path.join(d, "settings.json"), "utf8");
  jest.spyOn(fs, "renameSync").mockImplementation(() => { throw new Error("simulated crash"); });
  expect(() => writeSettings({ ...DEFAULT_SETTINGS, preferredBottleWaterMl: 150 }, "web")).toThrow("simulated crash");
  jest.restoreAllMocks();
  const after = fs.readFileSync(path.join(d, "settings.json"), "utf8");
  expect(after).toBe(before);
  expect(JSON.parse(after).preferredBottleWaterMl).toBe(120);
  expect(readSettings().preferredBottleWaterMl).toBe(120);
});

test("#3 feeds.json also written atomically", () => {
  tmpDataDir();
  writeFeeds([{ id: "a", timestamp: 1, volume: 90 }]);
  jest.spyOn(fs, "renameSync").mockImplementation(() => { throw new Error("crash"); });
  expect(() => writeFeeds([])).toThrow();
  jest.restoreAllMocks();
  expect(readFeeds()).toHaveLength(1);
});
