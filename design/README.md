# Design

This folder holds the MilkWise design documentation. Design decisions are recorded here **before** code changes. The original design docs were imported in PR #1 from `agent-app-dev/proposals/milkwise` (c73c00e). New decisions are dated records or proposals (`YYYY-MM-DD-<slug>.md`) with a status: `For Design Review`, `Decided`, `Superseded`.

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

### Core design
| Document | Status | Summary |
|---|---|---|
| [next-session-predictor-design-v3.md](next-session-predictor-design-v3.md) | Current | **Main formula spec:** smoothed intake / bottle credit, target, standard interval, stomach model, Next Feed, Should Take, Status card. Includes the 2026-10-20 status-display addendum (§12). |
| [weight-compensation-design.md](weight-compensation-design.md) | Implemented | WHO LMS weight prediction; measured weight if weigh-in ≤7 days old |
| [data-architecture.md](data-architecture.md) | Reference | Data files (feeds/settings/weights.json), constants, derived quantities, frozen-at-last-feed principle |
| [next-session-predictor-design-v2.md](next-session-predictor-design-v2.md) | Archived | Previous predictor design (Predictors 1–3) |
| [next-session-predictor-summary.md](next-session-predictor-summary.md) | Archived | Summary of v2 |

### Audits
| Document | Status | Summary |
|---|---|---|
| [code-verification-audit.md](code-verification-audit.md) | Partial match | Equations of `milkwise-calculation-audit.pdf` (EQ-1..12) vs code |
| [sonnet-review-calculation-audit.md](sonnet-review-calculation-audit.md) | Review | Technical review of the calculation audit vs v3 design |

### Product, build & data
| Document | Status | Summary |
|---|---|---|
| [milkwise-commercialisation.md](milkwise-commercialisation.md) | In progress | Mobile app commercialisation plan, features, tiers |
| [milkwise-pricing-analysis.md](milkwise-pricing-analysis.md) | — | Pricing options and income estimates |
| [milkwise-ios-android-build.md](milkwise-ios-android-build.md) | — | EAS / App Store / Play build guide |
| [milkwise-mobile-data-analysis.md](milkwise-mobile-data-analysis.md) | — | Mobile data storage and sync analysis |

### Decision records & proposals (2026-10-20)
| Document | Status |
|---|---|
| [2026-10-20-remove-targetMlPerDay-write.md](2026-10-20-remove-targetMlPerDay-write.md) | Decided |
| [2026-10-20-calculations-reconciliation.md](2026-10-20-calculations-reconciliation.md) | For Design Review |
