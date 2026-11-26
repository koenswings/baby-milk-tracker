# Live rule settings and WHO weight anchored on the latest weigh-in

- **Date:** 2026-11-26
- **Status:** Approved by Koen (product decisions) + MilkWise Design Review, 26 Nov 2026; implementation pending
- **Author:** MilkWise Lead for Koen
- **Repos:** `koenswings/baby-milk-tracker` (web) and `koenswings/milkwise` (mobile)
- **Builds on:** `feat/feeding-zones` (PR [#7](https://github.com/koenswings/baby-milk-tracker/pull/7), head `944bf12`, web 1.1.61)
- **Related:** [2026-10-25-feeding-zones.md](2026-10-25-feeding-zones.md) (freeze rule refined) · [weight-compensation-design.md](weight-compensation-design.md) §2.1 (mean-of-all-z channel superseded for the estimate) · [2026-10-25-settings-history.md](2026-10-25-settings-history.md)

All times are Europe/Brussels.

## Context

On 26 Nov 2026 at 14:55, Koen lowered `mlPerKgPerDay` from 150 to 80, following a Kind & Gezin directive. The Settings page showed 80, but the main page kept 150. That is the current, intended behaviour: `frozenCalcSettings` is taken at `lastFeed.timestamp`, so a rule change after the last feed does not affect the status card or the open zone segment until the next feed is logged.

Relevant code on `feat/feeding-zones` (`944bf12`):

- web: `src/lib/zoneSegments.ts:124-151` (`frozenCalcSettings`), `src/app/page.tsx`
- mobile: `src/lib/zoneSegments.ts`, `src/screens/DashboardScreen.tsx`
- both: `src/lib/settingsHistory.ts` (`settingsAt`, `settingsForFeed`)

Koen decided at 16:43 that rule changes should apply immediately, and asked for the change to go through design review. At 16:48 he also decided that a new weigh-in should apply immediately ("Yes").

At the same time he reported that the calculated weight was below her last weigh-in, which is not acceptable. On the live data:

- latest stored weigh-in: **10.00 kg** on 12 Nov (z **+2.41**)
- header: **9.72 kg est.**

The cause is the current WHO channel. `estimateZChannel` (`whoGrowth.ts:96-110`) averages the z of all 17 weigh-ins (mean **+2.00**). Because Dayana has moved up a percentile recently, that average pulls the projection below the last real measurement. `effectiveWeightKg` (`calculations.ts:691-707`) has no floor, so the header can show a weight lower than the latest weigh-in.

This record is docs only. MilkWise Dev implements after it, on one implementation branch on top of `feat/feeding-zones`.

## Decisions

1. **Live rule settings.** For the open zone segment and the current status, these keys come from the latest settings (not from `settingsForFeed` at `lastFeed.timestamp`):
   - `mlPerKgPerDay`
   - `preferredBottleWaterMl`
   - `yellowThresholdPct`
   - `redThresholdPct`
   - date of birth
   - sex

   Date of birth and sex are treated as live because a change is a correction, not a scheduled rule change.

2. **Segment rule.** Each zone segment uses the rule in effect at its **end**:
   - a closed segment: the next feed's time (`settingsForFeed` at that next feed)
   - the open segment: the live settings

   The stretch since a rule change therefore already uses the new rule, and it does not redraw to the old rule after the next feed is logged. History before the last feed keeps the historical rules that applied at each segment's end.

3. **Status time stays frozen.** Status is still computed at `lastFeed.timestamp`. There is no ticking clock and no `setInterval` that reloads feeds or recalculates status against `Date.now()`. Live settings are data, loaded at page load, on screen focus, and when the app comes back to the foreground.

4. **Weight reference time.** The reference time for weight is `max(lastFeed.timestamp, latest weigh-in time)`. A weigh-in entered after the last feed therefore applies immediately. This is data only: no ticking clock. For a closed segment the end time is the next feed, which matches the segment rule in (2).

5. **WHO projection is anchored on the latest weigh-in.** Take that weigh-in's z and project forward along it. This replaces the "mean of all z" channel for the **estimate** (the function of today's `estimateZChannel`). In the live case that gives about **10.17 kg**.

6. **Floor.** `effectiveWeightKg = max(latest weigh-in, projection)`. A projection may never drop below the last real measurement. The floor does not block a real drop: after a lower weigh-in, the floor is that new lower value. This is a change in the shared `calculations.ts` block and must stay byte-identical in both repos. `whoGrowth.ts` is kept identical in both repos.

7. **The 7-day fresh rule stays.** A weigh-in that is 7 days old or less is used directly (no WHO projection). With (5), the step on day 8 becomes small and upward (about +0.1 kg at Dayana's age) instead of today's drop. Removing the 7-day rule would change an invariant and is not in scope. Outside 0–24 months there is no WHO data, so the latest measured weight is used, as today.

8. **Header z versus analytics.** The header z uses the latest weigh-in's z, so the shown z and the weight agree. The analytics chart keeps the long-run mean line as a trend marker, labelled **"average channel"**.

9. **Big cuts.** A large drop such as 150 → 80 ml/kg nearly halves the daily target while intake already drunk in the last 24 hours stays the same. Progress can jump over 100 % and the zone can go straight to red. `intakeReadyAt` can move well beyond the next day. The maths does not need extra logic: the 105 % / 100 % open and close points follow the live target. The "can take" text must use clear **"over target"** wording rather than a time two days away. Intake is fact and the target is live, so the ring and progress come from one rule. Only the timeline shows the old rule before the last feed, which follows (2).

10. **Settings number inputs.** Number fields save on blur or Enter, not while typing, and reject out-of-range values (for example a ml/kg of 1 is never valid). The web already debounces at 500 ms, but pauses while typing still save. `settings-history.jsonl` is append-only, so the junk line from 14:55:16 (150 → 1 → 80) stays.

## Invariant changes

"**Status frozen at `lastFeed.timestamp`**" is refined to:

> Status **time** is frozen at `lastFeed.timestamp`. Rule settings are live. Weight uses data up to `max(lastFeed.timestamp, latest weigh-in time)`.

Unchanged:

- volume is stored as water ml only
- `targetMlPerDay` is never written
- the `intakeReadyAt` 105 % rule for zones (open bound) is unchanged
- Classic still uses the single 100 % rule
- no ticking reload of feeds
- the 7-day fresh-weigh-in rule stays (see decision 7)

## Edge cases

- **No redraw after the next feed.** Because a closed segment takes the rule at its end, the period between the last feed and the next one keeps the live rule that was in effect then. It does not flip back to the pre-change values once it becomes history.
- **Weigh-in after the last feed.** Included immediately for the open segment and the current status, via the weight reference time in decision 4. Closed segments still end at the next feed.
- **One scale error.** Anchoring on the latest z means one bad weigh-in drives the estimate until the next one. That is accepted: the complaint is that older weigh-ins currently outvote the newest one.
- **Real drop in weight.** The floor is the latest weigh-in, so a genuine jump down is used as-is.
- **Interpolation quirks.** At a fixed z, WHO weight-for-age rises with age up to 24 months, so with decision 5 the projection should already be at or above the latest weigh-in. The floor is cheap insurance for interpolation quirks only.
- **Age outside 0–24 months.** No WHO data: use the latest measured weight, as today.
- **Big cut to ml/kg.** Status can jump to red / over 100 %. Show "over target", not a far-away ready time.
- **Out-of-range settings.** Values such as ml/kg = 1 are refused at the input. The existing junk history line is left in the append-only file; it was in effect for about a second.

## Tests

- Update `t22-frozen-calc-settings` in both repos so it matches the refined freeze rule (live rule settings apply immediately; status time stays frozen).
- New test: a rule change after the last feed is used for the open segment, and after the next feed that closed segment does not redraw to the old rule.
- New test: a weigh-in after the last feed applies immediately.
- Golden WHO cases, in both repos:
  - a percentile jump up, as in the live case (latest 10.00 kg, z +2.41; estimate must not fall below 10.00 kg and should be about 10.17 kg on 26 Nov)
  - a jump down (the new lower weigh-in is used; the floor must not hold the old higher value)
  - a single weigh-in (the estimate follows that z)
- Settings input validation: save on blur or Enter, not mid-keystroke; reject out-of-range values such as ml/kg = 1.

The shared `calculations.ts` block change is byte-identical across the two repos, checked with the existing shared-block diff. `whoGrowth.ts` stays identical in both repos.

## Versions

All of this is implemented on **one** implementation branch on top of `feat/feeding-zones`:

- web: **1.1.62**
- mobile: **1.2.16**, build **30**

MilkWise Dev starts coding after this record. The mobile EAS build is still blocked on `EXPO_TOKEN`.

Live-rule work lives in `zoneSegments.ts` and the page / screen code, plus settings input handling. The weight-anchor and floor live in the shared block of `calculations.ts` and in `whoGrowth.ts`. The rest of the shared calculations block stays byte-identical apart from the `effectiveWeightKg` change.

## Out of scope

- Any code in this PR (docs only).
- Removing or shortening the 7-day fresh-weigh-in rule.
- Switching the analytics trend line from the long-run mean to the latest z.
- Rewriting or deleting lines in the append-only `settings-history.jsonl`.
- Backup-script guards, restore of live Pi data, or any server change.
- Merging this record, or any later implementation PR, without Koen's own explicit instruction.
