# Settings history — record changes to calculation parameters

**Status:** For Design Review — no code change in this PR
**Date:** 2026-10-25 · **Author:** Grok Bot for Koen · **Target versions:** web 1.1.57 (mobile unchanged unless noted)
**Motivation:** Koen 2026-10-25: *"update the app with a recording of the parameter changes that affect this calculation"*. The feeding-zones replay (PR #3, §11.4/§11b) has to assume today's settings for all past days, because `settings.json` only holds current values.

## 1. Problem

`data/settings.json` is overwritten on every save (`src/lib/server-store.ts` `writeSettings`, full-object `JSON.stringify`). Any replay of the past (zone history, verdicts "in zone / early / late", analytics) silently uses the *current* preferred bottle, ml/kg/day, thresholds and baby profile. Feeds (`feeds.json`) and weigh-ins (`weights.json`) are timestamped; settings are not.

## 2. Which settings affect calculations (enumerated from code, `main` @ 754bdb5)

`Settings` (`src/types/index.ts`):

| Key | Unit | Used by | Effect | Log? |
|---|---|---|---|---|
| `preferredBottleWaterMl` | water ml | `page.tsx` (computePredictors, CanTakeCard, StrictCard `standardBottleVolume`), `DailyTargetCard`, `calculations.ts` (`stomachCapMilk`, `canTakeProgression` ceiling = preferred+1), info pages | stomach cap, sizes shown, standard interval, Next Feed | **yes** |
| `mlPerKgPerDay` | ml/kg/day | `deriveSettings` → `dailyTargetMl`, `hourlyRate`; `DailyTargetCard`, analytics | D and r — every % | **yes** |
| `weightKg` | kg | fallback weight when no recent weigh-in / no DOB+sex (`page.tsx:130-151`); synced from latest weigh-in by `api/weights` POST | D | **yes** (cheap; derived but can be set manually on mobile `DashboardScreen.tsx:534`) |
| `dateOfBirthMs` | epoch ms | WHO weight prediction (`whoGrowth.ts`), analytics | D when weigh-in > 7 days old | **yes** |
| `sex` | 'M'/'F' | WHO curves | same | **yes** |
| `yellowThresholdPct`, `redThresholdPct` | % | status colours (`page.tsx`, analytics); zone-open bound = 105 % ties to yellow (PR #3 §10) | colours, zone bound | **yes** |
| `timeFormat`, `feedingTimelineView` | — | display only | none | no |
| legacy on disk: `standardBottleVolume`, `displayBottleVolumeWater`, `nextBottleWaterMl`, `maxCorrectionPct`, `useTargetAwarePredictor`, `maxFeedGapPct` | — | only `nextFeedTime` (deprecated, `calculations.ts:209-213`) | none in current UI | no (ignored; log if they ever come back) |

Constants in code (formula table, t½ = 60 min, 7 h window, ×1.1 stomach buffer, 105 %) are *code*, not settings: they are captured by the app version, see §4.6.

## 3. Proposal

### 3.1 File and entry format

Append-only `data/settings-history.json` (array, same dir as `settings.json`, `DATA_DIR`):

```json
{ "effectiveFrom": "2026-10-23T11:58:47+02:00", "changedAt": "2026-10-23T11:58:47+02:00",
  "changes": { "preferredBottleWaterMl": { "old": 90, "new": 120 } },
  "source": "web" | "mobile" | "weights-sync" | "seed", "appVersion": "1.1.57" }
```

- `effectiveFrom` = `changedAt` by default; a later UI may let the parent back-date a change (e.g. "we switched to 120 ml yesterday").
- Only keys from the **Log? = yes** list are compared and recorded; one entry per save with ≥ 1 changed key.
- Values in the same units as `settings.json` (**water ml** for bottle sizes, never formula ml; **no `targetMlPerDay`** — D stays derived).

### 3.2 Where it is written

In `server-store.ts` `writeSettings(next, source)`: read current, diff the logged keys, append the entry, then write `settings.json`. Hooking `writeSettings` (not the route) catches **all** writers:
- `POST /api/settings` (web settings page, and **mobile** — `milkwise/src/lib/store.ts:119-127` `saveSettings` POSTs the whole object; called from `SettingsScreen.tsx:108`, `DashboardScreen.tsx:534` weight, `:553` preferred bottle);
- `POST /api/weights` (syncs `settings.weightKg`, `source: "weights-sync"`).

Mobile needs **no change** in API mode. In its AsyncStorage (non-API) mode it writes locally (`store.ts:126`) and would not be logged — documented limitation (that mode is not used in production).
Writes stay synchronous `fs.writeFileSync`; append = read array, push, write to a temp file, rename (atomic). Single-process Next server → no locking needed beyond that.

### 3.3 Reading: `settingsAt(T)`

New pure function (`src/lib/settingsHistory.ts`, mirrored into mobile only if mobile needs replay):

```ts
settingsAt(history, current, T): Settings
// start from the seed entry, apply entries with effectiveFrom <= T in order; keys never logged → current value
```

Used only by historic replay (zone history, verdicts, analytics). **Current values are still read exactly as today** from `settings.json` — no behaviour change for live screens.
Exposed read-only: `GET /api/settings/history`.

### 3.4 Seed and the unknown past

At first start of 1.1.57, if the file does not exist, write one `source: "seed"` entry with all logged keys at current values and `effectiveFrom = deploy time`. Before that moment history is **unknown**; `settingsAt(T < seed)` returns the seed values and flags `approximate: true` so UIs can show "settings before 25/10 assumed".
Optional one-off back-fill from known facts (e.g. preferred 90 → 120 date) via a hand-written entry, `source: "manual"`.

### 3.5 Weigh-in edits / deletes

`weights.json` entries can be PATCHed / DELETEd (`api/weights/[id]/route.ts`), which rewrites the past. **Open question:** also log them (`data/weights-history.json`, `{changedAt, op, id, old, new}`)? Recommended yes (same mechanism, tiny), but not required for replay of *settings*.

## 4. Non-functional

1. **Backups:** include `settings-history.json` wherever `feeds.json`/`settings.json`/`weights.json` are backed up (the current DB snapshots copy the whole data dir — check the backup script/cron on the Pi).
2. **Size:** ~250 B per entry; even 10 changes/day → < 1 MB/year. No pruning.
3. **Migration:** none for existing files; history file created lazily with the seed entry. Rollback to 1.1.56 is safe (file ignored).
4. **Invariants respected:** water ml only for bottle sizes; no `targetMlPerDay` persisted anywhere (cf. milkwise PR #1); `settings.json` format unchanged; derived values (D, r, WHO weight) never stored.
5. **Tests:** the web repo has no test runner yet (`package.json` has no jest/vitest). Proposal: add **Vitest** (fits TS/Next without Babel config) with:
   - diff: only logged keys, no entry when nothing changed, old/new correct;
   - multiple writers (settings POST + weights sync) both logged with correct `source`;
   - `settingsAt` before seed / between entries / after last / back-dated `effectiveFrom` out of order;
   - atomic write (temp + rename) survives a crash mid-write (simulate).
   - `npm test` added to scripts.
6. **Versioning:** web 1.1.56 → **1.1.57** (`src/app/page.tsx:174`, `src/app/settings/page.tsx:10`). Mobile unchanged (no code touched); if mobile later gets a replay view it adds `settingsAt` and bumps to 1.2.10.
7. **App version per entry** (`appVersion`) lets a replay also tell when calculation *code* changed (e.g. 1.1.56 → 105 % rule).

## 5. Open questions

1. Log weigh-in edits/deletes too (§3.5)?
2. Allow back-dating `effectiveFrom` in the UI, or only via manual entry?
3. Back-fill known historic changes (preferred 90 → 120, ml/kg/day changes) by hand?
4. Should `weightKg` be logged at all, given it is mostly synced from weigh-ins?
5. Should mobile show "settings changed here" markers on its timeline/history?
