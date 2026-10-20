# Reconcile the two `calculations.ts` copies

- **Date:** 2026-10-20 (corrected same day)
- **Status:** For Design Review (PROPOSAL)
- **Repos affected:** `koenswings/baby-milk-tracker`, `koenswings/milkwise`

> No behaviour change without review. Any user-visible change resulting from this needs version bumps in the affected app(s) (invariant 7).

## Current state (surveyed 2026-10-20; web `e72acd1`, mobile `e0020e3`)

Both repos have `src/lib/calculations.ts`; the files differ (web 648 lines, mobile 581 lines).

> Correction: an earlier version of this doc said `smoothedEffective` was web-only. That was wrong. It exists in both (web `:119`, mobile `:182`); it just sits at a different position in each file.

| Area | Web (`baby-milk-tracker`) | Mobile (`milkwise`) |
|---|---|---|
| Imports | `@/types` (incl. `NextFeedResult`), `WeightEntry`, `dailyTargetAtTime` from `@/lib/weights` | `../types` (no `NextFeedResult`), no weights import |
| `nextFeedTime()` (`:216`) + internal Predictor 3 `findTargetAwareNext()` | Present | Absent |
| `ghostIntakeReadyAtMs()` | In `src/components/cards/CanTakeCard.tsx` | Exported from `calculations.ts` (`:202`) |
| Shared logic (`waterToMilk`, `bottleCredit`, `smoothedEffective`, `strict24hTotal`, `stomachLoad`, ≤105% check, `periodTotal`) | Same | Same |

`whoGrowth.ts` is byte-identical in both repos.

### Differences outside `calculations.ts` that can change displayed numbers

1. **Weight selection / fallback** (web `src/app/page.tsx:130-151`, mobile `src/screens/DashboardScreen.tsx:357-384`):
   - Web only looks at weigh-ins if `dateOfBirthMs` **and** `sex` are set **and** there is at least one weigh-in. Otherwise it uses `settings.weightKg`, even if a recent weigh-in exists. Mobile uses the latest weigh-in whenever one exists.
   - If the weigh-in is more than 7 days old and `predictWeightKg()` returns null: web keeps `settings.weightKg`; mobile uses the latest measured weight.
2. **Mobile first render:** `effectiveWeightKg` state starts at a hardcoded `6.27` (`DashboardScreen.tsx:347`) until `load()` resolves.
3. **Timezone:** "start of today" (`setHours(0,0,0,0)`) uses the runtime's local timezone: the browser for web, the device for mobile. Near midnight, or when device timezones differ, the >7-day rule can switch on different days.
4. **`DATA_DIR` defaults on the web server:** `src/lib/server-store.ts:8` (feeds, settings) defaults to `../../data`; `src/lib/server-weights.ts:5` (weights) defaults to `./data`. If `DATA_DIR` is unset, weights may be read from a different directory than feeds and settings. Mobile reads everything through the web API (`milkwise src/lib/store.ts`), so it inherits whatever the server returns.

On the 2026-10-20 snapshot none of these applied: all implementations agree (see [status-calculation.md](status-calculation.md)).

## Proposal

1. **One canonical `calculations.ts`**, byte-identical in both repos (resolve import paths, e.g. relative imports in both).
2. **Move `ghostIntakeReadyAtMs` into `calculations.ts` on web**, matching mobile.
3. **Decide whether mobile adopts Predictor 3** (`nextFeedTime` / `findTargetAwareNext`, which needs `weights.ts`), or whether it is dropped from web.
4. **Unify weight selection** in a shared `effectiveWeight(settings, weights, startOfToday)` helper in the canonical file. Recommendation: fall back to the latest **measured** weight (mobile behaviour) both when the prediction is null and when DOB/sex are missing.
5. **Fix the `DATA_DIR` default mismatch** (one constant for both server modules).
6. **Shared golden-value test suite** run in both repos (neither repo has a test runner yet). The checker in `/workspace/milkwise-verify` (see status-calculation.md) is a starting point.
7. **CI check that the files are byte-identical.**

## Open questions for reviewers

- Which repo is the source of truth for `calculations.ts` (or a shared package / submodule instead)?
- Does mobile adopt Predictor 3? If not, does web keep it?
- Is the measured-weight fallback correct, or should a null prediction or missing DOB/sex surface a warning?
- Should "start of today" be pinned to a configured timezone (e.g. Europe/Brussels) instead of the device's?
- Test runner choice per repo and where golden fixtures live.
- How does the byte-identity CI check access the other repo?
