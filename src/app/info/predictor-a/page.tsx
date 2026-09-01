"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getFeeds, getSettings } from "@/lib/store";
import {
  deriveSettings,
  smoothedAtTime,
  computePredictors,
  waterToMilk,
  FORMULA_TABLE,
} from "@/lib/calculations";
import { formatTime } from "@/lib/formatTime";

function fmtRel(ms: number, now: number): string {
  const d = ms - now, abs = Math.abs(d);
  const mins = Math.round(abs / 60000), h = Math.floor(mins / 60), m = mins % 60;
  const str = h > 0 ? `${h}h ${m}m` : `${mins}m`;
  return d > 0 ? `in ${str}` : `${str} ago`;
}

interface LiveData {
  dailyTargetMl: number;
  hourlyRate: number;
  preferredBottleWaterMl: number;
  preferredBottleMilkMl: number;
  standardIntervalMs: number;
  predictorATimestamp: number;
  intakeAtTA: number;
  predictorAVolumeWater: number;
  predictorAVolumeMilk: number;
  predictorASurplus: boolean;
  predictorACapped: boolean;
  stomachCapMilk: number;
  timeFormat: '24h' | '12h';
}

export default function PredictorAPage() {
  const [live, setLive] = useState<LiveData | null>(null);
  const [now] = useState(Date.now());

  useEffect(() => {
    (async () => {
      const [feeds, settings] = await Promise.all([getFeeds(), getSettings()]);
      if (!feeds.length) return;
      const derived = deriveSettings(settings);
      const preds = computePredictors(feeds, derived.hourlyRate, derived.dailyTargetMl, settings.preferredBottleWaterMl);
      if (!preds) return;

      const preferredBottleMilkMl = waterToMilk(settings.preferredBottleWaterMl);
      const intakeAtTA = smoothedAtTime(feeds, derived.hourlyRate, preds.predictorATimestamp);

      setLive({
        dailyTargetMl: derived.dailyTargetMl,
        hourlyRate: derived.hourlyRate,
        preferredBottleWaterMl: settings.preferredBottleWaterMl,
        preferredBottleMilkMl,
        standardIntervalMs: preds.standardIntervalMs,
        predictorATimestamp: preds.predictorATimestamp,
        intakeAtTA,
        predictorAVolumeWater: preds.predictorAVolumeWater,
        predictorAVolumeMilk: preds.predictorAVolumeMilk,
        predictorASurplus: preds.predictorASurplus,
        predictorACapped: preds.predictorACapped,
        stomachCapMilk: preds.stomachCapMilk,
        timeFormat: settings.timeFormat,
      });
    })();
  }, []);

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24 text-slate-300 text-sm leading-relaxed">
      <Link href="/" className="text-blue-400 hover:text-blue-300 text-xs mb-6 block">← Back to dashboard</Link>

      <h1 className="text-2xl font-bold text-slate-100 mb-2">How much to give?</h1>
      <p className="text-slate-400 text-sm mb-6">Predictor A — adjust the amount at the standard time</p>

      {/* Intro */}
      <p className="mb-4">
        This predictor answers the question: <em>at the usual feeding time, how much should I give?</em>{' '}
        Most of the time the answer is simply the preferred bottle size. But when feeding has
        been a little off over the past day — too much, too little, or at irregular times —
        the amount adjusts automatically to gently steer the baby back to her daily target.
      </p>

      {/* Section: Starting from the 24h intake */}
      <section className="mb-6">
        <h2 className="text-slate-100 font-semibold mb-2">Starting from the 24h intake</h2>
        <p className="mb-3">
          The 24h intake is the running total of all the milk the baby has received in the
          past 24 hours — you can read a full explanation on the Status card. This predictor
          uses that same value to work out the right bottle size.
        </p>
        <p className="mb-3">
          The idea is simple: at the standard feeding time, the app looks at where the 24h
          intake will be and asks <em>how much milk do we need to add so that the total lands
          right on the daily target, plus one preferred bottle?</em> That last part — adding
          one preferred bottle on top — is the equilibrium: the intake rises when you feed,
          then settles back to the target as the body uses the milk. Giving exactly the right
          amount keeps the baby in this steady rhythm.
        </p>
        <p>
          If the baby is slightly overfed at the standard time, the suggested amount will be
          smaller than the preferred bottle. If she is slightly underfed, it will be a bit
          larger. If she is right on track, it will equal the preferred bottle exactly.
        </p>
      </section>

      {/* Section: What if the deficit is large? */}
      <section className="mb-6">
        <h2 className="text-slate-100 font-semibold mb-2">What if the shortfall is large?</h2>
        <p className="mb-3">
          Sometimes the 24h intake is well below target — for example after a very long
          gap between feeds or a missed feed. In that case the calculation would suggest
          a very large bottle to make up the entire shortfall at once.
        </p>
        <p className="mb-3">
          We do not do that. Giving an oversized bottle stresses the stomach — it can cause
          discomfort, spitting up, and a very unsettled baby. Instead, the amount is capped
          at the next standard bottle size above the preferred one. So if the preferred bottle
          is 90 🍼, the maximum suggested is 120 🍼. This is enough to catch up meaningfully
          without overwhelming the stomach, and the baby will continue recovering over the
          following feeds.
        </p>
        <p>
          You will see a small ⚠️ on the predictor card when this cap has been applied,
          so you know the full shortfall was not covered in one go.
        </p>
      </section>

      {/* Section: Well fed case */}
      <section className="mb-6">
        <h2 className="text-slate-100 font-semibold mb-2">When the baby is well fed</h2>
        <p>
          If the 24h intake is already at or above the daily target at the standard time,
          the predictor shows a dash — there is nothing to add. This does not mean skipping
          the feed; it means the timing or the amount can be reduced slightly. The other
          predictor (Adjust timing) takes over in this case.
        </p>
      </section>

      {/* Live numbers box */}
      {live ? (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 mb-6">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Live calculation</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Standard feeding time</span>
              <span className="text-slate-100 font-mono">
                {formatTime(live.predictorATimestamp, live.timeFormat)}{' '}
                <span className="text-slate-500 text-xs">({fmtRel(live.predictorATimestamp, now)})</span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">24h intake at that time</span>
              <span className="text-slate-100">{Math.round(live.intakeAtTA)} ml</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Daily target</span>
              <span className="text-slate-100">{Math.round(live.dailyTargetMl)} ml</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Preferred bottle</span>
              <span className="text-slate-100">{live.preferredBottleWaterMl} 🍼 = {Math.round(live.preferredBottleMilkMl)} ml milk</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Gap to fill (target + preferred − intake at T_A)</span>
              <span>{live.predictorASurplus ? '—' : `${Math.round((live.dailyTargetMl + live.preferredBottleMilkMl) - live.intakeAtTA)} ml milk`}</span>
            </div>
            {live.predictorACapped && (
              <div className="flex justify-between text-xs text-yellow-400">
                <span>Capped at next bottle size above preferred</span>
                <span>
                  {(() => {
                    const sizes = FORMULA_TABLE.map(e => e.water);
                    const idx = sizes.indexOf(live.preferredBottleWaterMl);
                    const nextW = idx >= 0 && idx < sizes.length - 1 ? sizes[idx + 1] : live.preferredBottleWaterMl;
                    return `max ${nextW} 🍼`;
                  })()}
                </span>
              </div>
            )}
            <div className="border-t border-slate-700 pt-2 flex justify-between">
              <span className="text-slate-300 font-medium">Suggested bottle</span>
              {live.predictorASurplus ? (
                <span className="text-slate-400 italic">Well fed — none needed</span>
              ) : (
                <span className="text-blue-300 font-bold">
                  {live.predictorAVolumeWater} 🍼 = {Math.round(live.predictorAVolumeMilk)} ml milk
                  {live.predictorACapped && <span className="text-yellow-400 ml-1">⚠️</span>}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl p-4 mb-6 text-slate-500 text-sm">
          No feeds logged yet — log a feed to see live calculations.
        </div>
      )}

      <Link href="/" className="block text-center text-blue-400 hover:text-blue-300 text-sm py-2">
        ← Back to dashboard
      </Link>
    </div>
  );
}
