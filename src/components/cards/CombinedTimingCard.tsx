"use client";

import Link from "next/link";
import { Feed } from "@/types";
import { PredictorResult } from "@/types";
import {
  stomachLoad,
  milkToWater,
  waterToMilk,
  FORMULA_TABLE,
} from "@/lib/calculations";

interface Props {
  predictors: PredictorResult;
  preferredBottleWaterMl: number;
  feeds: Feed[];
  now: number;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtRel(ms: number, now: number): string {
  const diff = ms - now;
  if (diff <= 30_000) return "now";
  const mins = Math.round(diff / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

function nearestBottle(
  roomMilkMl: number,
  preferredWaterMl: number
): { waterMl: number | null; milkMl: number | null } {
  const roomWater = milkToWater(roomMilkMl);
  if (roomWater < 30) return { waterMl: null, milkMl: null };

  const prefMilk = waterToMilk(preferredWaterMl);
  const sizes = FORMULA_TABLE.map((e) => e.water);
  const prefIdx = sizes.indexOf(preferredWaterMl);

  if (roomMilkMl >= prefMilk) {
    const nextWater =
      prefIdx >= 0 && prefIdx < sizes.length - 1
        ? sizes[prefIdx + 1]
        : preferredWaterMl;
    return { waterMl: nextWater, milkMl: Math.round(waterToMilk(nextWater)) };
  }

  // Snap down to largest bottle that fits, with 10 ml tolerance
  const OVERSHOOT_ML = 10;
  const fitsByMilk = FORMULA_TABLE.filter((e) => e.formula <= roomMilkMl + OVERSHOOT_ML);
  if (fitsByMilk.length === 0) return { waterMl: null, milkMl: null };
  const best = fitsByMilk[fitsByMilk.length - 1].water;
  return { waterMl: best, milkMl: Math.round(waterToMilk(best)) };
}

function WaterLabel({ ml, size = "xl" }: { ml: number; size?: "base" | "xl" | "2xl" }) {
  const sizeClass =
    size === "2xl" ? "text-2xl" : size === "xl" ? "text-xl" : "text-base";
  return (
    <span className={`font-bold tabular-nums leading-none ${sizeClass} text-white`}>
      {ml}{" "}
      <span className="text-base font-normal">🍼</span>
    </span>
  );
}

function MilkLabel({ ml, color = "text-slate-300", size = "sm" }: { ml: number; color?: string; size?: "xs" | "sm" }) {
  return (
    <span className={`${size === "xs" ? "text-xs" : "text-sm"} ${color} tabular-nums`}>
      {ml} ml milk
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CombinedTimingCard({
  predictors,
  preferredBottleWaterMl,
  feeds,
  now,
}: Props) {
  const loadNow = stomachLoad(feeds, now);
  const capMilk = predictors.stomachCapMilk;
  const roomNow = Math.max(0, capMilk - loadNow);
  const { waterMl: bottleNow } = nearestBottle(roomNow, preferredBottleWaterMl);

  const prefMilk = waterToMilk(preferredBottleWaterMl);
  // Preferred bottle fits now (within 10 ml tolerance)
  const preferredFitsNow = roomNow >= prefMilk - 10;

  const timeStr = fmtRel(predictors.predictorBTimestamp, now);
  const readyPct = Math.min(100, (roomNow / prefMilk) * 100);
  const arcColor = readyPct >= 100 ? "#4ade80" : readyPct > 60 ? "#fbbf24" : "#f87171";

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-rose-500/20 relative overflow-hidden">
      {/* Top accent: green when preferred fits now, rose→amber otherwise */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 rounded-t-xl ${
        preferredFitsNow
          ? "bg-gradient-to-r from-rose-500 to-green-400"
          : "bg-gradient-to-r from-rose-500 via-rose-400 to-amber-500"
      }`} />

      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-xs font-medium text-rose-400">🩷 Can take · timing</div>
          <Link
            href="/info/predictor-b"
            className="w-4 h-4 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-400 text-xs font-bold flex items-center justify-center leading-none flex-shrink-0"
          >
            ?
          </Link>
        </div>

        {preferredFitsNow ? (
          /* ── Preferred bottle fits now — no timeline ── */
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <div className="text-xs text-rose-400 font-medium">Can take now</div>
              {bottleNow !== null && (
                <div className="text-xs text-rose-300 font-medium">{bottleNow} 🍼 nearest</div>
              )}
              <div className="text-xl font-bold text-white tabular-nums leading-none">
                {Math.round(roomNow)}<span className="text-sm font-normal ml-0.5">ml room</span>
              </div>
            </div>
            <div className="flex flex-col gap-0.5 items-end">
              <div className="text-xs text-green-400 font-medium">Preferred fits ✓</div>
              <WaterLabel ml={preferredBottleWaterMl} size="xl" />
              <MilkLabel ml={Math.round(prefMilk)} color="text-green-400" size="xs" />
            </div>
          </div>
        ) : (
          /* ── Normal case: timeline from now → T_B ── */
          <>
            {/* Timeline bar */}
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-400 flex-shrink-0 ring-2 ring-rose-400/30" />
              <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${readyPct}%`, backgroundColor: arcColor }}
                />
              </div>
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0 ring-2 ring-amber-400/30" />
            </div>

            {/* Labels */}
            <div className="flex justify-between items-start">
              {/* NOW side */}
              <div className="flex flex-col gap-0.5">
                <div className="text-xs text-rose-400 font-medium">Now</div>
                {bottleNow !== null ? (
                  <div className="text-xs text-rose-300 font-medium">{bottleNow} 🍼 nearest</div>
                ) : (
                  <div className="text-xs text-slate-500">stomach full</div>
                )}
                <div className={`text-xl font-bold tabular-nums leading-none ${bottleNow !== null ? "text-white" : "text-slate-500"}`}>
                  {Math.round(roomNow)}<span className="text-sm font-normal ml-0.5">ml room</span>
                </div>
              </div>

              {/* LATER side */}
              <div className="flex flex-col gap-0.5 items-end">
                <div className="text-xs text-amber-400 font-medium">in {timeStr}</div>
                <WaterLabel ml={preferredBottleWaterMl} size="xl" />
                <MilkLabel ml={Math.round(prefMilk)} color="text-amber-500" size="xs" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
