# Feeding zones instead of point-in-time markers

**Status:** Brainstorm / for discussion — no code change
**Date:** 2026-10-25 · **Author:** Grok Bot for Koen · **Applies to:** web (`baby-milk-tracker` 1.1.56, `e72acd1`) and mobile (`milkwise` 1.2.9, `e0020e3`)
> **Correction (2026-10-25, credit: Koen).** The first version of this doc claimed that *when the baby is behind there are no real zones — every size lands under 100 %*. Koen challenged this ("a 90 bottle at the time the stomach allows it could push her to 103 %"), and he is right: being behind at the last feed (I < D) says nothing about I(S)+B at the stomach-fit time S. The ahead/behind split has been replaced by one per-bottle rule (§3.2–3.4), and a scan of the real feed history (§4.3) shows real zones while behind after **~24 % of the 'behind' feeds**. The 20/10 example is now labelled as a case where all zones *happened* to collapse.

**Related:** [next-session-predictor-design-v3.md](next-session-predictor-design-v3.md) §4, §7, §8.7 · [sonnet-review-calculation-audit.md](sonnet-review-calculation-audit.md) · Notion *!Milkwise* "Milk Balance" / Predictor 3

All times are Europe/Brussels. Numbers were produced with the real web `calculations.ts` (vendored copy, byte-identical to `main`) by `verify_zones.ts` (see §9).

---

## 1. Problem

The Feeding Timeline (`src/components/cards/CanTakeCard.tsx`) shows one **point in time** per bottle size and mixes two different thresholds:

| What | Where | Threshold |
|---|---|---|
| Green "Give now" | `calculations.ts:491` (`intakeReadyAtMs`) | giving the bottle keeps status **≤ 105 %** |
| Future (rose/teal) markers | `calculations.ts:495-506` (binary search) | intake has decayed so the bottle lands at **100 %** |
| Grey "ghost" markers | `CanTakeCard.tsx:57-80, 134-160, 304-332` | **100.5 %** (display rounding), measured from the last feed |

Consequences observed on 24/10 (see the 2026-10-24 timeline analysis):

- *"60 now, 30 at 16:08, 60 twice"* — the advised size gets both a ghost and a green marker (`:306-322`); fitting sizes below green are not noise-cut (v3 §7.2).
- The future markers say 90 at 17:04 and 120 at 17:27, but green silently jumps to **90 at 16:09** and **120 at 16:30**, because green uses 105 % and the markers use 100 %.
- The mismatch matters whenever a bottle can land above 100 % at the moment it fits the stomach — usually when ahead, but also in roughly a quarter of the *behind* situations (§4.3). Only when every zone collapses (e.g. 20/10, §4.2) do all three rules coincide.

Koen's direction (2026-10-25): 100 % is the most consistent rule, drop the ghosts — but first explore **zones**.

## 2. Proposal in one paragraph

For every bottle size X, show a **zone in time** rather than a point: the zone **opens** when giving X would land the status at **105 %** (the top of the green band, and never before the stomach can hold X) and **closes** when giving X would land at exactly **100 %** (the ideal). Inside the zone, X is a good choice; the close is the "ideal" moment (= today's 100 % marker). Zones of neighbouring sizes **overlap**, so at most moments two sizes are acceptable; the app highlights the **largest size whose zone contains now**.

## 3. Maths

Notation (all in *formula* ml): D = daily target (`dailyTargetMl`), r = D/24 (`hourlyRate`), I(T) = `smoothedAtTime(feeds, r, T)` = Σ `bottleCredit(age, milk, r)`, B = `waterToMilk(X)`.

### 3.1 I(T) is non-increasing between feeds

`bottleCredit` (`calculations.ts:97-108`) is `milk` for age ≤ 24 h and `max(0, milk − r·(age−24))` after. Each term is constant then linearly decreasing then 0, so I(T) is **continuous, piecewise linear and non-increasing** as long as no new feed is added. Its slope is `−r · n(T)` where n(T) = number of feeds that are older than 24 h but still have credit left (usually 1, sometimes 2 → steeper; 0 → flat plateau).
Numerically verified: max rise of I over one-minute steps across 10 h = **0.000000 ml** in both snapshots.

### 3.2 Zone of bottle X — one rule, no ahead/behind split

```
L(T)     = I(T) + B                                  formula in the stomach-free "status after giving X at T"
S        = stomachFits(X)  = stomachReadyAtMs(...)   (calculations.ts:442, cap = steady-state peak × 1.1)
t105     = first T ≥ now with L(T) ≤ 1.05·D
t100     = first T ≥ now with L(T) ≤ D
open(X)  = max(S, t105)
close(X) = t100
```

**Claim.** With no new feed, X has a real zone `[open, close)` **iff `L(S) > D`, i.e. `I(S) + B > D`**. Otherwise the zone is *collapsed*: X is available from S and lands at `L(S)/D ≤ 100 %`, and the bottle can never land at 100 % or above afterwards.

**Proof.** By §3.1, I — hence L — is non-increasing in T. (i) If L(S) > D, then t100 > S (L has not yet reached D at S), and t105 ≤ t100 (a non-increasing function reaches 1.05D before D), so open = max(S, t105) < t100 = close: a non-empty interval, on which D < L ≤ 1.05D. If moreover L(S) ≤ 1.05D, then t105 ≤ S and the zone **opens at S** ("fits the stomach and already lands within 105 %"). If L(S) > 1.05D, it opens later, at t105. (ii) If L(S) ≤ D then t100 ≤ S ≤ open, so the interval is empty; for every T ≥ S, L(T) ≤ L(S) ≤ D. ∎

**Consequence for 'behind'.** "Behind" (I(t_feed) < D right after the last feed) only means I < D; it does not bound I(S) + B. A real zone despite being behind needs the remaining deficit at S to be smaller than the bottle: `D − I(S) < B`. Because I is **flat** while no feed is older than 24 h (n = 0 in §3.1), the deficit often does not grow during the stomach wait, so this happens regularly.

### 3.3 Overlap condition (exact, slope-independent)

For B1 < B2, zone 2 opens when I ≤ 1.05D − B2; zone 1 closes when I ≤ D − B1. Since I is non-increasing, zone 2 opens **before** zone 1 closes iff

```
1.05·D − B2  >  D − B1      ⇔      B2 − B1  <  0.05·D
```

This is exact in *intake level*, so it holds regardless of the piecewise slope (1 or 2 decaying feeds). Caveats: (i) on a plateau (n = 0) levels hold for a while, so a zone can last longer but the overlap test is unchanged; (ii) the stomach can delay `open(X2)` past `close(X1)` — then overlap is lost (that is what happens to 150 on 24/10).

With D ≈ 1390 ml, 0.05·D ≈ **69.5 ml** (69.1 on 20/10). Formula table 35, 70, 100, 135, 170, 200, 240:

| Pair (water) | ΔB (formula) | Overlap? |
|---|---|---|
| 30–60 | 35 | yes |
| 60–90 | 30 | yes |
| 90–120 | 35 | yes |
| 120–150 | 35 | yes (intake), but stomach usually cancels it |
| 150–180 | 30 | yes (intake) |
| 180–210 | 40 | yes (intake) |
| 30–90 | 65 | yes, barely (~3 min on 24/10) |
| 60–120 | 65 | yes, barely (~4 min) |
| 90–150 | 70 | **no** (70 > 69.5) |
| 120–180 | 65 | yes (intake) |
| 150–210 | 70 | **no** |

So **every neighbouring pair overlaps** and some next-but-one pairs overlap a few minutes. This is weight-dependent: at D < 700 ml (≈ 4.7 kg) the 35-ml steps stop overlapping; for a bigger baby overlaps grow. Koen's intuition ("while 90 goes from 105 now to 100 later, 120 kicks in at 105") is **mathematically correct**.

### 3.4 Behind vs ahead — only a matter of which case of §3.2 applies

There is no separate behind rule. Per bottle: real zone if `I(S)+B > D`, collapsed otherwise. When behind, small bottles and long stomach waits tend to collapse; bottles with `B > D − I(S)` get a real zone exactly as in the ahead case.
Note on v3 §8.7: for a *collapsed* bottle, waiting indeed never helps (L only decreases), so §8.7's goal "wait until X lands at 100 %" is unreachable for that bottle; for a non-collapsed bottle the 100 % time is simply `close(X)`. Either way §8.7's algorithm equals the 100 % rule.

### 3.5 Sizes above preferred + 1, stomach cap

`canTakeProgression` shows sizes up to preferred + 1 (120 → 150). 180 (200 ml) and 210 (240 ml) exceed `stomachCapMilk × 1.1` (≈ 185 ml); `stomachReadyAtMs` then requires near-empty stomach (`:465-470`). Proposal: keep the preferred + 1 ceiling; compute zones only for those sizes.

## 4. Worked examples (real snapshots)

### 4.1 Ahead — 24/10, after 120 at 14:30 (status 105.1 %, D = 1390.2, r = 57.93 ml/h)

| Size | Stomach fits | Lands 105 % | Lands 100 % | Zone |
|---|---|---|---|---|
| 30 (35) | 14:36 | 15:08 | 16:12 | **15:08–16:12** |
| 60 (70) | 14:59 | 15:44 | 16:34 | **15:44–16:34** |
| 90 (100) | 15:25 | 16:09 | 17:05 | **16:09–17:05** |
| 120 (135) | 16:11 | 16:30 | 17:28 | **16:30–17:28** |
| 150 (170) | 17:54 | 17:06 | 17:46 | collapsed: from 17:54, lands 98.8 % |

Overlaps: 30/60 28 min, 60/90 25 min, 90/120 35 min, 30/90 3 min, 60/120 4 min. The 100 % column matches Koen's checks (90 at 17:05, 120 at 17:27/28, 150 at 17:54).

![Intake curve with per-size bands and zones](img/zones-a-intake-curve.png)

*Figure A — I(T) as % of D. Bottle X lands in [100 %, 105 %] while I(T) is inside X's band [D−B, 1.05D−B]. Bands of neighbours overlap vertically ⇒ zones overlap in time.*

![Gantt — ahead](img/zones-b-gantt-ahead.png)

*Figure B — zones per size, ahead case. Hatched = stomach full; solid = zone; pale tail = after close (lands < 100 %).*

### 4.2 Behind, all zones happened to collapse — 20/10, after 120 at 11:04 (status 90.1 %, −137 ml, D = 1382.3)

| Size | Stomach fits | Lands at that moment | Zone |
|---|---|---|---|
| 30 | 11:08 | 92.6 % | collapsed (under target) |
| 60 | 11:31 | 95.1 % | collapsed |
| 90 | 11:58 | 97.3 % | collapsed |
| 120 | 12:44 | 98.9 % | collapsed |
| 150 | 14:28 | 94.1 % | collapsed |

Here every size collapses, **not because she is behind but because the deficit is larger than every bottle at its stomach time**: D − I(S) ≥ 137 ml vs B = 35…135 ml for 30…120; for 150 (170 ml) the 3 h 24 min stomach wait lets I decay further (14:28: deficit ≈ 270 ml), so it also lands under 100 % (94.1 %).

![Gantt — behind](img/zones-c-gantt-behind.png)

*Figure C — 20/10: a behind case in which every zone collapsed (deficit > bottle at stomach-fit time).*

### 4.3 Behind with real zones — real feed history scan

`scan_behind_zones.ts` replays every feed since data start (31/05/2026, 1142 feeds; first 24 h skipped), with the weight/D valid on that day and the current preferred size 120 (so sizes 30–150). For each feed whose post-feed status was < 100 %, it checks each size for `I(S)+B > D` with S before the actual next feed.

| Snapshot | Feeds evaluated | Behind after feed | Behind *with* ≥1 real zone | Share |
|---|---|---|---|---|
| 24/10 | 1131 | 847 | **203** | 24.0 % of behind · 17.9 % of all |
| 20/10 | 1094 | 827 | 202 | 24.4 % · 18.5 % |

Real zones by size (24/10): 30: 94 · 60: 163 · 90: 186 · 120: 149 · 150: 3. (Caveat: preferred size was not always 120 historically.)

Example 1 — **16/10 17:01, 120 given, status 98.2 % (−24 ml)**: 30 zone 17:11–18:11 (lands 100.8 % when it fits), 60 17:34–18:48 (103.3 %), **90 18:08–19:19 (lands 105.5 % at 18:00 → opens at 105 % at 18:08 and closes at 100 %)**, 120 18:46–19:55 (104.8 %), 150 collapsed (99.9 %). Actual next feed 19:18 — inside the 90 and 120 zones. This is exactly Koen's scenario.

Example 2 — **22/10 19:15, 70 ml, status 96.0 % (−56 ml), intake flat for the next hour**: 60 zone 19:42–20:44 (lands 101.0 %), 90 20:08–21:15 (103.2 %); 30 and 150 collapsed; 120's zone (lands 104.0 % at 20:54) starts after the actual next feed at 20:45.

![Gantt — behind with real zones](img/zones-e-gantt-behind-real-zone.png)

*Figure E — real data 16/10: behind after the feed, yet 30/60/90/120 have real zones.*

## 5. UI options

![App mockup](img/zones-d-app-mockup.png)

*Figure D — mockup at 16:20 on 24/10: bars per size, now line, green = largest size whose zone contains now (90); 60 grey (also in zone); 30 hidden (zone closed); 120 upcoming; 150 shown as a stomach point.*

Rules proposed for discussion:

1. **Green = largest size whose zone contains now** (lands between 100 and 105 %). If none is in zone: if some sizes are collapsed and fit now → largest of them, labelled "under target"; otherwise nothing green and the next opening is shown.
2. **Noise-cut**: hide sizes whose zone is past, and optionally smaller sizes in zone (show only green + upcoming).
3. **Labels**: bar from open to close; label `90 · 16:09–17:05`, with the close marked as "ideal".
4. **No ghosts** — the bar's left end already says "since when".
5. Alternative compact view: keep points but show only the *ideal* (close) time, with a small "ok from 16:09" sub-label.

## 6. Edge cases

- **Stomach-limited**: open = stomachFits; if ≥ close → collapsed zone (show as a point with "lands p %").
- **Behind**: no special case — per bottle, real zone or collapsed (§3.2). If *all* fitting sizes are collapsed, possibly show "behind — give the largest size that fits".
- **Right after a feed**: everything is in the future; first zone opens when the stomach allows and intake ≤ 1.05D − B.
- **Deep overfeed**: zones can be > 48 h away → reuse the 48 h cap from `intakeReadyAtMs` and show "later".
- **Plateau (n = 0)**: zones stretch; no change to rules.
- **DST / time zone**: all arithmetic is in epoch ms, so zones are exact across the DST switch (25/10 03:00 → 02:00 today); only labels and the hour ruler use local time (`fmtTime`, `fmtHour`). Check the ruler (`CanTakeCard.tsx:241-245` assumes `t % HOUR_MS === 0` is a full hour, which is only true in UTC-aligned offsets — fine for whole-hour offsets).
- **Weight/target changes** (WHO weight at `startOfToday`): D changes at midnight → zones shift; recompute every render (already happens every minute, `page.tsx:109`).

## 7. Impact on invariants

- "Give now never leads to > 105 %" (`calculations.ts:491`) becomes the **zone open bound** — same guarantee, now explicit and documented.
- "Markers are 100 % times" (v3 §7.1, Notion Predictor 3) becomes the **zone close**.
- Ordering (v3 §7.2): open and close are both monotonic in B (larger B needs lower I), except the stomach may push a bigger size later — still monotonic since stomachFits is also increasing in B. The ascending clamp (`CanTakeCard.tsx:149-158`) becomes unnecessary.

## 8. Code impact (when/if adopted)

- `calculations.ts` (web `:477-551`, mobile `:417-480`): add `intakeZone(feeds, B, r, D, now) → { openMs, closeMs, landingAtOpenPct, state }`; `canTakeProgression` returns zones; `fitsNow` = `open ≤ now < close`, or collapsed and `S ≤ now`.
- Remove `ghostIntakeReadyAtMs` (web `CanTakeCard.tsx:57`, mobile `calculations.ts:202`) and the ghost map (web `:134-160`, mobile `DashboardScreen.tsx:215-229`).
- Rendering: web `CanTakeCard.tsx:303-345`, mobile `DashboardScreen.tsx:257-269` → bars.
- Docs: v3 §7 rewritten; §8.7 rewritten (see §3.4).

## 9. Reproduction

Verifier (outside the repo, read-only): `/workspace/milkwise-verify/verify_zones.ts <db> <ISO time> <out.json>`; charts by `zones/plot.py` and `zones/plot_behind_real.py`; history scan `scan_behind_zones.ts <db> <out.json>`. Snapshots `milkwise-data-20261024-161114` (ahead, ref 14:31) and `milkwise-data-20261020-111441` (behind, ref 11:05).

## 10. Open questions for Koen

1. Upper bound: 105 % (= yellow threshold) or something tighter such as 102.5 %? It controls zone width and overlap (overlap iff ΔB < (upper − 1)·D).
2. Green when two zones overlap: largest size (proposed), or the one closest to its ideal close?
3. Behind case: show "under target" sizes as green, or a different colour?
4. Show smaller in-zone sizes (grey) or hide them (noise-cut)?
5. Do we keep preferred + 1 as the ceiling for zones?
6. Bars (Figure D) or points with "ok from" sub-labels?
