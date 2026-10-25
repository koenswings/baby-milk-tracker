"use client";

// Zones timeline (default view). design/2026-10-25-feeding-zones.md §3.2, §10, §11.
// One row per bottle size (30 … preferred + 1), Okabe-Ito colour per size. Each size's zone is a
// bar from open (max(stomach fits, 105 %)) to close (100 %); a collapsed size is a ring at the time
// it fits the stomach, labelled with its landing %. History runs from midnight; each actual feed is
// a vertical line that cuts the diagram, and the zones after it are recomputed with that feed and
// the settings in effect at that feed. Exactly one size is emphasised (closest to 100 % in zone,
// else the largest fitting size under target); other in-zone sizes are dimmed, not hidden.

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Feed, Settings } from "@/types";
import { ZoneRow } from "@/lib/calculations";
import { HistoryEntry } from "@/lib/settingsHistory";
import { sizeColour } from "@/lib/sizeColours";
import { highlightSegmentsAt, zoneSegments } from "@/lib/zoneSegments";

interface Props {
  feeds: Feed[];
  settings: Settings;
  history: HistoryEntry[];
  weights: Array<{ timestamp: number; weightKg: number }>; // weigh-ins: D per segment = weight at its feed
  now: number;           // display clock: highlight and "now" line only
  timeFormat: "24h" | "12h";
}

const HOUR_MS = 3_600_000;
const PAD = 32;
const ROW_H = 30;
const TOP = 34;

function fmtTime(ms: number, tf: "24h" | "12h"): string {
  const d = new Date(ms);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = tf === "12h" ? (h >= 12 ? "PM" : "AM") : null;
  if (tf === "12h") h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}${ampm ? " " + ampm : ""}`;
}

function fmtHour(ms: number, tf: "24h" | "12h"): string {
  const h = new Date(ms).getHours();
  if (tf === "12h") return `${h % 12 || 12}${h >= 12 ? "p" : "a"}`;
  return `${String(h).padStart(2, "0")}`;
}

function zoneLabel(r: ZoneRow, tf: "24h" | "12h"): string {
  if (r.state === "collapsed") return `${r.waterMl} ml ○ ${Math.round(r.landingAtOpenPct)}%`;
  if (r.state === "beyond-horizon") return `${r.waterMl} ml · later`;
  return `${r.waterMl} ml ${fmtTime(r.openMs, tf)}–${fmtTime(r.closeMs!, tf)} · ${Math.round(r.landingAtOpenPct)}→100%`;
}

export default function ZonesTimelineCard({ feeds, settings, history, weights, now, timeFormat }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(340);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new ResizeObserver((e) => setCardWidth(e[0].contentRect.width));
    obs.observe(el);
    setCardWidth(el.clientWidth);
    return () => obs.disconnect();
  }, []);

  const dayStart = (() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  // Zones frozen at the last feed: recomputed only when the data changes (or the day rolls over),
  // never on a clock tick. A tick re-runs only the highlight (§10).
  const frozen = useMemo(
    () => zoneSegments(feeds, settings, history, weights, dayStart),
    [feeds, settings, history, weights, dayStart],
  );
  const segments = useMemo(() => highlightSegmentsAt(frozen, feeds, now), [frozen, feeds, now]);
  const current = segments.find((s) => s.isCurrent) ?? null;

  const sizes = [...new Set(segments.flatMap((s) => s.rows.map((r) => r.waterMl)))].sort((a, b) => a - b);
  const rowIndex = new Map(sizes.map((w, i) => [w, i]));

  // ── time bounds ──
  const T_START = Math.min(dayStart, segments[0]?.fromMs ?? dayStart);
  const currentEnds = current
    ? current.rows.filter((r) => r.state !== "beyond-horizon").map((r) => r.closeMs ?? r.openMs)
    : [];
  const T_END = Math.max(now + HOUR_MS, ...currentEnds) + 30 * 60_000;
  const spanMs = T_END - T_START;
  const scale = Math.max((cardWidth - PAD) / spanMs, 70 / HOUR_MS); // ≥ 70 px per hour
  const W = Math.ceil(spanMs * scale) + PAD;
  const px = (ms: number) => PAD / 2 + (ms - T_START) * scale;
  const rowY = (w: number) => TOP + (rowIndex.get(w) ?? 0) * ROW_H;
  const H = TOP + sizes.length * ROW_H + 30;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = Math.max(0, px(now) - cardWidth * 0.5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardWidth, T_START]);

  const ticks: number[] = [];
  for (let t = Math.ceil(T_START / HOUR_MS) * HOUR_MS; t <= T_END; t += HOUR_MS) ticks.push(t);

  const highlighted = current?.rows.find((r) => r.isHighlighted) ?? null;
  const nextOpen = current?.rows
    .filter((r) => r.state === "zone" && r.openMs > now)
    .sort((a, b) => a.openMs - b.openMs)[0];

  return (
    <div ref={wrapRef} className="bg-slate-800 rounded-xl p-3">
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="text-sm font-semibold text-slate-300">🍼 Feeding zones</h2>
        <span className="text-xs text-slate-500">bar = lands 105→100 %</span>
      </div>
      <div className="text-sm mb-2" data-testid="zones-advice">
        {highlighted ? (
          <span style={{ color: sizeColour(highlighted.waterMl) }} className="font-bold">
            {highlighted.waterMl} ml · NOW
            {highlighted.highlightKind === "under-target"
              ? ` — under target (${Math.round(highlighted.landingNowPct)}%)`
              : ` — lands ${Math.round(highlighted.landingNowPct)}%`}
          </span>
        ) : nextOpen ? (
          <span className="text-slate-300">Next: {nextOpen.waterMl} ml from {fmtTime(nextOpen.openMs, timeFormat)}</span>
        ) : (
          <span className="text-slate-400">{segments.length === 0 ? "No feeds yet" : "No size fits yet"}</span>
        )}
        {current?.approximate && <span className="text-xs text-slate-500"> · settings approximate</span>}
      </div>
      <div ref={scrollRef} className="overflow-x-auto">
        <svg width={W} height={H} role="img" aria-label="Feeding zones timeline">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={px(t)} x2={px(t)} y1={TOP - 6} y2={H - 24} stroke="#334155" strokeWidth={0.5} />
              <text x={px(t)} y={H - 10} fill="#64748b" fontSize={9} textAnchor="middle">{fmtHour(t, timeFormat)}</text>
            </g>
          ))}
          {sizes.map((w) => (
            <text key={w} x={2} y={rowY(w) + 4} fill={sizeColour(w)} fontSize={9}>{w}</text>
          ))}

          {segments.map((seg) => {
            const segEnd = seg.toMs ?? T_END;
            return seg.rows.map((r) => {
              if (r.state === "beyond-horizon") return null;
              const y = rowY(r.waterMl);
              const colour = sizeColour(r.waterMl);
              const emphasised = seg.isCurrent && r.isHighlighted;
              const inZoneNow = seg.isCurrent && r.state === "zone" && r.openMs <= now && now < (r.closeMs ?? 0);
              const opacity = !seg.isCurrent ? 0.25 : emphasised ? 1 : inZoneNow ? 0.4 : 0.6;
              const showLabel = seg.isCurrent;
              if (r.state === "collapsed") {
                if (r.openMs >= segEnd) return null; // cut by the next feed
                const x = px(Math.max(r.openMs, seg.fromMs));
                return (
                  <g key={`${seg.feed.id}-${r.waterMl}`} opacity={opacity}>
                    <circle cx={x} cy={y} r={6} fill="none" stroke={colour} strokeWidth={emphasised ? 3 : 2} />
                    {showLabel && (
                      <text x={x + 9} y={y + 4} fill={colour} fontSize={11} fontWeight={emphasised ? 700 : 400}>
                        {zoneLabel(r, timeFormat)}{emphasised ? " · NOW" : ""}
                      </text>
                    )}
                  </g>
                );
              }
              const x1 = px(Math.max(r.openMs, seg.fromMs));
              const x2 = px(Math.min(r.closeMs!, segEnd));
              if (x2 <= x1) return null; // zone entirely cut off by the next feed
              return (
                <g key={`${seg.feed.id}-${r.waterMl}`} opacity={opacity}>
                  <rect x={x1} y={y - 7} width={x2 - x1} height={14} rx={3} fill={colour}
                    stroke={emphasised ? "#ffffff" : "none"} strokeWidth={emphasised ? 2 : 0} />
                  {showLabel && (
                    <text x={x1} y={y - 10} fill={colour} fontSize={11} fontWeight={emphasised ? 700 : 400}>
                      {zoneLabel(r, timeFormat)}{emphasised ? " · NOW" : ""}
                    </text>
                  )}
                </g>
              );
            });
          })}

          {segments.filter((s) => s.feed.timestamp >= T_START).map((s) => (
            <g key={`feed-${s.feed.id}`}>
              <line x1={px(s.feed.timestamp)} x2={px(s.feed.timestamp)} y1={12} y2={H - 24} stroke="#e2e8f0" strokeWidth={1.5} />
              <text x={px(s.feed.timestamp) + 3} y={10} fill="#e2e8f0" fontSize={10}>
                {fmtTime(s.feed.timestamp, timeFormat)} · {s.feed.volume}
              </text>
            </g>
          ))}
          <line x1={px(now)} x2={px(now)} y1={TOP - 12} y2={H - 24} stroke="#4ade80" strokeWidth={1.5} strokeDasharray="4 3" />
          <text x={px(now) + 3} y={H - 26} fill="#4ade80" fontSize={9}>now</text>
        </svg>
      </div>
    </div>
  );
}
