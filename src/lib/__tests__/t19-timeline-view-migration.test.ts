// feedingTimelineView migration (1.1.59): stored 'timeline' → 'zones' once, marked by feedingTimelineViewMigrated.
import fs from "fs";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/settings/route";
import { readSettings, settingsFile, historyFile, writeSettings, migrateTimelineView, DEFAULT_SETTINGS } from "@/lib/server-store";
import { PERSISTED_KEYS, LOGGED_KEYS, pickPersisted } from "@/lib/settingsHistory";
import { tmpDataDir } from "@/lib/test-helpers";

const onDisk = () => JSON.parse(fs.readFileSync(settingsFile(), "utf8"));
const seed = (s: object) => { tmpDataDir(); fs.writeFileSync(settingsFile(), JSON.stringify({ ...DEFAULT_SETTINGS, ...s })); };

test("stored 'timeline' becomes 'zones' + marker, persisted", () => {
  seed({ feedingTimelineView: "timeline" });
  expect(readSettings().feedingTimelineView).toBe("zones");
  expect(onDisk()).toMatchObject({ feedingTimelineView: "zones", feedingTimelineViewMigrated: true });
});

test("absent view becomes 'zones'; 'cards' is untouched (marker set)", () => {
  seed({});
  expect(readSettings()).toMatchObject({ feedingTimelineView: "zones", feedingTimelineViewMigrated: true });
  seed({ feedingTimelineView: "cards" });
  expect(readSettings()).toMatchObject({ feedingTimelineView: "cards", feedingTimelineViewMigrated: true });
});

test("runs once: a later choice of the classic 'timeline' is kept", async () => {
  seed({ feedingTimelineView: "timeline" });
  readSettings();
  await POST(new NextRequest("http://localhost/api/settings", {
    method: "POST", body: JSON.stringify({ ...readSettings(), feedingTimelineView: "timeline" }),
  }));
  expect(readSettings().feedingTimelineView).toBe("timeline");
  expect(onDisk().feedingTimelineView).toBe("timeline");
});

test("marker survives the allowlist and is not a logged (history) key", () => {
  expect(PERSISTED_KEYS).toContain("feedingTimelineViewMigrated");
  expect(LOGGED_KEYS as readonly string[]).not.toContain("feedingTimelineViewMigrated");
  expect(pickPersisted({ feedingTimelineViewMigrated: true })).toEqual({ feedingTimelineViewMigrated: true });
});

test("a client that omits the marker cannot undo the migration", () => {
  seed({ feedingTimelineView: "timeline" });
  readSettings();
  const { feedingTimelineViewMigrated: _m, ...withoutMarker } = readSettings();
  void _m;
  writeSettings({ ...withoutMarker, feedingTimelineView: "timeline" }, "mobile");
  expect(onDisk().feedingTimelineViewMigrated).toBe(true);
  expect(readSettings().feedingTimelineView).toBe("timeline");
});

test("migration writes no history line (display-only) and no settings file when none exists", () => {
  seed({ feedingTimelineView: "timeline" });
  readSettings();
  const hist = fs.existsSync(historyFile()) ? fs.readFileSync(historyFile(), "utf8") : "";
  expect(hist).not.toContain("feedingTimelineView");
  tmpDataDir();
  expect(readSettings().feedingTimelineView).toBeUndefined();
  expect(fs.existsSync(settingsFile())).toBe(false);
});

test("migrateTimelineView is a no-op once marked", () => {
  expect(migrateTimelineView({ ...DEFAULT_SETTINGS, feedingTimelineView: "timeline", feedingTimelineViewMigrated: true })).toBeNull();
});
