"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getFeeds, getSettings } from "@/lib/store";
import { deriveSettings, smoothedEffective, nextFeedTime, waterToMilk } from "@/lib/calculations";
import { formatDateTime } from "@/lib/formatTime";

function fmtRel(ms: number, now: number): string {
  const d = ms - now, abs = Math.abs(d);
  const mins = Math.round(abs / 60000), h = Math.floor(mins/60), m = mins%60;
  const str = h > 0 ? `${h}h ${m}m` : `${mins}m`;
  return d > 0 ? `in ${str}` : `${str} ago`;
}

export default function NextFeedInfoPage() {
  const [live, setLive] = useState<{
    surplusMl: number;
    rawCorrectionMin: number;
    clampedMin: number;
    capped: boolean;
    adjustedTs: number;
    standardTs: number;
    standardIntervalMin: number;
    maxCorrectionMin: number;
    lastBottleVolume: number;
    timeFormat: '24h'|'12h';
    useP3: boolean;
    targetBeforeMl: number;
    smoothedAtLastFeedMl: number;
    nextBottleMilkMl: number;
    nextBottleWaterMl: number;
    p3MaxCorrectionMin: number;
    p3DeltaMin: number;
  } | null>(null);
  const [now] = useState(Date.now());

  useEffect(() => {
    (async () => {
      const [feeds, settings] = await Promise.all([getFeeds(), getSettings()]);
      if (!feeds.length) return;
      const derived = deriveSettings(settings);
      const lastFeed = feeds.reduce((a,b) => a.timestamp > b.timestamp ? a : b);
      const smoothedAt = lastFeed.timestamp;
      const { totalMl: smoothedTotal } = smoothedEffective(feeds, derived.hourlyRate, settings.standardBottleVolume, smoothedAt);

      const lastMilkMl = waterToMilk(lastFeed.volume);
      const standardIntervalMs = (lastMilkMl / derived.hourlyRate) * 3_600_000;
      const standardTs = lastFeed.timestamp + standardIntervalMs;
      const maxCorrectionMs = standardIntervalMs * (settings.maxCorrectionPct / 100);
      const surplus = smoothedTotal - derived.dailyTargetMl;
      const rawCorrectionMs = (surplus / derived.hourlyRate) * 3_600_000;
      const clampedMs = Math.max(-maxCorrectionMs, Math.min(maxCorrectionMs, rawCorrectionMs));

      const result = nextFeedTime(feeds, derived.hourlyRate, smoothedTotal, derived.dailyTargetMl, settings);
      const adjustedTs = result?.timestamp ?? standardTs + clampedMs;
      const capped = result?.capped ?? false;

      // P3-specific
      const nextBottleMilkMl = waterToMilk(settings.nextBottleWaterMl ?? 90);
      const targetBefore = derived.dailyTargetMl - nextBottleMilkMl;
      const smoothedAtLastFeed = smoothedTotal; // already computed above
      const p3StandardNext = lastFeed.timestamp + (nextBottleMilkMl / derived.hourlyRate) * 3_600_000;
      const p3MaxCorrectionMs = (nextBottleMilkMl / derived.hourlyRate) * 3_600_000 * (settings.maxCorrectionPct / 100);
      const p3MaxCorrectionMin = Math.round(p3MaxCorrectionMs / 60_000);
      const p3DeltaMin = Math.round((adjustedTs - p3StandardNext) / 60_000); // T* minus P3's own standard

      setLive({
        surplusMl: surplus,
        rawCorrectionMin: Math.round(rawCorrectionMs / 60_000),
        clampedMin: Math.round(clampedMs / 60_000),
        capped,
        adjustedTs,
        standardTs,
        standardIntervalMin: Math.round(standardIntervalMs / 60_000),
        maxCorrectionMin: Math.round(maxCorrectionMs / 60_000),
        lastBottleVolume: lastFeed.volume,
        timeFormat: settings.timeFormat,
        useP3: settings.useTargetAwarePredictor !== false,
        targetBeforeMl: targetBefore,
        smoothedAtLastFeedMl: smoothedAtLastFeed,
        nextBottleMilkMl: nextBottleMilkMl,
        nextBottleWaterMl: settings.nextBottleWaterMl ?? 90,
        p3MaxCorrectionMin: p3MaxCorrectionMin,
        p3DeltaMin: p3DeltaMin,
      });
    })();
  }, []);

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24 text-slate-300 text-sm leading-relaxed">
      <Link href="/" className="text-blue-400 hover:text-blue-300 text-xs mb-6 block">← Back to dashboard</Link>

      <h1 className="text-2xl font-bold text-slate-100 mb-1">Adjusted next feed</h1>
      <p className="text-slate-400 text-xs mb-6">How the predicted time is calculated</p>

      {live && (
        <>
          {/* Active predictor explanation */}
          {live.useP3 ? (
            <div className="space-y-3 mb-6">
              <h2 className="text-slate-100 font-semibold">Predictor 3 — Optimised</h2>
              <p>
                Finds T* — the earliest moment at which giving the next bottle would bring the smoothed total
                back to exactly the daily target. Unlike Predictor 2, it does not compute a correction from the
                surplus: it searches directly for when the energy balance is right.
              </p>
              <div className="bg-slate-800 rounded-lg p-3 font-mono text-xs text-slate-300 space-y-0.5">
                <div>T* = first time where:</div>
                <div className="pl-3">smoothed(T*) + nextBottle = dailyTarget</div>
                <div className="mt-1 text-slate-500">i.e. smoothed(T*) = dailyTarget − nextBottle</div>
              </div>
              <p className="text-slate-400 text-sm">
                As time passes, older bottles lose energy credit. T* is the moment when the credits have decayed
                to exactly <em>dailyTarget − nextBottle</em> — so giving the next bottle fills the balance to
                exactly target. Constrained to ±{live.p3MaxCorrectionMin} min around the standard interval.
              </p>

              <div className={`rounded-xl border p-4 mt-2 ${live.capped ? 'border-orange-700/50 bg-orange-900/10' : live.surplusMl < 0 ? 'border-blue-700/50 bg-blue-900/10' : 'border-yellow-700/50 bg-yellow-900/10'}`}>
                <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">For this feed</div>
                <div className="space-y-1.5 text-sm">
                  {/* Energy balance */}
                  <div className="flex justify-between">
                    <span className="text-slate-400">Smoothed at last feed</span>
                    <span className="font-semibold text-slate-300">{Math.round(live.smoothedAtLastFeedMl)} ml</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Daily target</span>
                    <span className="font-semibold text-slate-300">{Math.round(live.smoothedAtLastFeedMl - live.surplusMl)} ml</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Balance</span>
                    <span className={`font-semibold ${live.surplusMl >= 0 ? 'text-yellow-400' : 'text-blue-400'}`}>
                      {live.surplusMl >= 0 ? `+${Math.round(live.surplusMl)} ml (overfed)` : `${Math.round(live.surplusMl)} ml (underfed)`}
                    </span>
                  </div>
                  {/* P3 search target */}
                  <div className="flex justify-between pt-1 border-t border-slate-700">
                    <span className="text-slate-400">Next bottle ({live.nextBottleWaterMl} ml water)</span>
                    <span className="text-slate-300 font-semibold">{Math.round(live.nextBottleMilkMl)} ml formula</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">T* target (smoothed must decay to)</span>
                    <span className="text-slate-300 font-semibold">{Math.round(live.targetBeforeMl)} ml</span>
                  </div>
                  {/* Result */}
                  <div className="flex justify-between pt-1 border-t border-slate-700">
                    <span className="text-slate-400">T* vs standard</span>
                    <span className={`font-semibold tabular-nums ${live.p3DeltaMin > 0 ? 'text-yellow-400' : live.p3DeltaMin < 0 ? 'text-blue-400' : 'text-green-400'}`}>
                      {live.p3DeltaMin === 0 ? 'same as standard' : live.p3DeltaMin > 0 ? `+${live.p3DeltaMin} min` : `${live.p3DeltaMin} min`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Window (±{live.p3MaxCorrectionMin} min)</span>
                    <span className={`font-semibold ${live.capped ? 'text-orange-400' : 'text-slate-400'}`}>
                      {live.capped
                        ? `hit limit → T* = standard +${live.p3MaxCorrectionMin} min`
                        : 'T* found within window'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-700">
                    <span className="text-slate-300 font-medium">Adjusted next feed</span>
                    <span className="text-blue-300 font-bold">
                      {formatDateTime(live.adjustedTs, live.timeFormat)}{' '}
                      <span className="text-slate-500 font-normal text-xs">{fmtRel(live.adjustedTs, now)}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              <h2 className="text-slate-100 font-semibold">Predictor 2 — Adjusted</h2>
              <p>
                Compares the smoothed 24h intake to the daily target. The difference
                (surplus or deficit) is translated into a time correction that shifts
                the standard next feed time earlier or later.
              </p>
              <div className="bg-slate-800 rounded-lg p-3 font-mono text-xs text-slate-300 whitespace-pre">{`surplus    = smoothed − dailyTarget
correction = surplus / hourlyRate  (capped ±${live.maxCorrectionMin} min)
adjusted   = standard + correction`}</div>

              {/* Current situation */}
              <div className={`rounded-xl border p-4 mt-2 ${live.surplusMl >= 0 ? 'border-yellow-700/50 bg-yellow-900/10' : 'border-blue-700/50 bg-blue-900/10'}`}>
                <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">For this feed</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{live.surplusMl >= 0 ? 'Overfed by' : 'Underfed by'}</span>
                    <span className={`font-semibold ${live.surplusMl >= 0 ? 'text-yellow-400' : 'text-blue-400'}`}>
                      {Math.abs(Math.round(live.surplusMl))} ml
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Surplus compensation</span>
                    <span className={`font-semibold tabular-nums ${live.rawCorrectionMin > 0 ? 'text-yellow-400' : live.rawCorrectionMin < 0 ? 'text-blue-400' : 'text-green-400'}`}>
                      {live.rawCorrectionMin === 0 ? 'none' : live.rawCorrectionMin > 0 ? `+${live.rawCorrectionMin} min` : `${live.rawCorrectionMin} min`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cap (±{live.maxCorrectionMin} min)</span>
                    <span className={`font-semibold ${live.capped ? 'text-orange-400' : 'text-slate-500'}`}>
                      {live.capped ? `applied → ${live.clampedMin > 0 ? '+' : ''}${live.clampedMin} min` : 'not needed'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-700">
                    <span className="text-slate-300 font-medium">Adjusted next feed</span>
                    <span className="text-blue-300 font-bold">
                      {formatDateTime(live.adjustedTs, live.timeFormat)}{' '}
                      <span className="text-slate-500 font-normal text-xs">{fmtRel(live.adjustedTs, now)}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {!live && (
        <p className="text-slate-400">Loading…</p>
      )}

      <div className="bg-slate-800 rounded-xl p-4 mt-2">
        <p className="text-slate-500 text-xs">
          You can switch between Predictor 2 and Predictor 3 in Settings.
          Predictor 3 (default) guarantees zero surplus after the next feed if the cap allows it.
        </p>
      </div>
    </div>
  );
}
