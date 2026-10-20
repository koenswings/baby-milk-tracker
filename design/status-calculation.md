# Status card calculation (24h intake ml, %, ±ml)

- **Date:** 2026-10-20
- **Status:** Documentation of current behaviour (web 1.1.56 `e72acd1`, mobile 1.2.9 `e0020e3`). No change proposed.

The status card's "24h intake · at last feed" column shows three numbers: intake ml, % of target, and ±ml vs target. Both apps compute them the same way.

## Formula

1. **Time point T = timestamp of the latest feed** (or now if there are no feeds). The status is frozen there (invariant 1).
   Web `src/app/page.tsx:125-127,153`; mobile `src/screens/DashboardScreen.tsx:405-410`.
2. **Water → formula ml** with `waterToMilk(volume)` (`src/lib/calculations.ts:58-81` web / `:57-80` mobile). It interpolates linearly in this manufacturer table and extrapolates the first/last segment outside it:

   | water ml | 30 | 60 | 90 | 120 | 150 | 180 | 210 |
   |---|---|---|---|---|---|---|---|
   | formula ml | 35 | 70 | 100 | 135 | 170 | 200 | 240 |

3. **Target:** `dailyTargetMl = effectiveWeightKg × mlPerKgPerDay` (formula ml), `hourlyRate = dailyTargetMl / 24` (`deriveSettings`, web `:85-91` / mobile `:84-90`).
   - Effective weight is the latest weigh-in if `startOfToday − weighIn ≤ 7 days`, otherwise the WHO prediction `predictWeightKg(weights, DOB, sex, startOfToday)` (invariant 2).
   - Web `page.tsx:130-151`, mobile `DashboardScreen.tsx:357-384`.
   - Fallbacks differ between the apps; see [calculations reconciliation](2026-10-20-calculations-reconciliation.md).
4. **Intake ml = `smoothedEffective(feeds, hourlyRate, preferredBottleWaterMl, T).totalMl`** (web `:119-132`, mobile `:182-195`). This is the sum over all feeds of `bottleCredit(age, waterToMilk(volume), hourlyRate)` (web `:97-108`):
   - age ≤ 24 h → full formula ml (this includes negative ages, i.e. feeds after T)
   - age > 24 h → `max(0, ml − hourlyRate × (age − 24))`, so an old bottle decays linearly at the target rate.
   - Call sites: web `page.tsx:157-161`, mobile `DashboardScreen.tsx:412-414`.
   - Not to be confused with `strict24hTotal` (hard 24 h cut-off, "Strict 24h" card, `:111-116`). The 7 h window in `stomachLoad` (`:406-413`) belongs to the stomach gauge only.
5. **pct = intakeMl / dailyTargetMl × 100** (web `page.tsx:164`, mobile `DashboardScreen.tsx:415`).
6. **Deficit/surplus ml = `|round(pct/100 × D − D)|`**, prefixed − or +. When `|pct − 100| < 1`, the text "on target" replaces it.
   Web `src/components/cards/StatusCard.tsx:188-189,221-223` (`CombinedB`, rendered at `:628`); mobile `DashboardScreen.tsx:120-121,163`.
7. **Rounding (display only):** ml `Math.round`, pct `Math.round`, delta `Math.round` as above. All internal values are unrounded. Colour and label use `|pct−100|` against `yellowThresholdPct` / `redThresholdPct` (`StatusCard.tsx:30-47`).

## Verified worked example — 2026-10-20

Snapshot `milkwise-data-20261020-111441` (taken 11:14:41 CEST), web 1.1.56. The app displayed **1245 ml · 90% · −137 ml**.

- T = last feed 2026-10-20 11:04 CEST.
- Latest weigh-in 2026-09-24 15:09 CEST, 9.09 kg, which is more than 7 days old → WHO prediction **9.215 kg** (female, DOB 2026-04-14).
- D = 9.215 × 150 = **1382.3 ml/day**; hourlyRate = 57.6 ml/h.

| Feed (CEST) | water | formula | age at T | credit |
|---|---|---|---|---|
| 19/10 07:00 | 120 | 135 | 28.07 h | max(0, 135 − 57.6×4.07) = 0 |
| 19/10 12:30 | 120 | 135 | 22.57 h | 135 |
| 19/10 14:30 | 120 | 135 | 20.57 h | 135 |
| 19/10 17:03 | 180 | 200 | 18.02 h | 200 |
| 19/10 19:43 | 120 | 135 | 15.35 h | 135 |
| 19/10 22:15 | 90 | 100 | 12.82 h | 100 |
| 20/10 02:10 | 120 | 135 | 8.90 h | 135 |
| 20/10 05:05 | 120 | 135 | 5.98 h | 135 |
| 20/10 08:25 | 120 | 135 | 2.65 h | 135 |
| 20/10 11:04 | 120 | 135 | 0.00 h | 135 |
| **Total** | | | | **1245.0** |

pct = 1245 / 1382.3 = 90.07% → **90%**; delta = round(1245 − 1382.3) = **−137 ml**.
Web `calculations.ts`, mobile `calculations.ts` and an independent reimplementation all give exactly these values.

## Checker

`/workspace/milkwise-verify/verify_status.ts` on the agent box (`npx tsx verify_status.ts <dataDir|backup.tar|db.json> [--now ISO]`). It runs the independent formula plus vendored copies of both repos' `calculations.ts` / `whoGrowth.ts`, and replicates each app's weight selection. It is not committed here because it vendors copies of both repos' sources. It should become the golden-value test suite proposed in the reconciliation doc.
