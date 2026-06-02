"use client";

import { useEffect, useState } from "react";
import { getFeeds, getSettings } from "@/lib/store";
import {
  deriveSettings,
  strict24hTotal,
  smoothedEffective,
  nextFeedTime,
} from "@/lib/calculations";
import { Feed, Settings, DerivedSettings } from "@/types";
import StatusBadge from "@/components/StatusBadge";
import BottomNav from "@/components/BottomNav";
import Link from "next/link";

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatRelative(ms: number, now: number): string {
  const diff = ms - now;
  const absDiff = Math.abs(diff);
  const mins = Math.round(absDiff / 60000);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  const timeStr = hrs > 0 ? `${hrs}h ${remMins}m` : `${mins}m`;
  return diff > 0 ? `in ${timeStr}` : `${timeStr} ago`;
}

export default function Dashboard() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [derived, setDerived] = useState<DerivedSettings | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    async function load() {
      const [f, s] = await Promise.all([getFeeds(), getSettings()]);
      setFeeds(f);
      setSettings(s);
      setDerived(deriveSettings(s));
    }
    load();

    // Refresh every minute
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  if (!settings || !derived) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-slate-400">Loading…</div>
      </div>
    );
  }

  const strict24h = strict24hTotal(feeds, now);
  const { totalMl: smoothedMl, bottles: smoothedBottles } = smoothedEffective(
    feeds,
    derived.hourlyRate,
    settings.standardBottleVolume,
    now
  );

  const strict24hPct = (strict24h / derived.dailyTargetMl) * 100;
  const smoothedPct = (smoothedMl / derived.dailyTargetMl) * 100;

  const nextFeed = nextFeedTime(feeds, derived.idealIntervalHours);

  const lastFeed = feeds.length > 0
    ? feeds.reduce((a, b) => (a.timestamp > b.timestamp ? a : b))
    : null;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
      <h1 className="text-2xl font-bold text-slate-100 mb-1">🍼 Baby Milk Tracker</h1>
      <p className="text-slate-400 text-sm mb-6">
        {settings.weightKg} kg · Target: {Math.round(derived.dailyTargetMl)} ml/day
      </p>

      {/* Quick log button */}
      <Link
        href="/log"
        className="block w-full text-center bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl mb-6 transition-colors"
      >
        ➕ Log Feed
      </Link>

      {/* Status cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatusBadge
          label="Strict 24h"
          value={`${Math.round(strict24h)} ml`}
          percentage={strict24hPct}
        />
        <StatusBadge
          label="Smoothed"
          value={`${smoothedBottles.toFixed(1)} bottles`}
          percentage={smoothedPct}
        />
      </div>

      {/* Next feed */}
      <div className="bg-slate-800 rounded-xl p-4 mb-4">
        <div className="text-sm text-slate-400 mb-1">Next suggested feed</div>
        {nextFeed ? (
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold text-blue-300">{formatTime(nextFeed)}</span>
            <span className="text-slate-400 text-sm">{formatRelative(nextFeed, now)}</span>
          </div>
        ) : (
          <span className="text-slate-400">No feeds logged yet</span>
        )}
        <div className="text-xs text-slate-500 mt-1">
          Ideal interval: {derived.idealIntervalHours.toFixed(1)}h
        </div>
      </div>

      {/* Last feed */}
      {lastFeed && (
        <div className="bg-slate-800 rounded-xl p-4 mb-4">
          <div className="text-sm text-slate-400 mb-1">Last feed</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold text-slate-200">{formatTime(lastFeed.timestamp)}</span>
            <span className="text-slate-400 text-sm">{lastFeed.volume} ml</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {formatRelative(lastFeed.timestamp, now)}
          </div>
        </div>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-800 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-slate-100">{feeds.length}</div>
          <div className="text-xs text-slate-400">Total feeds</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-slate-100">
            {feeds.filter((f) => f.timestamp >= now - 24 * 60 * 60 * 1000).length}
          </div>
          <div className="text-xs text-slate-400">Last 24h</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-slate-100">
            {Math.round(derived.hourlyRate * 10) / 10}
          </div>
          <div className="text-xs text-slate-400">ml/hour</div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
