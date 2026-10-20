# Reconcile the two `calculations.ts` copies

- **Date:** 2026-10-20
- **Status:** For Design Review (PROPOSAL)
- **Repos affected:** `koenswings/baby-milk-tracker`, `koenswings/milkwise`

> No behaviour change without review. Any user-visible change resulting from this needs version bumps in the affected app(s) (invariant 7).

## Current state (surveyed 2026-10-20)

Both repos have `src/lib/calculations.ts`; the files differ (web 648 lines, mobile 581 lines).

| Area | Web (`baby-milk-tracker`) | Mobile (`milkwise`) |
|---|---|---|
| Imports | `@/types` (incl. `NextFeedResult`), `WeightEntry`, `dailyTargetAtTime` from `@/lib/weights` | `../types` (no `NextFeedResult`), no weights import |
| `smoothedEffective()` | Present (returns milk ml + bottles) | Absent |
| Predictor 3 `findTargetAwareNext()` | Present (binary search for T* where smoothed(T*) = target − bottle; falls back to `lastFeed.timestamp` when underfed; capped at `standardNext + maxCorrectionMs`) | Absent |
| `ghostIntakeReadyAtMs()` | Lives in `src/components/cards/CanTakeCard.tsx` | Exported from `calculations.ts` |
| Shared logic (≤105% check, 7h credit window, `strict24hTotal`, `periodTotal`) | Same | Same |

Related difference outside `calculations.ts` — **WHO null-prediction fallback** when the latest weigh-in is >7 days old and `predictWeightKg()` returns null:
- Web (`src/app/page.tsx`): keeps `settings.weightKg`.
- Mobile (`src/screens/DashboardScreen.tsx`): uses the latest measured weight. (Mobile also uses the measured weight when DOB/sex are missing; web only enters the weight logic at all when DOB, sex and ≥1 weight exist.)

## Proposal

1. **One canonical `calculations.ts`**, byte-identical in both repos. Platform-specific bits (import paths) need resolving, e.g. relative imports in both or a shared path alias.
2. **Move `ghostIntakeReadyAtMs` into `calculations.ts` on web**, matching mobile.
3. **Decide whether mobile adopts Predictor 3** (`findTargetAwareNext`) and `smoothedEffective`, or whether they are removed/kept web-only (which conflicts with byte-identity).
4. **Unify the WHO null fallback** — recommendation: use the latest **measured** weight (mobile behaviour), extracted into a shared `effectiveWeight` helper.
5. **Shared golden-value test suite** (fixed feeds/settings/weights → expected outputs) run in both repos. Neither repo has a test runner yet, so one needs adding.
6. **CI check that the files are byte-identical** (e.g. a workflow comparing a hash against the other repo's file on `main`).

## Open questions for reviewers

- Which repo is the source of truth for `calculations.ts` (or should it move to a shared package / git submodule instead of copying)?
- Does mobile adopt Predictor 3? If yes, what UI shows it; if no, does web keep it?
- Is the measured-weight fallback correct, or should a null prediction surface a warning?
- Should the effective-weight selection logic itself move into the shared file?
- Test runner choice per repo (Jest/Vitest) and where the golden fixtures live.
- How does the byte-identity CI check access the other repo (public raw URL vs token)?
