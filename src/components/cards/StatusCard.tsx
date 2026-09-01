"use client";

import React from "react";
import SwipeableCard from "@/components/SwipeableCard";
import { waterToMilk, stomachLoad, stomachCapMilk } from "@/lib/calculations";
import { buildTrendPoints, drawTrendGraph } from "@/lib/trendGraph";
import { Feed } from "@/types";
import { WeightEntry } from "@/lib/weights";
import Link from "next/link";

interface Props {
  strict24h: number;
  strictPct: number;
  smoothedMl: number;
  smoothedPct: number;
  liveSmoothedMl: number;   // smoothed ml at live clock
  liveSmoothedPct: number;  // smoothed % at live clock
  dailyTargetMl: number;
  standardBottleVolume: number;
  hourlyRate: number;
  yellowThresholdPct: number;
  redThresholdPct: number;
  onStrictExplain: () => void;
  onSmoothedExplain: () => void;
  feeds: Feed[];
  weights: WeightEntry[];
  now: number;
}

function colorClass(pct: number, y: number, r: number) {
  const d = Math.abs(pct - 100);
  if (d <= y) return "text-green-400";
  if (d <= r) return "text-yellow-400";
  return "text-red-400";
}
function bgBorder(pct: number, y: number, r: number) {
  const d = Math.abs(pct - 100);
  if (d <= y) return "bg-green-900/20 border-green-700/40";
  if (d <= r) return "bg-yellow-900/20 border-yellow-700/40";
  return "bg-red-900/20 border-red-700/40";
}
function statusText(pct: number, y: number, r: number) {
  const d = Math.abs(pct - 100);
  if (d <= y) return "on track";
  if (pct > 100) return d <= r ? "slightly over" : "overfed ⚠️";
  return d <= r ? "slightly behind" : "behind ⚠️";
}

function Panel({ label, ml, pct, milkPerBottle, standardBottleVolume, y, r, onExplain, feeds24h }:
  { label: string; ml: number; pct: number; milkPerBottle: number; standardBottleVolume: number; y: number; r: number; onExplain: () => void; feeds24h: Feed[] }) {

  const bottles = ml / milkPerBottle;

  // Actual feed pictograms from last 24h, sorted large → small
  const feedEmojis = [...feeds24h]
    .sort((a, b) => b.volume - a.volume)
    .map(f => ({
      vol: f.volume,
      size: waterToMilk(f.volume) / milkPerBottle,
    }));

  return (
    <div className={`rounded-xl border p-3 ${bgBorder(pct, y, r)}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
        <button onClick={onExplain} className="w-4 h-4 rounded-full bg-slate-600 hover:bg-slate-500 text-slate-300 text-xs font-bold flex items-center justify-center leading-none">?</button>
      </div>

      {/* Numbers: ml left, bottles right, same font */}
      <div className="flex items-baseline justify-between mb-1">
        <span className={`text-3xl font-bold leading-none tabular-nums ${colorClass(pct, y, r)}`}>{Math.round(ml)}<span className="text-base font-normal ml-0.5">ml</span></span>
        <span className={`text-3xl font-bold leading-none tabular-nums ${colorClass(pct, y, r)}`}>{bottles.toFixed(1)}<span className="text-base font-normal ml-0.5">× {standardBottleVolume} 🍼</span></span>
      </div>
      <div className={`text-sm mb-2 ${colorClass(pct, y, r)}`}>{Math.round(pct)}% · {statusText(pct, y, r)}</div>

      {/* Actual feed pictograms: real bottles from last 24h, labels bottom-aligned */}
      <div className="flex flex-wrap items-end gap-1 mt-1">
        {feedEmojis.map((f, i) => (
          <div key={i} className="flex flex-col items-center justify-end">
            <span
              className="leading-none block"
              style={{ fontSize: `${Math.max(0.8, Math.min(1.5, f.size + 0.3))}rem`, opacity: 0.7 + f.size * 0.3 }}
            >🍼</span>
            <span className="text-xs text-slate-500 tabular-nums leading-none mt-0.5">{f.vol} 🍼</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Shared: stomach vessel ────────────────────────────────────────────────────
function StomachVessel({ loadNow, capMilk, roomNow, height = 72 }:
  { loadNow: number; capMilk: number; roomNow: number; height?: number }) {
  const fillPct = Math.min(100, Math.max(0, (loadNow / capMilk) * 100));
  const stomachColor = fillPct > 85 ? '#ef4444' : fillPct > 55 ? '#f97316' : '#fbbf24';
  const roomColor = fillPct > 85 ? 'text-red-400' : fillPct > 55 ? 'text-orange-400' : 'text-teal-400';
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`text-xs font-semibold tabular-nums ${roomColor}`}>{Math.round(roomNow)} ml</div>
      <div className={`text-xs ${roomColor} opacity-70`}>free</div>
      <div
        className="relative border-2 border-slate-500 overflow-hidden my-0.5"
        style={{ width: 34, height, borderRadius: '6px 6px 16px 16px' }}
      >
        <div className="absolute top-0 left-0 right-0" style={{ bottom: `${fillPct}%`, backgroundColor: 'rgba(20,184,166,0.13)' }} />
        <div className="absolute bottom-0 left-0 right-0 transition-all duration-700" style={{ height: `${fillPct}%`, backgroundColor: stomachColor }} />
        {fillPct > 4 && fillPct < 96 && (
          <div className="absolute left-0 right-0 h-px bg-white/25" style={{ bottom: `${fillPct}%` }} />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-white/70 drop-shadow">{Math.round(fillPct)}%</span>
        </div>
      </div>
      <div className="text-xs text-amber-400 font-semibold tabular-nums">{Math.round(loadNow)} ml</div>
      <div className="text-xs text-slate-500">digesting</div>
    </div>
  );
}

// ── Shared: intake gauge bar ──────────────────────────────────────────────────
function IntakeGauge({ pct, dailyTargetMl, y, r }: { pct: number; dailyTargetMl: number; y: number; r: number }) {
  const diff = pct - 100;
  const fill = Math.min(Math.max((pct - 60) / 80 * 100, 0), 100);
  const color = Math.abs(diff) <= y ? '#4ade80' : diff > 0 ? '#f97316' : '#60a5fa';
  const deltaml = Math.abs(Math.round(pct / 100 * dailyTargetMl - dailyTargetMl));
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-6 rounded-t-lg border-2 border-slate-500 overflow-hidden" style={{ height: 56 }}>
        <div className="absolute bottom-0 left-0 right-0" style={{ height: `${fill}%`, backgroundColor: color }} />
        <div className="absolute left-0 right-0 h-px bg-white/50" style={{ bottom: '50%' }} />
      </div>
      <div className="text-xs font-bold tabular-nums mt-0.5" style={{ color }}>
        {Math.abs(diff) < 1 ? '–' : `${diff > 0 ? '+' : '−'}${deltaml}ml`}
      </div>
    </div>
  );
}

// ── Combined status+stomach Design A: left=intake, right=stomach vessel ───────
function CombinedA({ ml, pct, y, r, onExplain, loadNow, capMilk, roomNow, dailyTargetMl }:
  { ml: number; pct: number; y: number; r: number; onExplain: () => void;
    loadNow: number; capMilk: number; roomNow: number; dailyTargetMl: number }) {
  const intakeColor = colorClass(pct, y, r);
  return (
    <div className={`rounded-xl border p-3 ${bgBorder(pct, y, r)}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 uppercase tracking-wide">Status at last feed</span>
        <button onClick={onExplain} className="w-4 h-4 rounded-full bg-slate-600 hover:bg-slate-500 text-slate-300 text-xs font-bold flex items-center justify-center leading-none">?</button>
      </div>
      <div className="flex items-start gap-2">
        {/* Left: intake status */}
        <div className="flex-1 min-w-0">
          <div className={`text-3xl font-bold leading-none tabular-nums mb-0.5 ${intakeColor}`}>
            {Math.round(ml)}<span className="text-base font-normal ml-0.5">ml</span>
          </div>
          <div className={`text-sm mb-2 ${intakeColor}`}>{Math.round(pct)}% · {statusText(pct, y, r)}</div>
          {/* Horizontal intake bar */}
          <div className="relative h-2.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${Math.min(100, (pct / 130) * 100)}%`,
                backgroundColor: Math.abs(pct-100) <= y ? '#4ade80' : pct > 100 ? '#f97316' : '#60a5fa'
              }}
            />
            <div className="absolute inset-y-0 w-px bg-white/40" style={{ left: `${(100/130)*100}%` }} />
          </div>
          <div className="flex justify-between text-xs text-slate-600 mt-0.5">
            <span>0</span><span>▼ target</span><span>+30%</span>
          </div>
        </div>
        {/* Right: stomach vessel */}
        <StomachVessel loadNow={loadNow} capMilk={capMilk} roomNow={roomNow} height={72} />
      </div>
    </div>
  );
}

// ── Combined status+stomach Design B (polished) ───────────────────────────────
function CombinedB({ ml, pct, y, r, onExplain, loadNow, capMilk, roomNow, dailyTargetMl }:
  { ml: number; pct: number; y: number; r: number; onExplain: () => void;
    loadNow: number; capMilk: number; roomNow: number; dailyTargetMl: number }) {
  const intakeColor = colorClass(pct, y, r);
  const intakeHex = Math.abs(pct - 100) <= y ? '#4ade80' : pct > 100 ? '#f97316' : '#60a5fa';
  const intakeFill = Math.min(Math.max((pct - 60) / 80 * 100, 0), 100);
  const intakeDiff = pct - 100;
  const deltaml = Math.abs(Math.round(pct / 100 * dailyTargetMl - dailyTargetMl));
  const stomachFillPct = Math.min(100, Math.max(0, (loadNow / capMilk) * 100));
  const stomachHex = stomachFillPct > 85 ? '#ef4444' : stomachFillPct > 55 ? '#f97316' : '#fbbf24';
  const roomColor = stomachFillPct > 85 ? 'text-red-400' : stomachFillPct > 55 ? 'text-orange-400' : 'text-teal-400';

  return (
    <div className={`rounded-xl border p-3 ${bgBorder(pct, y, r)}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">Status</span>
        <button onClick={onExplain} className="w-4 h-4 rounded-full bg-slate-600 hover:bg-slate-500 text-slate-300 text-xs font-bold flex items-center justify-center leading-none">?</button>
      </div>

      {/* Two equal columns */}
      <div className="grid grid-cols-2 gap-3">

        {/* ── Left: 24h intake ── */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-slate-400 font-medium">24h intake · at last feed</span>
          {/* Vertical gauge */}
          <div className="flex items-end gap-1.5">
            <div className="relative rounded-t-xl border-2 border-slate-600 overflow-hidden" style={{ width: 28, height: 64 }}>
              <div className="absolute bottom-0 left-0 right-0 transition-all duration-700"
                style={{ height: `${intakeFill}%`, backgroundColor: intakeHex }} />
              <div className="absolute left-0 right-0 h-px bg-white/40" style={{ bottom: '50%' }} />
            </div>
          </div>
          {/* Number */}
          <div className={`text-2xl font-bold tabular-nums leading-none ${intakeColor}`}>
            {Math.round(ml)}<span className="text-sm font-normal ml-0.5">ml</span>
          </div>
          {/* % + delta */}
          <div className={`text-xs font-semibold ${intakeColor}`}>{Math.round(pct)}%</div>
          <div className="text-xs text-slate-500">
            {Math.abs(intakeDiff) < 1 ? 'on target' : `${intakeDiff > 0 ? '+' : '−'}${deltaml} ml`}
          </div>
        </div>

        {/* ── Divider ── */}
        {/* (grid gap handles spacing) */}

        {/* ── Right: stomach ── */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-slate-400 font-medium">stomach room · now</span>
          {/* Stomach vessel */}
          <div className="relative border-2 border-slate-600 overflow-hidden"
            style={{ width: 28, height: 64, borderRadius: '6px 6px 14px 14px' }}>
            <div className="absolute top-0 left-0 right-0"
              style={{ bottom: `${stomachFillPct}%`, backgroundColor: 'rgba(20,184,166,0.13)' }} />
            <div className="absolute bottom-0 left-0 right-0 transition-all duration-700"
              style={{ height: `${stomachFillPct}%`, backgroundColor: stomachHex }} />
            {stomachFillPct > 4 && stomachFillPct < 96 && (
              <div className="absolute left-0 right-0 h-px bg-white/25" style={{ bottom: `${stomachFillPct}%` }} />
            )}
          </div>
          {/* Room */}
          <div className={`text-2xl font-bold tabular-nums leading-none ${roomColor}`}>
            {Math.round(roomNow)}<span className="text-sm font-normal ml-0.5">ml free</span>
          </div>
          {/* cap context removed */}
          {/* digesting */}
          <div className={`text-xs font-semibold ${roomColor}`}>{Math.round(loadNow)} ml digesting</div>
        </div>
      </div>

      {/* Bottom: twin progress bars */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="relative h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${Math.min(100, (pct / 130) * 100)}%`, backgroundColor: intakeHex }} />
          <div className="absolute inset-y-0 w-px bg-white/30" style={{ left: `${(100 / 130) * 100}%` }} />
        </div>
        <div className="relative h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${stomachFillPct}%`, backgroundColor: stomachHex }} />
        </div>
      </div>
    </div>
  );
}

// ── Combined status+stomach Design C: two equal columns ───────────────────────
function CombinedC({ ml, pct, y, r, onExplain, loadNow, capMilk, roomNow, dailyTargetMl }:
  { ml: number; pct: number; y: number; r: number; onExplain: () => void;
    loadNow: number; capMilk: number; roomNow: number; dailyTargetMl: number }) {
  const intakeColor = colorClass(pct, y, r);
  const stomachFillPct = Math.min(100, (loadNow / capMilk) * 100);
  const roomColor = stomachFillPct > 85 ? 'text-red-400' : stomachFillPct > 55 ? 'text-orange-400' : 'text-teal-400';
  return (
    <div className={`rounded-xl border p-3 ${bgBorder(pct, y, r)}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 uppercase tracking-wide">Status at last feed</span>
        <button onClick={onExplain} className="w-4 h-4 rounded-full bg-slate-600 hover:bg-slate-500 text-slate-300 text-xs font-bold flex items-center justify-center leading-none">?</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {/* Left: 24h intake */}
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-slate-500">24h intake</span>
          <div className={`text-2xl font-bold tabular-nums leading-none ${intakeColor}`}>
            {Math.round(ml)}<span className="text-sm font-normal ml-0.5">ml</span>
          </div>
          <div className={`text-xs ${intakeColor}`}>{Math.round(pct)}% · {statusText(pct, y, r)}</div>
        </div>
        {/* Right: stomach */}
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-slate-500">stomach now</span>
          <div className={`text-2xl font-bold tabular-nums leading-none ${roomColor}`}>
            {Math.round(roomNow)}<span className="text-sm font-normal ml-0.5">ml</span>
          </div>
          <div className={`text-xs ${roomColor}`}>{Math.round(stomachFillPct)}% full · {Math.round(loadNow)} ml digesting</div>
        </div>
        {/* Two mini bars below */}
        <div>
          <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden mt-1">
            <div className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${Math.min(100, (pct/130)*100)}%`,
                backgroundColor: Math.abs(pct-100) <= y ? '#4ade80' : pct > 100 ? '#f97316' : '#60a5fa' }} />
            <div className="absolute inset-y-0 w-px bg-white/40" style={{ left: `${(100/130)*100}%` }} />
          </div>
        </div>
        <div>
          <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden mt-1">
            <div className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${stomachFillPct}%`,
                backgroundColor: stomachFillPct > 85 ? '#ef4444' : stomachFillPct > 55 ? '#f97316' : '#fbbf24' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Dual-gauge panel (both at-feed and now side by side) ────────────────────────────
function PanelDualGauge({ ml, pct, livePct, milkPerBottle, dailyTargetMl, y, r, onExplain, feeds24h }:
  { ml: number; pct: number; livePct: number; milkPerBottle: number; dailyTargetMl: number; y: number; r: number; onExplain: () => void; feeds24h: Feed[] }) {

  function Gauge({ gPct, gLabel, live }: { gPct: number; gLabel: string; live: boolean }) {
    const gDiff = gPct - 100;
    const fill = Math.min(Math.max((gPct - 60) / 80 * 100, 0), 100);
    const color = Math.abs(gDiff) <= y ? '#4ade80' : gDiff > 0 ? '#f97316' : '#60a5fa';
    const deltaml = Math.abs(Math.round(gPct / 100 * dailyTargetMl - dailyTargetMl));
    return (
      <div className="flex flex-col items-center">
        <span className="text-xs text-orange-400 mb-0.5">↑</span>
        <div className="relative rounded-t-lg border-2 border-slate-500 overflow-hidden" style={{ width: 28, height: 72 }}>
          <div
            className={live ? 'absolute bottom-0 left-0 right-0 transition-all duration-1000' : 'absolute bottom-0 left-0 right-0'}
            style={{ height: `${fill}%`, backgroundColor: color }}
          />
          <div className="absolute left-0 right-0 h-0.5 bg-white/60" style={{ bottom: '50%' }} />
        </div>
        <span className="text-xs text-blue-400 mt-0.5">↓</span>
        <div className="text-xs font-bold tabular-nums mt-0.5 text-center" style={{ color }}>
          {Math.abs(gDiff) < 1 ? '–' : `${gDiff > 0 ? '+' : '−'}${deltaml}ml`}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">{gLabel}</div>
      </div>
    );
  }

  const feedEmojis = [...feeds24h]
    .sort((a, b) => b.volume - a.volume)
    .map(f => ({ vol: f.volume, size: waterToMilk(f.volume) / milkPerBottle }));

  return (
    <div className={`rounded-xl border p-3 ${bgBorder(pct, y, r)}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 uppercase tracking-wide">Status — at feed vs now</span>
        <button onClick={onExplain} className="w-5 h-5 rounded-full bg-slate-600 hover:bg-slate-500 text-slate-300 text-xs font-bold flex items-center justify-center leading-none">?</button>
      </div>
      <div className="flex items-start">
        <div style={{ width: '52%' }}>
          <div className={`text-3xl font-bold leading-none tabular-nums mb-1 ${colorClass(pct, y, r)}`}>{Math.round(ml)}<span className="text-base font-normal ml-0.5">ml</span></div>
          <div className={`text-sm mb-2 ${colorClass(pct, y, r)}`}>{Math.round(pct)}% · {statusText(pct, y, r)}</div>
          <div className="flex flex-wrap items-end gap-1">
            {feedEmojis.map((f, i) => (
              <div key={i} className="flex flex-col items-center justify-end">
                <span className="leading-none block" style={{ fontSize: `${Math.max(0.8, Math.min(1.5, f.size + 0.3))}rem`, opacity: 0.7 + f.size * 0.3 }}>🍼</span>
                <span className="text-xs text-slate-500 tabular-nums leading-none mt-0.5">{f.vol} 🍼</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-3 justify-center" style={{ width: '48%' }}>
          <Gauge gPct={pct} gLabel="at feed" live={false} />
          <Gauge gPct={livePct} gLabel="now" live={true} />
        </div>
      </div>
    </div>
  );
}

// (PanelWithGaugeLive removed — stomach now lives in the combined views above)

// ── Extra view A: Progress bar (“what’s been consumed”) ──────────────────────────
function ProgressView(props: Props) {
  const { strict24h, strictPct, smoothedMl, smoothedPct, dailyTargetMl, yellowThresholdPct: y, redThresholdPct: r } = props;
  function Bar({ label, ml, pct, onExplain }: { label: string; ml: number; pct: number; onExplain: () => void }) {
    const fill = Math.min(pct, 150);
    return (
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400">{label}</span>
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-bold ${colorClass(pct, y, r)}`}>{Math.round(ml)} ml</span>
            <button onClick={onExplain} className="w-4 h-4 rounded-full bg-slate-600 text-slate-300 text-xs font-bold flex items-center justify-center leading-none">?</button>
          </div>
        </div>
        <div className="relative h-4 bg-slate-700 rounded-full overflow-hidden">
          <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${(fill / 150) * 100}%`, backgroundColor: fill <= 100 + y ? '#4ade80' : fill <= 100 + r ? '#facc15' : '#f87171' }} />
          <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-center text-xs font-bold text-white drop-shadow">{Math.round(pct)}%</div>
          {/* Target line */}
          <div className="absolute inset-y-0 w-0.5 bg-white/40" style={{ left: `${(100 / 150) * 100}%` }} />
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-700 p-3">
      <div className="text-xs text-slate-400 uppercase tracking-wide mb-2">Intake in the last 24 hrs</div>
      <Bar label="Smoothed 24h" ml={smoothedMl} pct={smoothedPct} onExplain={props.onSmoothedExplain} />
      <Bar label="Strict 24h" ml={strict24h} pct={strictPct} onExplain={props.onStrictExplain} />
      <div className="text-xs text-slate-600 mt-0.5">Target: {Math.round(dailyTargetMl)} ml · white line = 100%</div>
    </div>
  );
}

// ── Extra view B: Number spotlight ──────────────────────────────────────────
function SpotlightView({ smoothedMl, smoothedPct, strict24h, strictPct, yellowThresholdPct: y, redThresholdPct: r, onSmoothedExplain, onStrictExplain }: Props) {
  return (
    <div className="rounded-xl border border-slate-700 p-3">
      <div className="text-xs text-slate-400 uppercase tracking-wide mb-2">At a glance</div>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div>
          <div className={`text-4xl font-black tabular-nums ${colorClass(smoothedPct, y, r)}`}>{Math.round(smoothedPct)}%</div>
          <div className="text-xs text-slate-400 mt-0.5">Smoothed</div>
          <div className="text-xs text-slate-500">{Math.round(smoothedMl)} ml</div>
          <button onClick={onSmoothedExplain} className="mt-1 w-4 h-4 rounded-full bg-slate-600 text-slate-300 text-xs font-bold mx-auto flex items-center justify-center leading-none">?</button>
        </div>
        <div>
          <div className={`text-4xl font-black tabular-nums ${colorClass(strictPct, y, r)}`}>{Math.round(strictPct)}%</div>
          <div className="text-xs text-slate-400 mt-0.5">Strict</div>
          <div className="text-xs text-slate-500">{Math.round(strict24h)} ml</div>
          <button onClick={onStrictExplain} className="mt-1 w-4 h-4 rounded-full bg-slate-600 text-slate-300 text-xs font-bold mx-auto flex items-center justify-center leading-none">?</button>
        </div>
      </div>
    </div>
  );
}

// ── Option C: Centre-anchored bidirectional bar ─────────────────────────────────────
function BiDirectionalView({ smoothedMl, smoothedPct, dailyTargetMl, yellowThresholdPct: y, redThresholdPct: r, onSmoothedExplain }: Props) {
  const diff = smoothedPct - 100;
  const absDiff = Math.abs(diff);
  const isOver = diff > 0;
  // bar fills from centre outward, max at ±40%
  const barPct = Math.min(absDiff / 40 * 50, 50); // 0-50% each side
  const barColor = absDiff <= y ? '#4ade80' : isOver ? '#f97316' : '#60a5fa';
  const surplusMl = Math.round(Math.abs(smoothedMl - dailyTargetMl));

  return (
    <div className="rounded-xl border border-slate-700 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 uppercase tracking-wide">Balance</span>
        <button onClick={onSmoothedExplain} className="w-4 h-4 rounded-full bg-slate-600 text-slate-300 text-xs font-bold flex items-center justify-center">?</button>
      </div>
      {/* Status label */}
      <div className="text-center mb-3">
        {absDiff <= y
          ? <span className="text-2xl font-bold text-green-400">✓ On target</span>
          : isOver
            ? <span className="text-2xl font-bold text-orange-400">↑ Overfed {surplusMl} ml</span>
            : <span className="text-2xl font-bold text-blue-400">↓ Underfed {surplusMl} ml</span>}
        <div className="text-xs text-slate-500 mt-0.5">{Math.round(smoothedPct)}% of target</div>
      </div>
      {/* Bidirectional bar */}
      <div className="relative h-5 bg-slate-700 rounded-full overflow-hidden">
        {/* Green centre band */}
        <div className="absolute inset-y-0 bg-green-900/40" style={{ left: '45%', right: '45%' }} />
        {/* Fill from centre */}
        {isOver
          ? <div className="absolute inset-y-0 rounded-r-full" style={{ left: '50%', width: `${barPct}%`, backgroundColor: barColor }} />
          : <div className="absolute inset-y-0 rounded-l-full" style={{ right: '50%', width: `${barPct}%`, backgroundColor: barColor }} />}
        {/* Centre line */}
        <div className="absolute inset-y-0 w-0.5 bg-white/50" style={{ left: '50%' }} />
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow">
          {diff > 0 ? '+' : ''}{Math.round(diff)}%
        </div>
      </div>
      <div className="flex justify-between text-xs text-slate-600 mt-0.5">
        <span>← underfed</span><span>overfed →</span>
      </div>
    </div>
  );
}

// ── Option D: Thermometer / gauge ───────────────────────────────────────────────────
function ThermometerView({ smoothedMl, smoothedPct, dailyTargetMl, yellowThresholdPct: y, redThresholdPct: r, onSmoothedExplain }: Props) {
  const diff = smoothedPct - 100;
  const absDiff = Math.abs(diff);
  const isOver = diff > 0;
  const surplusMl = Math.round(Math.abs(smoothedMl - dailyTargetMl));
  // Gauge: 60%=bottom, 140%=top. Target at centre.
  const fillHeight = Math.min(Math.max((smoothedPct - 60) / 80 * 100, 0), 100);
  const fillColor = absDiff <= y ? '#4ade80' : isOver ? '#f97316' : '#60a5fa';

  return (
    <div className="rounded-xl border border-slate-700 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 uppercase tracking-wide">Intake gauge</span>
        <button onClick={onSmoothedExplain} className="w-4 h-4 rounded-full bg-slate-600 text-slate-300 text-xs font-bold flex items-center justify-center">?</button>
      </div>
      <div className="flex items-end gap-4">
        {/* Vertical gauge */}
        <div className="flex flex-col items-center">
          <span className="text-xs text-orange-400 mb-0.5">↑ over</span>
          <div className="relative w-8 rounded-t-lg border-2 border-slate-500 overflow-hidden" style={{ height: 80 }}>
            <div className="absolute bottom-0 left-0 right-0 transition-all" style={{ height: `${fillHeight}%`, backgroundColor: fillColor }} />
            {/* Target line at 50% height */}
            <div className="absolute left-0 right-0 h-0.5 bg-white/60" style={{ bottom: '50%' }} />
          </div>
          <span className="text-xs text-blue-400 mt-0.5">↓ under</span>
        </div>
        {/* Reading */}
        <div>
          <div className={`text-3xl font-black tabular-nums`} style={{ color: fillColor }}>
            {diff > 0 ? '+' : ''}{Math.round(diff)}%
          </div>
          <div className="text-xs text-slate-400">{Math.round(smoothedPct)}% of target</div>
          <div className={`text-sm font-semibold mt-1 ${isOver ? 'text-orange-400' : absDiff <= y ? 'text-green-400' : 'text-blue-400'}`}>
            {absDiff <= y ? '✓ On target' : isOver ? `↑ +${surplusMl} ml over` : `↓ ${surplusMl} ml under`}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Option E: Emoji face + deficit/surplus statement ────────────────────────────────
function EmojiBalanceView({ smoothedMl, smoothedPct, dailyTargetMl, yellowThresholdPct: y, redThresholdPct: r, onSmoothedExplain }: Props) {
  const diff = smoothedPct - 100;
  const absDiff = Math.abs(diff);
  const isOver = diff > 0;
  const surplusMl = Math.round(Math.abs(smoothedMl - dailyTargetMl));

  let emoji = '😄', headline = '', sub = '', color = 'text-green-400';
  if (absDiff <= y) {
    emoji = '😄'; headline = 'Perfect balance'; sub = 'Right on target.'; color = 'text-green-400';
  } else if (isOver && absDiff > r) {
    emoji = '🤬'; headline = `Too full: +${surplusMl} ml`; sub = 'Next feed can wait a bit.'; color = 'text-orange-400';
  } else if (isOver) {
    emoji = '😌'; headline = `A little full: +${surplusMl} ml`; sub = 'All good — just watch.'; color = 'text-amber-400';
  } else if (absDiff > r) {
    emoji = '😢'; headline = `Short: −${surplusMl} ml`; sub = 'Offer a feed soon.'; color = 'text-blue-400';
  } else {
    emoji = '😕'; headline = `A little short: −${surplusMl} ml`; sub = 'Keep an eye on it.'; color = 'text-sky-400';
  }

  return (
    <div className="rounded-xl border border-slate-700 p-3 text-center">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400 uppercase tracking-wide">Status</span>
        <button onClick={onSmoothedExplain} className="w-4 h-4 rounded-full bg-slate-600 text-slate-300 text-xs font-bold flex items-center justify-center">?</button>
      </div>
      <div className="text-5xl mb-2">{emoji}</div>
      <div className={`text-xl font-bold ${color}`}>{headline}</div>
      <div className="text-slate-400 text-sm mt-0.5">{sub}</div>
      <div className="text-xs text-slate-500 mt-1">{Math.round(smoothedMl)} ml · {Math.round(smoothedPct)}%</div>
    </div>
  );
}

// ── Feed-point trend view (inline canvas) ────────────────────────────────────
function FeedTrendView({ feeds, weights, mlPerKgPerDay, fallbackWeight, now, dailyTargetMl, pct, y, r }:
  { feeds: Feed[]; weights: WeightEntry[]; mlPerKgPerDay: number; fallbackWeight: number;
    now: number; dailyTargetMl: number; pct: number; y: number; r: number }) {

  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pts = buildTrendPoints(feeds, weights, mlPerKgPerDay, fallbackWeight, 3 * 24 * 3_600_000, now);
    drawTrendGraph(ctx, pts, now, 3 * 24 * 3_600_000, dailyTargetMl, y, r, { showLegend: true });
  }, [feeds, weights, mlPerKgPerDay, fallbackWeight, now, dailyTargetMl, pct, y, r]);

  const diff = Math.abs(pct - 100);
  const color = diff <= y ? '#4ade80' : diff <= r ? '#facc15' : '#f87171';

  return (
    <div className="rounded-xl border border-slate-700 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 uppercase tracking-wide">Intake trend — 3 days</span>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>{Math.round(pct)}%</span>
      </div>
      <canvas ref={canvasRef} width={520} height={200}
        className="w-full rounded-lg" style={{ imageRendering: 'crisp-edges' }} />
    </div>
  );
}


// ── History link view ──────────────────────────────────────────────────────────
function HistoryLinkView({ pct, ml, y, r }: { pct: number; ml: number; y: number; r: number }) {
  const diff = Math.abs(pct - 100);
  const color = diff <= y ? '#4ade80' : diff <= r ? '#facc15' : '#f87171';
  return (
    <div className="rounded-xl border border-slate-700 p-4 text-center">
      <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Smoothed intake — 3 days</div>
      <div className="text-3xl font-bold tabular-nums mb-1" style={{ color }}>{Math.round(ml)} ml</div>
      <div className="text-sm mb-4" style={{ color }}>{Math.round(pct)}%</div>
      <Link
        href="/history/smoothed"
        className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
      >
        <span>View 3-day graph</span>
        <span className="text-slate-400">→</span>
      </Link>
      <div className="text-xs text-slate-600 mt-3">Tap to see smoothed intake over the last 3 days</div>
    </div>
  );
}

export default function StatusCard(props: Props) {
  const { strict24h, strictPct, smoothedMl, smoothedPct, standardBottleVolume, yellowThresholdPct: y, redThresholdPct: r } = props;
  const milkPerBottle = waterToMilk(standardBottleVolume);
  const cutoff24h = props.now - 24 * 3_600_000;
  const feeds24h = props.feeds.filter(f => f.timestamp >= cutoff24h)
    .sort((a, b) => a.timestamp - b.timestamp);

  // Stomach state at current moment
  const capMilk = stomachCapMilk(standardBottleVolume, props.hourlyRate);
  const loadNow = stomachLoad(props.feeds, props.now);
  const roomNow = Math.max(0, capMilk - loadNow);

  return (
    <div className="mb-2">
      <CombinedB ml={smoothedMl} pct={smoothedPct}
        y={y} r={r} onExplain={props.onSmoothedExplain}
        loadNow={loadNow} capMilk={capMilk} roomNow={roomNow} dailyTargetMl={props.dailyTargetMl} />
    </div>
  );
}
