# Design

This folder records design decisions **before** code changes. Each document is a dated decision record or proposal (`YYYY-MM-DD-<slug>.md`) with a status: `For Design Review`, `Decided`, `Superseded`.

It covers both MilkWise codebases:
- `koenswings/baby-milk-tracker` — Next.js web app (this repo)
- `koenswings/milkwise` — React Native / Expo (EAS builds)

## Core invariants

Any change must preserve these unless a decision record here explicitly changes them.

1. **Status is frozen at `lastFeed.timestamp`.** The displayed smoothed status is computed at the last feed, not live.
2. **WHO weight model only if the latest weigh-in is >7 days old.** If the latest weigh-in is ≤7 days old (measured from start of today), the measured weight is used.
3. **Ghost markers are in ascending order.** Smaller bottle sizes never show a later ghost time than larger ones (running max over sizes sorted ascending).
4. **`intakeReadyAt` ≤105%.** "Now" is only returned if giving the bottle keeps smoothed intake ≤ 105% of the daily target.
5. **Volume is stored as water ml only.** `Feed.volume` is water ml; conversion to milk ml (`waterToMilk`) happens in calculations only.
6. **`targetMlPerDay` on `Feed` is deprecated and never written.** Legacy entries may contain it; it is ignored on read.
7. **Version bump for any user-facing change.** Web: `APP_VERSION` in `src/app/settings/page.tsx` and the label in `src/app/page.tsx`. Mobile: `expo.version` and `ios.buildNumber` in `app.json` (and Android `versionCode` if added).

## Index

| Date | Document | Status |
|---|---|---|
| 2026-10-20 | [Remove `targetMlPerDay` write in milkwise](2026-10-20-remove-targetMlPerDay-write.md) | Decided |
| 2026-10-20 | [Reconcile the two `calculations.ts` copies](2026-10-20-calculations-reconciliation.md) | For Design Review |
| 2026-10-20 | [Status card calculation (24h intake, %, ±ml)](status-calculation.md) | Documentation |
