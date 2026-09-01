"use client";

import React, { useRef, useEffect, useLayoutEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Feed } from "@/types";
import { PredictorResult } from "@/types";
import {
  canTakeProgression, waterToMilk, FORMULA_TABLE,
  STOMACH_K, smoothedAtTime,
} from "@/lib/calculations";

interface Props {
  predictors: PredictorResult;
  preferredBottleWaterMl: number;
  feeds: Feed[];
  now: number;
  hourlyRate: number;
  dailyTargetMl: number;
  timeFormat: '24h' | '12h';
}

const STANDARD_SIZES = new Set(FORMULA_TABLE.map(e => e.water));
const HALF_HOUR_MS   = 30 * 60_000;
const HOUR_MS        = 60 * 60_000;
const NEAR_ZERO_ML   = 5;           // ml — "stomach cleared" threshold
const PAD            = 32;          // left+right SVG padding px

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtTime(ms: number, tf: '24h' | '12h'): string {
  const d = new Date(ms);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = tf === '12h' ? (h >= 12 ? 'PM' : 'AM') : null;
  if (tf === '12h') h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}${ampm ? ' ' + ampm : ''}`;
}

function fmtHour(ms: number, tf: '24h' | '12h'): string {
  const d = new Date(ms);
  let h = d.getHours();
  if (tf === '12h') {
    const sfx = h >= 12 ? 'p' : 'a';
    h = h % 12 || 12;
    return `${h}${sfx}`;
  }
  return `${String(h).padStart(2, '0')}:00`;
}

function labelWidth(text: string, fs: number, withEmoji = false): number {
  const base = text.length * fs * 0.62;
  return withEmoji ? base + fs * 1.1 : base;
}

function gastricClearMs(feedTimestampMs: number, volumeWaterMl: number): number {
  const milkMl = waterToMilk(volumeWaterMl);
  const hours  = Math.log(Math.max(milkMl, NEAR_ZERO_ML + 0.1) / NEAR_ZERO_ML) / STOMACH_K;
  return feedTimestampMs + hours * 3_600_000;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function CanTakeCard({
  predictors,
  preferredBottleWaterMl,
  feeds,
  now,
  hourlyRate,
  dailyTargetMl,
  timeFormat,
}: Props) {
  const wrapRef   = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(340);

  // User-controlled zoom multiplier (1.0 = default/auto scale)
  const [userScale, setUserScale]   = useState(1.0);
  const userScaleRef                = useRef(1.0);
  userScaleRef.current              = userScale;
  // The timestamp (ms) pinned to the centre of the viewport during a drag.
  // Set on pointerdown, used after each scale change to reposition scrollLeft.
  const dragRef      = useRef<{ startX: number; startUS: number; didVibrate: boolean } | null>(null);
  const pinnedMsRef  = useRef<number | null>(null);   // time pinned to viewport centre
  const hasUserScaled = useRef(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new ResizeObserver(e => setCardWidth(e[0].contentRect.width));
    obs.observe(el);
    setCardWidth(el.clientWidth);
    return () => obs.disconnect();
  }, []);

  // ── data ─────────────────────────────────────────────────────────────────────

  const progression = canTakeProgression(
    feeds, preferredBottleWaterMl, now, hourlyRate, dailyTargetMl
  );

  const lastFeed = feeds.length > 0
    ? feeds.reduce((a, b) => a.timestamp > b.timestamp ? a : b)
    : null;

  const allFuture = progression.length > 0 && !progression.some(e => e.fitsNow);
  const lastFeedIsNonStandard = lastFeed ? !STANDARD_SIZES.has(lastFeed.volume) : false;

  // Feeds sorted chronologically for band computation
  const sortedFeeds = [...feeds]
    .filter(f => f.timestamp <= now + 60_000)
    .sort((a, b) => a.timestamp - b.timestamp);

  // Per-feed gastric decay bands (stomach model, t½ = 60 min)
  interface GastricBand {
    feedMs:       number;  // feed timestamp
    gastricEndMs: number;  // when this feed's gastric load alone clears
    epochEndMs:   number;  // next feed start (or T_END) — band visual boundary
    index:        number;
  }

  // ── timeline bounds ───────────────────────────────────────────────────────────

  const LOOKBACK_MS = 12 * 3_600_000;
  const earliestFeed = feeds.length > 0
    ? Math.min(...feeds.map(f => f.timestamp))
    : now - LOOKBACK_MS;
  const T_START = Math.min(earliestFeed, now - LOOKBACK_MS) - 20 * 60_000;

  const latestProgression = progression.length > 0
    ? Math.max(...progression.map(e => e.readyAtMs))
    : now + 60 * 60_000;
  const lastGastricEnd = lastFeed
    ? gastricClearMs(lastFeed.timestamp, lastFeed.volume)
    : now;
  const T_END   = Math.max(latestProgression, lastGastricEnd) + 25 * 60_000;
  const spanMs  = T_END - T_START;

  // Bands now that T_END is known
  const gastricBands: GastricBand[] = sortedFeeds.map((f, i) => {
    const nextFeed = sortedFeeds[i + 1];
    return {
      feedMs:       f.timestamp,
      gastricEndMs: gastricClearMs(f.timestamp, f.volume),
      epochEndMs:   nextFeed ? nextFeed.timestamp : T_END,
      index:        i,
    };
  });

  // ── scale ─────────────────────────────────────────────────────────────────────

  const capMilk    = predictors.stomachCapMilk;
  const t30DecayMs = capMilk > 30
    ? (-Math.log(1 - 30 / capMilk) / STOMACH_K) * 3_600_000
    : 20 * 60_000;
  const LABEL_MIN_GAP_PX = 96;
  const minScale    = LABEL_MIN_GAP_PX / t30DecayMs;
  const autoScale   = (cardWidth - PAD) / spanMs;
  const defaultScale = Math.max(autoScale, minScale);
  const scale       = defaultScale * userScale;
  const SCROLL_W    = Math.ceil(spanMs * scale) + PAD;

  function px(ms: number): number {
    return PAD / 2 + Math.round((ms - T_START) * scale);
  }

  // ── scroll anchor: keep pinned time (or "now") fixed at viewport centre ────────

  // useLayoutEffect (not useEffect) so the scroll correction happens before the browser paints.
  // With useEffect, the SVG content resizes first, the browser paints a shifted frame, then
  // scrollLeft is corrected — the user sees the centre jump. useLayoutEffect is synchronous
  // with the DOM update, so the repositioning is atomic and no shift is visible.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const anchorMs = pinnedMsRef.current ?? (hasUserScaled.current ? null : now);
    if (anchorMs === null) return;
    const anchorPx = PAD / 2 + Math.round((anchorMs - T_START) * scale);
    el.scrollLeft = Math.max(0, anchorPx - cardWidth * 0.5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, cardWidth]);

  // ── hour ruler ticks ──────────────────────────────────────────────────────────

  const hourTicks: { ms: number; isHour: boolean }[] = [];
  const tickStart = Math.ceil(T_START / HALF_HOUR_MS) * HALF_HOUR_MS;
  for (let t = tickStart; t <= T_END; t += HALF_HOUR_MS) {
    hourTicks.push({ ms: t, isHour: t % HOUR_MS === 0 });
  }
  // Suppress labels if hour ticks are closer than 28px
  const showHourLabels = HOUR_MS * scale >= 28;
  // Suppress half-hour ticks if too dense
  const showHalfTicks  = HALF_HOUR_MS * scale >= 6;

  // ── Y layout ──────────────────────────────────────────────────────────────────

  const TRACK_Y         = 86;
  const LABEL_BASE_Y    = TRACK_Y - 30;   // bottle label (normal)
  const LABEL_LIFTED_Y  = TRACK_Y - 54;   // bottle label (lifted)
  const HEADER_Y_OFFSET = 18;             // "Last Feed" sits above label
  const TIME_BASE_Y     = TRACK_Y + 20;   // feed time label (normal)
  const TIME_DROP_Y     = TRACK_Y + 36;   // feed time label (dropped)
  const HOUR_TICK_Y     = TRACK_Y + 4;    // start of hour tick
  const HOUR_LABEL_Y    = TRACK_Y + 24;   // hour text baseline
  const GASTRIC_LABEL_Y = TRACK_Y + 50;   // gastric clear time text
  const SVG_H           = TRACK_Y + 65;

  // ── marker data ───────────────────────────────────────────────────────────────

  interface MarkerData {
    ms: number; x: number;
    numStr: string; showEmoji: boolean;
    header: string; time: string;
    dotColor: string; labelColor: string;
    fillDot: boolean;
  }

  const allMarkers: MarkerData[] = [];

  // Past feeds (all except most recent)
  [...feeds]
    .filter(f => f !== lastFeed)
    .sort((a, b) => a.timestamp - b.timestamp)
    .forEach(f => {
      const isNS = !STANDARD_SIZES.has(f.volume);
      allMarkers.push({
        ms: f.timestamp, x: px(f.timestamp),
        numStr: isNS ? `${Math.round(waterToMilk(f.volume))}` : `${f.volume}`,
        showEmoji: !isNS,
        header: '', time: fmtTime(f.timestamp, timeFormat),
        dotColor: '#475569', labelColor: '#94a3b8', fillDot: true,
      });
    });

  // Last feed
  if (lastFeed) {
    const isNS = lastFeedIsNonStandard;
    allMarkers.push({
      ms: lastFeed.timestamp, x: px(lastFeed.timestamp),
      numStr: isNS ? `${Math.round(waterToMilk(lastFeed.volume))}` : `${lastFeed.volume}`,
      showEmoji: !isNS,
      header: 'Last Feed', time: fmtTime(lastFeed.timestamp, timeFormat),
      dotColor: '#475569', labelColor: '#94a3b8', fillDot: true,
    });
  }

  // Progression markers
  progression.forEach(e => {
    const isNow   = e.fitsNow;
    const isAbove = e.waterMl > preferredBottleWaterMl;
    allMarkers.push({
      ms: e.readyAtMs, x: px(e.readyAtMs),
      numStr: `${e.waterMl}`, showEmoji: true,
      header: '', time: isNow ? 'now' : fmtTime(e.readyAtMs, timeFormat),
      dotColor:  isNow ? '#4ade80' : isAbove ? '#2dd4bf' : '#f43f5e',
      labelColor: isNow ? '#4ade80' : isAbove ? '#2dd4bf' : '#f43f5e',
      fillDot: isNow,
    });
  });

  allMarkers.sort((a, b) => a.ms - b.ms);

  const FS_LABEL  = 16;
  const FS_TIME   = 13;
  const FS_HEADER = 12;
  const FS_HOUR   = 9;
  const FS_GASTRIC = 10;

  const halfWidths     = allMarkers.map(m => labelWidth(m.numStr, FS_LABEL, m.showEmoji) / 2);
  const timeHalfWidths = allMarkers.map(m => labelWidth(m.time, FS_TIME) / 2);

  const lifted = allMarkers.map(() => false);
  for (let i = 1; i < allMarkers.length; i++) {
    if (allMarkers[i].x - halfWidths[i] < allMarkers[i-1].x + halfWidths[i-1] + 6) {
      lifted[i] = !lifted[i-1];
      if (lifted[i-1]) lifted[i] = false;
    }
  }
  const timeDrop = allMarkers.map(() => false);
  for (let i = 1; i < allMarkers.length; i++) {
    if (allMarkers[i].x - timeHalfWidths[i] < allMarkers[i-1].x + timeHalfWidths[i-1] + 6) {
      timeDrop[i] = !timeDrop[i-1];
    }
  }

  // ── stretch strip ─────────────────────────────────────────────────────────────

  const STRIP_H   = 28;
  const STRIP_PAD = 16;
  const LOG_MIN   = Math.log(0.3);
  const LOG_MAX   = Math.log(3.0);
  const clampUS   = Math.max(0.3, Math.min(3.0, userScale));
  const indPct    = (Math.log(clampUS) - LOG_MIN) / (LOG_MAX - LOG_MIN);
  const indX      = STRIP_PAD + indPct * (cardWidth - STRIP_PAD * 2);
  const defX      = STRIP_PAD + (-LOG_MIN) / (LOG_MAX - LOG_MIN) * (cardWidth - STRIP_PAD * 2);
  const isNearDef = Math.abs(userScale - 1.0) < 0.08;

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startUS: userScaleRef.current, didVibrate: false };
    // Pin the time that is currently at the centre of the scroll viewport
    const scrollEl = scrollRef.current;
    if (scrollEl) {
      const centrePx = scrollEl.scrollLeft + scrollEl.clientWidth * 0.5;
      // centrePx = PAD/2 + (ms - T_START) * scale  =>  ms = T_START + (centrePx - PAD/2) / scale
      pinnedMsRef.current = T_START + (centrePx - PAD / 2) / (defaultScale * userScaleRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [T_START, defaultScale]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const delta = e.clientX - dragRef.current.startX;
    let newUS = dragRef.current.startUS * Math.exp(delta / 180);
    newUS = Math.max(0.3, Math.min(3.0, newUS));

    if (Math.abs(newUS - 1.0) < 0.10) {
      if (!dragRef.current.didVibrate) {
        if (typeof window !== 'undefined' && window.navigator?.vibrate) window.navigator.vibrate(12);
        dragRef.current.didVibrate = true;
      }
      newUS = 1.0;
    } else {
      dragRef.current.didVibrate = false;
    }

    hasUserScaled.current = newUS !== 1.0;
    setUserScale(newUS);
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current   = null;
    pinnedMsRef.current = null;  // release pin after drag ends
  }, []);

  // ── band colors ───────────────────────────────────────────────────────────────

  // Alternating per epoch: even = teal tint, odd = slate tint
  const EPOCH_BG   = ['rgba(45,212,191,0.06)', 'rgba(148,163,184,0.05)'];
  const GASTRIC_BG = ['rgba(45,212,191,0.15)', 'rgba(100,116,139,0.13)'];

  // ── render ────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-rose-500/20 relative overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-0.5 rounded-t-xl ${
        allFuture
          ? 'bg-gradient-to-r from-orange-500 to-amber-400'
          : 'bg-gradient-to-r from-rose-500 via-rose-400 to-teal-400'
      }`} />

      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-slate-400 uppercase tracking-wide font-medium">Feeding Timeline</div>
          <Link href="/info/predictor-b"
            className="w-4 h-4 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-400 text-xs font-bold flex items-center justify-center leading-none">?</Link>
        </div>

        <div ref={wrapRef} className="w-full">

          {/* ── scrollable timeline ── */}
          <div ref={scrollRef} className="overflow-x-auto"
            style={{ WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'] }}>
            <svg width={SCROLL_W} height={SVG_H} style={{ display: 'block', minWidth: cardWidth }}>

              {/* Epoch bands (full epoch, very light) */}
              {gastricBands.map((b, i) => {
                const x1 = Math.max(0, px(b.feedMs));
                const x2 = Math.min(SCROLL_W, px(b.epochEndMs));
                return x2 > x1
                  ? <rect key={`ep-${i}`} x={x1} y={0} width={x2-x1} height={SVG_H} fill={EPOCH_BG[i%2]} />
                  : null;
              })}

              {/* Gastric active zone (brighter overlay, from feed to gastric clear) */}
              {gastricBands.map((b, i) => {
                const x1 = Math.max(0, px(b.feedMs));
                const x2 = Math.min(SCROLL_W, px(Math.min(b.gastricEndMs, b.epochEndMs)));
                return x2 > x1
                  ? <rect key={`ga-${i}`} x={x1} y={0} width={x2-x1} height={SVG_H} fill={GASTRIC_BG[i%2]} />
                  : null;
              })}

              {/* Gastric clear dashed marker (only when clears before next feed) */}
              {gastricBands.map((b, i) => {
                const xG = px(b.gastricEndMs);
                if (b.gastricEndMs >= b.epochEndMs) return null;  // clears after next feed — skip
                if (xG < PAD/2 || xG > SCROLL_W) return null;
                return (
                  <g key={`gd-${i}`}>
                    <line x1={xG} y1={TRACK_Y-14} x2={xG} y2={TRACK_Y+14}
                      stroke="#64748b" strokeWidth="1" strokeDasharray="2 2" opacity="0.55" />
                    <text x={xG} y={GASTRIC_LABEL_Y}
                      textAnchor="middle" fontSize={FS_GASTRIC} fill="#64748b" fontFamily="monospace">
                      {fmtTime(b.gastricEndMs, timeFormat)}
                    </text>
                  </g>
                );
              })}

              {/* Hour / half-hour ruler ticks (hang below track) */}
              {hourTicks.map((tick, i) => {
                if (!tick.isHour && !showHalfTicks) return null;
                const x = px(tick.ms);
                if (x < 0 || x > SCROLL_W) return null;
                return (
                  <g key={`ht-${i}`}>
                    <line
                      x1={x} y1={HOUR_TICK_Y}
                      x2={x} y2={tick.isHour ? HOUR_TICK_Y + 9 : HOUR_TICK_Y + 5}
                      stroke={tick.isHour ? '#334155' : '#293548'}
                      strokeWidth={tick.isHour ? 1.5 : 1}
                    />
                    {tick.isHour && showHourLabels && (
                      <text x={x} y={HOUR_LABEL_Y}
                        textAnchor="middle" fontSize={FS_HOUR}
                        fill="#475569" fontFamily="monospace">
                        {fmtHour(tick.ms, timeFormat)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Main track */}
              <line x1={0} y1={TRACK_Y} x2={SCROLL_W} y2={TRACK_Y}
                stroke="#334155" strokeWidth="1.5" />

              {/* "Now" dashed reference line */}
              {(() => {
                const nowX = px(now);
                return (
                  <g>
                    <line x1={nowX} y1={0} x2={nowX} y2={SVG_H}
                      stroke="#475569" strokeWidth="1" strokeDasharray="3 3" opacity="0.28" />
                    <text x={nowX} y={12}
                      textAnchor="middle" fontSize={9} fill="#475569" fontFamily="monospace">
                      now
                    </text>
                  </g>
                );
              })()}

              {/* Feed markers */}
              {allMarkers.map((m, i) => {
                const x       = m.x;
                const isLift  = lifted[i];
                const isDrop  = timeDrop[i];
                const labelY  = isLift ? LABEL_LIFTED_Y : LABEL_BASE_Y;
                const headerY = labelY - HEADER_Y_OFFSET;
                const timeY   = isDrop ? TIME_DROP_Y : TIME_BASE_Y;
                const nHW     = labelWidth(m.numStr, FS_LABEL, false) / 2;

                return (
                  <g key={i}>
                    {isLift && (
                      <line x1={x} y1={labelY+4} x2={x} y2={TRACK_Y-10}
                        stroke={m.dotColor} strokeWidth="1" strokeDasharray="3 2" opacity="0.55" />
                    )}
                    {isDrop && (
                      <line x1={x} y1={TRACK_Y+8} x2={x} y2={timeY-4}
                        stroke={m.dotColor} strokeWidth="1" strokeDasharray="3 2" opacity="0.45" />
                    )}
                    {!isLift && (
                      <line x1={x} y1={TRACK_Y-8} x2={x} y2={TRACK_Y+8}
                        stroke={m.dotColor} strokeWidth="1.5" />
                    )}
                    <circle cx={x} cy={TRACK_Y} r={6}
                      fill={m.fillDot ? m.dotColor : '#1e293b'}
                      stroke={m.dotColor} strokeWidth={2.5} />
                    {m.header && (
                      <text x={x} y={headerY} textAnchor="middle"
                        fontSize={FS_HEADER} fill="#64748b" fontFamily="system-ui,sans-serif">
                        {m.header}
                      </text>
                    )}
                    <text x={x} y={labelY} textAnchor="middle"
                      fontSize={FS_LABEL} fontWeight="bold"
                      fill={m.labelColor} fontFamily="monospace">
                      {m.numStr}
                    </text>
                    {m.showEmoji && (
                      <text x={x+nHW} y={labelY}
                        textAnchor="start" fontSize={FS_LABEL} fill={m.labelColor}>
                        🍼
                      </text>
                    )}
                    <text x={x} y={timeY} textAnchor="middle"
                      fontSize={FS_TIME} fontWeight="600"
                      fill={m.labelColor} fontFamily="monospace">
                      {m.time}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* ── stretch strip ── */}
          <div
            className="mt-1.5 rounded-md select-none"
            style={{ touchAction: 'none', height: `${STRIP_H}px`, cursor: 'col-resize' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <svg width={cardWidth} height={STRIP_H} style={{ display: 'block' }}>
              {/* Track background */}
              <rect x={0} y={0} width={cardWidth} height={STRIP_H}
                rx={6} fill="rgba(15,23,42,0.55)" />
              {/* Rail */}
              <line x1={STRIP_PAD} y1={STRIP_H/2} x2={cardWidth-STRIP_PAD} y2={STRIP_H/2}
                stroke="#334155" strokeWidth={1.5} />
              {/* − / + labels */}
              <text x={STRIP_PAD-4} y={STRIP_H/2+4}
                textAnchor="end" fontSize={10} fill="#475569" fontFamily="monospace">−</text>
              <text x={cardWidth-STRIP_PAD+4} y={STRIP_H/2+4}
                textAnchor="start" fontSize={10} fill="#475569" fontFamily="monospace">+</text>
              {/* Default-position diamond */}
              <polygon
                points={`${defX},${STRIP_H/2-5} ${defX+4},${STRIP_H/2} ${defX},${STRIP_H/2+5} ${defX-4},${STRIP_H/2}`}
                fill={isNearDef ? '#4ade80' : '#334155'}
                stroke={isNearDef ? '#86efac' : '#475569'}
                strokeWidth={1}
              />
              {/* Indicator circle */}
              <circle cx={indX} cy={STRIP_H/2} r={7}
                fill={isNearDef ? '#4ade80' : '#475569'}
                stroke={isNearDef ? '#86efac' : '#64748b'}
                strokeWidth={1.5} />
            </svg>
          </div>
        </div>

        {allFuture && (() => {
          const currentSmoothed = smoothedAtTime(feeds, hourlyRate, now);
          const isStomachLimited = currentSmoothed < dailyTargetMl;
          return (
            <div className="text-xs mt-1.5 px-0.5">
              {isStomachLimited
                ? <span className="text-slate-400">Stomach full — next feed at {fmtTime(progression[0].readyAtMs, timeFormat)}</span>
                : <span className="text-orange-400">Well fed — all sizes available later</span>
              }
            </div>
          );
        })()}
      </div>
    </div>
  );
}
