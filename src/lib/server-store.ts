import fs from "fs";
import { Feed, Settings } from "@/types";
import { dataFile, getDataDir } from "@/lib/data-dir";
import { appendLineSync, writeFileAtomicSync } from "@/lib/atomic-write";
import { APP_VERSION } from "@/lib/version";
import {
  pickPersisted,
  HistoryEntry, HistorySource, diffLogged, isoWithOffset, parseHistory,
  sameLogged, settingsAt, snapshotLogged, sortEntries,
} from "@/lib/settingsHistory";

// Data directory: see src/lib/data-dir.ts (DATA_DIR env wins, default <cwd>/data).
const feedsFile = () => dataFile("feeds.json");
export const settingsFile = () => dataFile("settings.json");
export const historyFile = () => dataFile("settings-history.jsonl");

export const DEFAULT_SETTINGS: Settings = {
  weightKg: 6.27,
  mlPerKgPerDay: 150,
  preferredBottleWaterMl: 90,
  yellowThresholdPct: 5,
  redThresholdPct: 10,
  timeFormat: '24h' as const,
};

function ensureDir() {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function readFeeds(): Feed[] {
  ensureDir();
  if (!fs.existsSync(feedsFile())) return [];
  try {
    return JSON.parse(fs.readFileSync(feedsFile(), "utf8")) as Feed[];
  } catch {
    return [];
  }
}

export function writeFeeds(feeds: Feed[]): void {
  ensureDir();
  writeFileAtomicSync(feedsFile(), JSON.stringify(feeds));
}

/** Reads settings; `ok: false` when settings.json exists but is unreadable/corrupt. */
function readSettingsWithStatus(): { settings: Settings; ok: boolean } {
  ensureDir();
  if (!fs.existsSync(settingsFile())) return { settings: { ...DEFAULT_SETTINGS }, ok: true };
  try {
    return { settings: { ...DEFAULT_SETTINGS, ...pickPersisted(JSON.parse(fs.readFileSync(settingsFile(), "utf8"))) }, ok: true };
  } catch {
    return { settings: { ...DEFAULT_SETTINGS }, ok: false };
  }
}

export function readSettings(): Settings {
  return readSettingsWithStatus().settings;
}

/**
 * Persist settings. Fully synchronous: (1) read baseline, (2) append history line
 * for changed allowlisted keys FIRST, (3) atomically replace settings.json.
 */
export function writeSettings(settings: Settings, source: HistorySource, now: Date = new Date()): void {
  ensureDir();
  const { settings: baseline, ok } = readSettingsWithStatus();
  // Allowlist: unknown keys and the deprecated targetMlPerDay never reach disk.
  const clean = pickPersisted(settings) as Settings;
  const changes = diffLogged(baseline, clean);
  if (Object.keys(changes).length > 0) {
    const at = isoWithOffset(now);
    const entry: HistoryEntry = {
      v: 1, kind: "diff", effectiveFrom: at, changedAt: at, source, appVersion: APP_VERSION,
      ...(ok ? {} : { oldUnknown: true }),
      changes,
    };
    appendLineSync(historyFile(), JSON.stringify(entry));
  }
  writeFileAtomicSync(settingsFile(), JSON.stringify(clean));
}

/** Read the JSONL history, skipping (and warning about) corrupt lines. File is never rewritten. */
export function readSettingsHistory(): HistoryEntry[] {
  ensureDir();
  if (!fs.existsSync(historyFile())) return [];
  return parseHistory(fs.readFileSync(historyFile(), "utf8"));
}

export function readSettingsHistorySorted(): HistoryEntry[] {
  return sortEntries(readSettingsHistory());
}

/** Seed (missing history) or reconcile (history disagrees with settings.json). Returns what it did. */
export function seedOrReconcileHistory(now: Date = new Date()): "seed" | "reconcile" | "none" {
  ensureDir();
  const current = readSettings();
  const at = isoWithOffset(now);
  const snap = (source: "seed" | "reconcile"): HistoryEntry => ({
    v: 1, kind: "snapshot", effectiveFrom: at, changedAt: at, source, appVersion: APP_VERSION,
    changes: snapshotLogged(current),
  });
  if (!fs.existsSync(historyFile())) {
    appendLineSync(historyFile(), JSON.stringify(snap("seed")));
    return "seed";
  }
  const replayed = settingsAt(readSettingsHistory(), current, now.getTime()).settings;
  if (!sameLogged(replayed, current)) {
    appendLineSync(historyFile(), JSON.stringify(snap("reconcile")));
    return "reconcile";
  }
  return "none";
}

/** Called once at server start (src/instrumentation.ts). */
export function initDataStore(log: (msg: string) => void = (m) => console.log(m)): void {
  log(`[milkwise] DATA_DIR resolved to ${getDataDir()}`);
  const r = seedOrReconcileHistory();
  if (r !== "none") log(`[milkwise] settings history: appended ${r} snapshot`);
}
