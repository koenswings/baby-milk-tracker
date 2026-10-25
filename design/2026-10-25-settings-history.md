# Settings history — record changes to calculation parameters

**Status:** Final — implementation may start; backups are an open **dependency/risk** (§6), not a blocker for this design
**Date:** 2026-10-25 (final revision 09:00 CET) · **Author:** Grok Bot for Koen · **Reviewed by:** MilkWise Dev ([review](https://github.com/koenswings/baby-milk-tracker/pull/4#pullrequestreview-5642156548)), all points accepted by Lead
**Target versions:** web 1.1.57; mobile unchanged in phase 1 (phase 1b has its own bump)
**Motivation:** Koen 2026-10-25: *"update the app with a recording of the parameter changes that affect this calculation"*. The feeding-zones replay (PR #3, §11.4/§11b) currently assumes today's settings for every past day, because `settings.json` only holds current values.

## 1. Problem

`data/settings.json` is overwritten on every save (`src/lib/server-store.ts:52-55`, plain `writeFileSync`). Any replay of the past (zone history, verdicts, analytics) silently uses the *current* preferred bottle, ml/kg/day, thresholds and baby profile. Feeds and weigh-ins are timestamped; settings are not.

## 2. Settings that affect calculations (from code, `main` @ 754bdb5)

| Key | Unit | Used by | Effect | Logged |
|---|---|---|---|---|
| `preferredBottleWaterMl` | water ml | `page.tsx` predictors, CanTakeCard, StrictCard, DailyTargetCard, `calculations.ts` (stomach cap, ceiling = preferred+1) | stomach cap, sizes, Next Feed | **yes** |
| `mlPerKgPerDay` | ml/kg/day | `deriveSettings` → D, r; DailyTargetCard, analytics | every % | **yes** |
| `weightKg` | kg | fallback weight (`page.tsx:130-151`); synced by `POST /api/weights`; set manually on mobile (`DashboardScreen.tsx:534`) | D | **yes** (see open Q4) |
| `dateOfBirthMs` | epoch ms | WHO prediction (weigh-in > 7 days old) | D | **yes** |
| `sex` | 'M'/'F' | WHO curves | D | **yes** |
| `yellowThresholdPct`, `redThresholdPct` | % | status colours; 105 % zone-open bound (PR #3 §10) | colours, zones | **yes** |
| `timeFormat`, `feedingTimelineView` | — | display only | none | no |
| legacy on disk (`standardBottleVolume`, `displayBottleVolumeWater`, `nextBottleWaterMl`, `maxCorrectionPct`, `useTargetAwarePredictor`, `maxFeedGapPct`) | — | deprecated `nextFeedTime` only | none | no |
| `targetMlPerDay` | — | must never be stored (invariant) | — | **never** |

Code constants (formula table, t½, 7 h window, ×1.1 buffer, 105 %) are versioned through `appVersion` on each entry.

## 3. Design

### 3.1 File format — JSONL
`DATA_DIR/settings-history.jsonl`: one JSON object per line, append-only. On read, invalid lines are **skipped and logged** (`console.warn` with line number), never rewritten. One bad byte therefore loses at most one entry.

```json
{"v":1,"effectiveFrom":"2026-10-23T11:58:47+02:00","changedAt":"2026-10-23T11:58:47+02:00","source":"web","appVersion":"1.1.57","changes":{"preferredBottleWaterMl":{"old":90,"new":120}}}
```

- `v: 1` on every entry (schema version).
- `kind`: `"diff"` (default) or `"snapshot"` (seed / reconcile / re-seed: `changes` holds every logged key, `old` may be omitted). `settingsAt` accepts both.
- `source`: `web` | `mobile` | `weights-sync` | `seed` | `reconcile` | `manual` | (phase 2) `mobile-offline`.
- `oldUnknown: true` when the baseline could not be read (corrupt `settings.json`; `readSettings` returns defaults, `server-store.ts:44-49`), so a bogus "old = default" is never presented as a real change.
- `changedAt` = **server clock**, ISO with offset. `effectiveFrom` = `changedAt` in phase 1; phase 2 may carry a client time (clamped ≤ server now). Fields are designed now so phase 2 is backwards compatible.
- Bottle values in **water ml** only.

### 3.2 Allowlist
History entries are built **only** from the explicit LOGGED_KEYS list above, never by spreading the request body. `POST /api/settings` stores the raw body (`route.ts:10-12`); the allowlist keeps `targetMlPerDay` and legacy keys out of history by construction. (Filtering what `settings.json` itself stores is a separate hardening item, out of scope here.)

### 3.3 Write path (synchronous, atomic)
In `server-store.ts` `writeSettings(next, source)`, fully synchronous (no `await` inside):
1. read current settings (baseline; set `oldUnknown` if unreadable);
2. diff LOGGED_KEYS; if any changed, **append the history line first**;
3. write `settings.json` via the shared **temp-file + rename** helper (`src/lib/atomic-write.ts`), also used for the history file when rewriting it is ever needed (re-seed) and recommended for `feeds.json` / `weights.json`.

If the process crashes between steps 2 and 3, history is *ahead* of settings, never behind; startup reconcile (§3.5) heals it.
Because it hooks `writeSettings`, all writers are covered: web settings page, mobile (`milkwise/src/lib/store.ts:119-127` POSTs the whole object to `/api/settings`), and `POST /api/weights` (weight sync, `source: "weights-sync"`). Single-process Next server → no lock needed.

### 3.4 Read path — `settingsAt(T)`
Pure function in **`src/lib/settingsHistory.ts`**, deliberately **not** in `calculations.ts` (that file stays in the byte-identical web/mobile reconciliation scope of PR #2; moving it there needs a new review).

```ts
settingsAt(entries, current, T): { settings: Settings; approximate: boolean }
// sort by effectiveFrom, tiebreak changedAt (file order = append order, not effective order);
// start from latest snapshot ≤ T, apply diffs ≤ T; keys never logged → current; T < first seed → seed values, approximate = true
```

- Replay calls **`settingsAt(lastFeed.timestamp)`** (or the feed's own timestamp for per-feed verdicts), **never `Date.now()`**; status stays frozen at `lastFeed.timestamp`.
- WHO > 7-day check and the ≤ 105 % `intakeReadyAt` rule take the replayed `dateOfBirthMs` / `sex` / thresholds / preferred bottle as inputs, with no other change.
- Live screens read current values exactly as today. Read-only `GET /api/settings/history`.

### 3.5 Seed and reconcile
- **Seed:** at first start of 1.1.57, if the file is missing, append one `kind: "snapshot", source: "seed"` entry from current settings, `effectiveFrom` = deploy time. History before that is **unknown**; `settingsAt` flags `approximate`.
- **Reconcile:** on every startup, if `settingsAt(now)` ≠ current `settings.json` on any logged key (restore from an older backup, crash between append and write, manual edit), append a `kind: "snapshot", source: "reconcile"` entry.

### 3.6 DATA_DIR
Today the defaults differ: `server-store.ts:8` `../../data` (relative to cwd), `server-weights.ts:5` `./data`, `start.js:17` hard-sets `/home/node/workspace/agents/agent-app-dev/data`. In dev without `DATA_DIR`, feeds/settings and weights land in **different** directories.
Change: one shared `src/lib/data-dir.ts` → `process.env.DATA_DIR || path.join(process.cwd(), 'data')`, used by server-store, server-weights and the history file. **The env var always wins.** Log the resolved DATA_DIR once at startup.
**Production impact: none.** The production `compose.yaml` (line 35) sets `DATA_DIR=/app/data`, bind-mounted from host `/instances/milkwise-wizardly-hugle-001/data` (checked by Steve). Deploy item: **verify `DATA_DIR` stays set** in compose and check the startup log line after deploy. `start.js`'s hard-coded path should be aligned to "only set if unset" so it cannot override compose.

### 3.7 Mobile
- **Known issue (phase 1, 1.1.57):** in API mode `saveSettings` (`store.ts:119-129`) ignores `res.ok` and network errors, so an offline or failed save is lost **entirely**, both from settings and from history. In non-API mode it writes AsyncStorage only and is never logged.
- **Phase 1b** (separate small milkwise task, own version bump): show a failed save to the user (check `res.ok`, catch network errors).
- **Phase 2:** local outbox `{changedAt (phone), changes}` flushed on reconnect; the server accepts optional client `changedAt`/`effectiveFrom` (clamped ≤ server now) with `source: "mobile-offline"` (back-dated entries).

## 4. Decisions (2026-10-25, Lead, accepting MilkWise Dev review)

1. Atomic temp+rename for both history and `settings.json`; history appended first.
2. History built from an allowlist only; `targetMlPerDay` and legacy keys never enter history.
3. `v: 1` on every entry; snapshot entries supported by `settingsAt`.
4. Replay uses `settingsAt(lastFeed.timestamp)` / the feed timestamp, never `Date.now()`.
5. `settingsAt` lives in `src/lib/settingsHistory.ts`, outside `calculations.ts`.
6. Mobile offline loss documented as a known issue; phase 1b = show failed save (separate task, own bump); phase 2 = phone outbox + server accepts back-dated entries.
7. DATA_DIR: env wins; one shared default `./data` across server-store, server-weights, start.js; production unaffected (compose sets `/app/data`); deploy check = verify it stays set.
8. Tests: **Jest + ts-jest** on web (same runner as milkwise).
9. **JSONL** history, skip bad lines; startup reconcile entry when history ≠ `settings.json`.
10. Backups: none exist today; recorded as risk and dependency (§6), proposal pending Koen's decision.

## 5. Non-functional
- **Size:** ~250 B per entry; < 1 MB/year even at 10 changes/day. No pruning.
- **Migration:** none; the file is created lazily with the seed. Rollback to 1.1.56 is safe (file ignored).
- **Invariants:** water ml only; no `targetMlPerDay` persisted by this feature; `settings.json` format unchanged; derived values (D, r, WHO weight) never stored.
- **Versioning:** web 1.1.56 → **1.1.57** (`src/app/page.tsx:174`, `src/app/settings/page.tsx:10`). Mobile unchanged in phase 1.

## 6. Risk and dependency: no backups
Per Steve's check, **no backups exist** for the production data folder `/instances/milkwise-wizardly-hugle-001/data`: no cron, systemd timer, rsync or Engine backup. The only copy is a manual snapshot from **2026-10-24 16:11 CEST** (`milkwise-data-20261024-161114`).
- **Risk:** disk or volume loss destroys feeds, weigh-ins, settings and the new history; the history adds value only if it survives.
- **Dependency:** a backup proposal covering the whole `DATA_DIR` (including `settings-history.jsonl`) is **pending Koen's decision**. It does not block implementing this design, but the feature should not be considered "done" for replay purposes until backups exist.
- Reconcile (§3.5) makes a later restore from an older backup safe.
- **Decision 2026-10-25 (Koen):** no nightly backup of the production data folder for now. Production data on the Pi (bind mount `/instances/milkwise-wizardly-hugle-001/data`) has no backup; `settings-history.jsonl` and feed data are lost if that disk fails. Revisit on request.

## 7. Implementation checklist with acceptance tests

| # | Task | Acceptance test (Jest + ts-jest unless noted) |
|---|---|---|
| 1 | Add Jest + ts-jest, `npm test` script | `npm test` runs green in CI/locally |
| 2 | `src/lib/data-dir.ts`; use in server-store, server-weights; start.js sets only if unset; log at startup | with `DATA_DIR` set → used by all stores; unset → `cwd/data` for feeds, settings, weights and history |
| 3 | `src/lib/atomic-write.ts` (temp + rename) used for `settings.json` (and feeds/weights) | simulated crash after temp write leaves the old file intact and parseable |
| 4 | LOGGED_KEYS allowlist + diff in `writeSettings` (sync, history first) | changing one key → exactly one line with correct old/new; no change → no line; POST containing `targetMlPerDay` → absent from history |
| 5 | `oldUnknown` on corrupt baseline | corrupt `settings.json` + save → entry has `oldUnknown: true` |
| 6 | All writers covered, correct `source` | settings POST → `web`/`mobile` (header or UA); weights POST → `weights-sync` |
| 7 | JSONL reader skipping bad lines | file with a garbage middle line → other entries read, warning logged, file untouched |
| 8 | `settingsAt` in `src/lib/settingsHistory.ts` | before seed (`approximate`), between entries, after last; out-of-order `effectiveFrom` sorted correctly; snapshot entries applied |
| 9 | Seed on first start | missing file → one `snapshot`/`seed` line equal to current settings |
| 10 | Startup reconcile | history older than `settings.json` → one `reconcile` snapshot appended; equal → nothing appended |
| 11 | `GET /api/settings/history` | returns parsed entries, sorted |
| 12 | Replay wiring (PR #3 zones history) uses `settingsAt(lastFeed.timestamp)` | grep/test: no `Date.now()` in the replay path; zone replay before/after a preferred-bottle change uses the right value |
| 13 | Version bump to 1.1.57 | both version strings show 1.1.57 |
| 14 | Deploy check (manual) | compose still sets `DATA_DIR=/app/data`; startup log shows `/app/data`; seed line present after first start |
| 15 | (phase 1b, milkwise, separate) failed-save UI + bump | offline save shows an error; online save unchanged |

## 8. Open questions
1. Log weigh-in edits/deletes too (`weights-history.jsonl`, `{changedAt, op, id, old, new}`)? Recommended yes.
2. Allow back-dating `effectiveFrom` in the UI, or only via manual entry?
3. Seed known past changes by hand (e.g. preferred 90 → 120, ml/kg/day changes) as `source: "manual"`?
4. Log `weightKg` at all, given it is mostly synced from weigh-ins?
5. Should mobile show "settings changed here" markers on its timeline/history?
