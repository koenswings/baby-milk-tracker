# Remove `targetMlPerDay` write in milkwise

- **Date:** 2026-10-20
- **Status:** Decided
- **Repos affected:** `koenswings/milkwise`

## Problem

Invariant 6 says `targetMlPerDay` on `Feed` is deprecated and never written. Both repos document this
(`src/types/index.ts`: "legacy feeds.json entries may contain `targetMlPerDay`; it is ignored in all calculations";
milkwise `src/lib/store.ts:131-132` marks the migration stub as a no-op because the field "has been removed from Feed").

However, milkwise `src/screens/LogScreen.tsx` still writes it when logging a feed (line 91):

```ts
const derived = settings ? deriveSettings(settings) : null;
const feed: Feed = {
  id: generateId(),
  timestamp: ts,
  volume: vol,
  ...(derived ? { targetMlPerDay: Math.round(derived.dailyTargetMl) } : {}),
};
```

Additionally, the value is computed with `deriveSettings(settings)`, i.e. from `settings.weightKg`, not the
effective (measured/WHO) weight used by the Dashboard (`deriveSettings({ ...settings, weightKg: effectiveWeightKg })`
in `DashboardScreen.tsx`). So even the written value is inconsistent with what the app displays.

## Decision

1. Delete the `targetMlPerDay` spread (and the now-unused `derived` / `deriveSettings` usage) from `LogScreen.tsx`.
2. **No data migration.** The field is already ignored on read; existing entries are harmless.
3. Confirm the web app never writes it. (Survey 2026-10-20: no write found in `baby-milk-tracker/src`; only the type comment and a comment in `calculations.ts` noting the old stamp was replaced.)
4. Add a test asserting newly created feeds have no `targetMlPerDay` key. Note: neither repo currently has a test runner configured in `package.json`, so this includes adding a minimal one (e.g. Jest via `jest-expo`).
5. Bump milkwise to `expo.version` **1.2.10** / `ios.buildNumber` **24**. `app.json` currently has no `android.versionCode`; add/bump it only if present at implementation time. (`runtimeVersion.policy` is `appVersion`, so the version bump also changes the runtime version.)

## Consequences

- New feeds no longer carry a stale, settings-weight-based target.
- No user-visible behaviour change in calculations (the field was ignored), but a new build is shipped, hence the bump.
