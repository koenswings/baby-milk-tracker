// §7 #5 — oldUnknown on corrupt baseline.
import fs from "fs";
import path from "path";
import { DEFAULT_SETTINGS, historyFile, writeSettings } from "@/lib/server-store";
import { readLines, tmpDataDir } from "@/lib/test-helpers";

test("#5 corrupt settings.json + save → entry has oldUnknown: true", () => {
  const d = tmpDataDir();
  fs.writeFileSync(path.join(d, "settings.json"), "{not json");
  writeSettings({ ...DEFAULT_SETTINGS, preferredBottleWaterMl: 120 }, "web");
  const [e] = readLines(historyFile());
  expect(e.oldUnknown).toBe(true);
});

test("#5 healthy baseline → no oldUnknown", () => {
  tmpDataDir();
  writeSettings({ ...DEFAULT_SETTINGS }, "web");
  writeSettings({ ...DEFAULT_SETTINGS, preferredBottleWaterMl: 120 }, "web");
  for (const e of readLines(historyFile())) expect(e.oldUnknown).toBeUndefined();
});
