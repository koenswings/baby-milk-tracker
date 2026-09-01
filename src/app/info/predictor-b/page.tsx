"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getFeeds, getSettings } from "@/lib/store";
import {
  deriveSettings,
  smoothedAtTime,
  computePredictors,
  waterToMilk,
  stomachLoad,
  milkToWater,
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
  currentIntake: number;
  lastFeedTs: number;
  predictorBTimestamp: number;
  predictorBStomachLimited: boolean;
  predictorBCapped: boolean;
  timeFormat: '24h' | '12h';
  stomachCapMilk: number;
  loadNow: number;
  roomNow: number;
  bottleNowWater: number | null;
  bottleNowMilk: number | null;
  preferredFitsNow: boolean;
  graphPoints: { ts: number; smoothedMl: number }[];
  graphStartTs: number;
  graphEndTs: number;
}

export default function PredictorBPage() {
  const [live, setLive] = useState<LiveData | null>(null);
  const [now] = useState(Date.now());

  useEffect(() => {
    (async () => {
      const [feeds, settings] = await Promise.all([getFeeds(), getSettings()]);
      if (!feeds.length) return;
      const derived = deriveSettings(settings);
      const preds = computePredictors(feeds, derived.hourlyRate, derived.dailyTargetMl, settings.preferredBottleWaterMl);
      if (!preds) return;

      const lastFeed = feeds.reduce((a, b) => a.timestamp > b.timestamp ? a : b);
      const preferredBottleMilkMl = waterToMilk(settings.preferredBottleWaterMl);
      const currentIntake = smoothedAtTime(feeds, derived.hourlyRate, Date.now());

      const loadNow = stomachLoad(feeds, Date.now());
      const roomNow = Math.max(0, preds.stomachCapMilk - loadNow);
      const preferredFitsNow = roomNow >= preferredBottleMilkMl - 10;

      // Best-fit bottle for now
      const roomWater = milkToWater(roomNow);
      let bottleNowWater: number | null = null;
      let bottleNowMilk: number | null = null;
      if (roomWater >= 30) {
        const FORMULA_TABLE = [
          { water: 30, formula: 35 }, { water: 60, formula: 70 }, { water: 90, formula: 100 },
          { water: 120, formula: 135 }, { water: 150, formula: 170 }, { water: 180, formula: 200 },
          { water: 210, formula: 240 }
        ];
        const fits = FORMULA_TABLE.filter(e => e.formula <= roomNow + 10);
        if (fits.length > 0) {
          const best = fits[fits.length - 1];
          bottleNowWater = best.water;
          bottleNowMilk = Math.round(best.formula);
        }
      }

      const graphStartTs = lastFeed.timestamp - 1 * 3_600_000;
      const graphEndTs = preferredFitsNow
        ? Date.now() + 1 * 3_600_000  // short future window if already ready
        : preds.predictorBTimestamp + 2 * 3_600_000;
      const steps = Math.min(300, Math.ceil((graphEndTs - graphStartTs) / 60_000));
      const stepMs = (graphEndTs - graphStartTs) / steps;
      const graphPoints: { ts: number; smoothedMl: number }[] = [];
      for (let i = 0; i <= steps; i++) {
        const ts = graphStartTs + i * stepMs;
        graphPoints.push({ ts, smoothedMl: smoothedAtTime(feeds, derived.hourlyRate, ts) });
      }

      setLive({
        dailyTargetMl: derived.dailyTargetMl,
        hourlyRate: derived.hourlyRate,
        preferredBottleWaterMl: settings.preferredBottleWaterMl,
        preferredBottleMilkMl,
        currentIntake,
        lastFeedTs: lastFeed.timestamp,
        predictorBTimestamp: preds.predictorBTimestamp,
        predictorBStomachLimited: preds.predictorBStomachLimited,
        predictorBCapped: preds.predictorBCapped,
        timeFormat: settings.timeFormat,
        stomachCapMilk: preds.stomachCapMilk,
        loadNow,
        roomNow,
        bottleNowWater,
        bottleNowMilk,
        preferredFitsNow,
        graphPoints,
        graphStartTs,
        graphEndTs,
      });
    })();
  }, []);

  function renderGraph(lv: LiveData) {
    const W = 320, H = 130, padL = 44, padR = 12, padT = 12, padB = 28;
    const gW = W - padL - padR, gH = H - padT - padB;

    const allVals = lv.graphPoints.map(p => p.smoothedMl);
    const minY = Math.min(...allVals, lv.dailyTargetMl) * 0.95;
    const maxY = Math.max(...allVals) * 1.05;
    const rangeY = maxY - minY || 1;
    const spanMs = lv.graphEndTs - lv.graphStartTs;

    const tx = (ts: number) => padL + ((ts - lv.graphStartTs) / spanMs) * gW;
    const ty = (ml: number) => padT + (1 - (ml - minY) / rangeY) * gH;

    const pathD = lv.graphPoints.map((p, i) =>
      `${i === 0 ? 'M' : 'L'}${tx(p.ts).toFixed(1)},${ty(p.smoothedMl).toFixed(1)}`
    ).join(' ');

    const targetY = ty(lv.dailyTargetMl);
    const nowX = tx(Date.now());
    const lastFeedX = tx(lv.lastFeedTs);

    const nowPoint = lv.graphPoints.reduce((best, p) =>
      Math.abs(p.ts - Date.now()) < Math.abs(best.ts - Date.now()) ? p : best
    );

    const showTB = !lv.preferredFitsNow;
    const tBX = showTB ? tx(lv.predictorBTimestamp) : null;
    const tBPoint = showTB
      ? lv.graphPoints.reduce((best, p) =>
          Math.abs(p.ts - lv.predictorBTimestamp) < Math.abs(best.ts - lv.predictorBTimestamp) ? p : best)
      : null;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const y = padT + f * gH;
          const val = Math.round(maxY - f * rangeY);
          return (
            <g key={f}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#334155" strokeWidth="0.5" />
              <text x={padL - 4} y={y + 3.5} textAnchor="end" fontSize="8" fill="#64748b">{val}</text>
            </g>
          );
        })}

        {/* Target line */}
        <line x1={padL} y1={targetY} x2={W - padR} y2={targetY} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 2" />
        <text x={W - padR + 2} y={targetY + 3.5} fontSize="7" fill="#f59e0b">target</text>

        {/* Last feed line */}
        <line x1={lastFeedX} y1={padT} x2={lastFeedX} y2={padT + gH} stroke="#22d3ee" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
        <text x={lastFeedX} y={padT + gH + 10} textAnchor="middle" fontSize="7" fill="#22d3ee">last</text>

        {/* Now line */}
        {nowX > lastFeedX && (
          <line x1={nowX} y1={padT} x2={nowX} y2={padT + gH} stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
        )}

        {/* T_B line (only if preferred doesn't fit now) */}
        {showTB && tBX !== null && (
          <>
            <line x1={tBX} y1={padT} x2={tBX} y2={padT + gH} stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="3 2" />
            <text x={tBX} y={padT + gH + 10} textAnchor="middle" fontSize="7" fill="#3b82f6">T_B</text>
          </>
        )}

        {/* Decay curve */}
        <path d={pathD} fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* Now dot */}
        <circle cx={nowX} cy={ty(nowPoint.smoothedMl)} r="3" fill="#94a3b8" />

        {/* T_B dot */}
        {showTB && tBX !== null && tBPoint !== null && (
          <circle cx={tBX} cy={ty(tBPoint.smoothedMl)} r="3.5" fill="#3b82f6" />
        )}

        <line x1={padL} y1={padT} x2={padL} y2={padT + gH} stroke="#475569" strokeWidth="1" />
        <line x1={padL} y1={padT + gH} x2={W - padR} y2={padT + gH} stroke="#475569" strokeWidth="1" />
      </svg>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24 text-slate-300 text-sm leading-relaxed">
      <Link href="/" className="text-blue-400 hover:text-blue-300 text-xs mb-6 block">← Back to dashboard</Link>

      <h1 className="text-2xl font-bold text-slate-100 mb-2">Can take now · when to give preferred</h1>
      <p className="text-slate-400 text-sm mb-6">Predictor B — stomach room now and best timing for the full bottle</p>

      {/* Intro */}
      <p className="mb-4">
        This card answers two related questions at once: <em>how much can the baby's stomach
        physically hold right now?</em> and <em>when is the best moment to give the full
        preferred bottle?</em> Both questions are about protecting the baby's stomach — giving
        too much before the stomach has emptied enough causes discomfort, spitting up,
        and an unsettled baby.
      </p>

      {/* Section: How much now */}
      <section className="mb-6">
        <h2 className="text-slate-100 font-semibold mb-2">How much can she take right now?</h2>
        <p className="mb-3">
          Every recent bottle is still partially in the stomach — digestion is not instant.
          The stomach has a maximum comfortable capacity. By tracking how quickly each
          bottle digests (roughly half gone within the first hour, following a smooth
          exponential curve), the app calculates how much milk is still sitting in the
          stomach right now and how much room is left.
        </p>
        <p className="mb-3">
          That available room is what the baby can comfortably take right now without
          stressing the stomach. The nearest standard bottle size that fits in that room
          is shown as the suggested bottle — always in water ml (🍼) so you know exactly
          what to measure.
        </p>
        <p>
          If the preferred bottle already fits comfortably, the card says so and no timeline
          is needed. You can offer the preferred bottle right now. If the stomach is still
          too full for a full preferred bottle, the timeline below shows when that moment arrives.
        </p>
      </section>

      {/* Section: When to give the preferred bottle */}
      <section className="mb-6">
        <h2 className="text-slate-100 font-semibold mb-2">When to give the preferred bottle</h2>
        <p className="mb-3">
          The best timing for the preferred bottle takes two things into account: the stomach
          and the 24h intake target.
        </p>
        <p className="mb-3">
          On the stomach side: the preferred bottle fits comfortably once the stomach has
          digested enough of the previous feed. This sets the earliest possible moment.
        </p>
        <p className="mb-3">
          On the intake side: ideally the preferred bottle should be given at the moment
          the 24h intake has decayed back to the daily target. At that exact moment, giving
          the preferred bottle brings the intake up to its equilibrium level — neither
          overfeeding nor underfeeding.
        </p>
        <p>
          The result of these two constraints is T_B — the earliest time that is both
          stomach-safe and intake-optimal. If the baby was overfed recently, the 24h intake
          is still high and T_B is later than the standard interval. If the baby was underfed,
          the intake has already fallen below target and T_B may be right now. If the baby
          is on track, T_B matches the standard interval.
        </p>
      </section>

      {/* Graph */}
      {live ? (
        <div className="bg-slate-800 rounded-xl p-4 mb-6">
          <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">
            {live.preferredFitsNow ? 'Intake curve — preferred bottle fits now' : 'Intake decay toward T_B'}
          </p>
          {renderGraph(live)}
          <p className="text-xs text-slate-500 mt-2">
            <span className="text-cyan-400">━</span> 24h intake &nbsp;
            <span className="text-amber-400">- -</span> Daily target &nbsp;
            <span className="text-slate-400">●</span> Now
            {!live.preferredFitsNow && <>&nbsp;<span className="text-blue-400">●</span> T_B</>}
          </p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl p-4 mb-6 text-slate-500 text-sm">
          No feeds logged yet — log a feed to see real data.
        </div>
      )}

      {/* Live calculation box */}
      {live ? (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 mb-6">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Live calculation</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Daily target</span>
              <span className="text-slate-100">{Math.round(live.dailyTargetMl)} ml</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">24h intake right now</span>
              <span className="text-slate-100">{Math.round(live.currentIntake)} ml
                <span className="text-slate-500 text-xs ml-1">
                  ({live.currentIntake > live.dailyTargetMl ? '+' : ''}{Math.round(live.currentIntake - live.dailyTargetMl)} vs target)
                </span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Stomach load now</span>
              <span className="text-slate-100">{Math.round(live.loadNow)} ml digesting</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Stomach room now</span>
              <span className="text-slate-100">{Math.round(live.roomNow)} ml free of {Math.round(live.stomachCapMilk)} ml</span>
            </div>
            <div className="border-t border-slate-700 pt-2 flex justify-between">
              <span className="text-slate-300 font-medium">Can take right now</span>
              {live.bottleNowWater !== null ? (
                <span className="text-rose-300 font-bold">{live.bottleNowWater} 🍼 = {live.bottleNowMilk} ml milk</span>
              ) : (
                <span className="text-slate-500">stomach full — wait</span>
              )}
            </div>
            {live.preferredFitsNow ? (
              <div className="flex justify-between">
                <span className="text-slate-300 font-medium">Preferred bottle</span>
                <span className="text-green-400 font-bold">fits now ✓</span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span className="text-slate-300 font-medium">Preferred bottle fits at</span>
                <span className="text-blue-300 font-bold">
                  {formatTime(live.predictorBTimestamp, live.timeFormat)}{' '}
                  <span className="text-slate-500 text-xs">({fmtRel(live.predictorBTimestamp, now)})</span>
                </span>
              </div>
            )}
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
