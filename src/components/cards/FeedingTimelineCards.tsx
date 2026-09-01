"use client";

import Link from "next/link";
import { Feed } from "@/types";
import { PredictorResult } from "@/types";
import { canTakeProgression, waterToMilk, FORMULA_TABLE, smoothedAtTime } from "@/lib/calculations";

const STANDARD_SIZES = new Set(FORMULA_TABLE.map(e => e.water));

interface Props {
  predictors: PredictorResult;
  preferredBottleWaterMl: number;
  feeds: Feed[];
  now: number;
  hourlyRate: number;
  dailyTargetMl: number;
  timeFormat: '24h' | '12h';
}

function fmtTime(ms: number, timeFormat: '24h' | '12h'): string {
  const d = new Date(ms);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = timeFormat === '12h' ? (h >= 12 ? 'PM' : 'AM') : null;
  if (timeFormat === '12h') h = h % 12 || 12;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return ampm ? `${hh}:${mm} ${ampm}` : `${hh}:${mm}`;
}

function fmtRel(ms: number, now: number): string {
  const diff = ms - now;
  if (Math.abs(diff) <= 30_000) return 'now';
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60_000);
  const h = Math.floor(mins / 60), m = mins % 60;
  const str = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  return diff > 0 ? `in ${str}` : `${str} ago`;
}

export default function FeedingTimelineCards({
  predictors,
  preferredBottleWaterMl,
  feeds,
  now,
  hourlyRate,
  dailyTargetMl,
  timeFormat,
}: Props) {
  const progression = canTakeProgression(
    feeds, preferredBottleWaterMl, now, hourlyRate, dailyTargetMl
  );

  const lastFeed = feeds.length > 0 ? feeds.reduce((a, b) => a.timestamp > b.timestamp ? a : b) : null;
  const lastFeedIsNonStandard = lastFeed ? !STANDARD_SIZES.has(lastFeed.volume) : false;
  const allFuture = progression.length > 0 && !progression.some(e => e.fitsNow);
  // Distinguish why everything is in the future: stomach full (underfed) vs genuinely overfed
  const currentSmoothed = allFuture ? smoothedAtTime(feeds, hourlyRate, now) : 0;
  const isStomachLimited = allFuture && currentSmoothed < dailyTargetMl;
  const cols = Math.min(progression.length, 4) || 1;
  const gridClass = cols === 1 ? 'grid-cols-1' : cols === 2 ? 'grid-cols-2' :
    cols === 3 ? 'grid-cols-3' : 'grid-cols-4';

  return (
    <div>
      <div className="flex items-center justify-between px-0.5 mb-1">
        <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">Feeding Timeline</span>
        <Link href="/info/predictor-b"
          className="w-4 h-4 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-400 text-xs font-bold flex items-center justify-center leading-none">?</Link>
      </div>

      {progression.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-3 text-xs text-slate-500 text-center">No feeds logged yet.</div>
      ) : (
        <>
          <div className={`grid ${gridClass} gap-2`}>
            {progression.map(entry => {
              const isNow = entry.fitsNow;
              const isAbove = entry.waterMl > preferredBottleWaterMl;
              const accentClass = isNow ? 'from-green-500 to-emerald-400'
                : isAbove ? 'from-teal-500 to-cyan-400'
                : 'from-rose-500 to-rose-400';
              const borderClass = isNow ? 'border-green-500/25'
                : isAbove ? 'border-teal-500/20'
                : 'border-rose-500/20';
              const sizeColor = isNow ? 'text-green-300' : isAbove ? 'text-teal-300' : 'text-white';

              return (
                <div key={entry.waterMl}
                  className={`bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-3 border ${borderClass} relative overflow-hidden`}>
                  <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${accentClass} rounded-t-xl`} />
                  <div className={`text-2xl font-bold mb-0.5 ${sizeColor}`}>
                    {lastFeedIsNonStandard && entry.waterMl === lastFeed?.volume
                      ? `${Math.round(waterToMilk(entry.waterMl))} ml`
                      : `${entry.waterMl} 🍼`}
                  </div>
                  <div className={`font-mono font-bold text-lg tracking-wide tabular-nums leading-none ${isNow ? 'text-green-300' : 'text-blue-300'}`}>
                    {isNow ? 'now' : fmtTime(entry.readyAtMs, timeFormat)}
                  </div>
                  {!isNow && (
                    <div className="text-xs text-slate-400 mt-0.5">{fmtRel(entry.readyAtMs, now)}</div>
                  )}

                </div>
              );
            })}
          </div>
          {allFuture && (
            <div className="text-xs mt-2 px-0.5">
              {isStomachLimited
                ? <span className="text-slate-400">Stomach full — next feed at {fmtTime(progression[0].readyAtMs, timeFormat)}</span>
                : <span className="text-orange-400">Well fed — all sizes available later</span>
              }
            </div>
          )}
        </>
      )}
    </div>
  );
}
