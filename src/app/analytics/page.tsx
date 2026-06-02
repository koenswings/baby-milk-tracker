"use client";

import { useEffect, useState } from "react";
import { getFeeds, getSettings, exportCsv } from "@/lib/store";
import {
  dailyTotals,
  avgIntervalHours,
  consistencyScore,
  periodTotal,
  deriveSettings,
} from "@/lib/calculations";
import { Feed, Settings, DerivedSettings } from "@/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import BottomNav from "@/components/BottomNav";

export default function AnalyticsPage() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [derived, setDerived] = useState<DerivedSettings | null>(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    async function load() {
      const [f, s] = await Promise.all([getFeeds(), getSettings()]);
      setFeeds(f);
      setSettings(s);
      setDerived(deriveSettings(s));
    }
    load();
  }, []);

  if (!settings || !derived) {
    return <div className="flex items-center justify-center h-screen"><div className="text-slate-400">Loading…</div></div>;
  }

  const chartData = dailyTotals(feeds, days).map((d) => ({
    ...d,
    date: d.date.slice(5), // MM-DD
  }));

  const avgInterval = avgIntervalHours(feeds);
  const consistency = consistencyScore(feeds);
  const total3 = periodTotal(feeds, 3);
  const total7 = periodTotal(feeds, 7);
  const total14 = periodTotal(feeds, 14);

  const targetBottlesPerDay = derived.dailyTargetMl / settings.standardBottleVolume;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
      <h1 className="text-2xl font-bold text-slate-100 mb-6">📊 Analytics</h1>

      {/* Daily chart */}
      <div className="bg-slate-800 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-300">Daily Totals (ml)</h2>
          <div className="flex gap-1">
            <button
              onClick={() => setDays(7)}
              className={`px-3 py-1 rounded text-sm ${days === 7 ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-400"}`}
            >
              7d
            </button>
            <button
              onClick={() => setDays(30)}
              className={`px-3 py-1 rounded text-sm ${days === 30 ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-400"}`}
            >
              30d
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
            <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
              labelStyle={{ color: "#cbd5e1" }}
              itemStyle={{ color: "#93c5fd" }}
            />
            <ReferenceLine y={derived.dailyTargetMl} stroke="#4ade80" strokeDasharray="4 4" />
            <Bar dataKey="totalMl" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-slate-500 mt-1">Green dashed = daily target ({Math.round(derived.dailyTargetMl)} ml)</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Avg interval</div>
          <div className="text-xl font-bold text-slate-100">
            {avgInterval !== null ? `${avgInterval.toFixed(1)}h` : "—"}
          </div>
          <div className="text-xs text-slate-500">ideal: {derived.idealIntervalHours.toFixed(1)}h</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Consistency (σ)</div>
          <div className="text-xl font-bold text-slate-100">
            {consistency !== null ? `${consistency.toFixed(2)}h` : "—"}
          </div>
          <div className="text-xs text-slate-500">lower = more consistent</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Target bottles/day</div>
          <div className="text-xl font-bold text-slate-100">{targetBottlesPerDay.toFixed(1)}</div>
          <div className="text-xs text-slate-500">{settings.standardBottleVolume} ml each</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Total feeds</div>
          <div className="text-xl font-bold text-slate-100">{feeds.length}</div>
          <div className="text-xs text-slate-500">all time</div>
        </div>
      </div>

      {/* Period totals */}
      <div className="bg-slate-800 rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Period Totals</h2>
        <div className="space-y-2">
          {[{ label: "Last 3 days", ml: total3 }, { label: "Last 7 days", ml: total7 }, { label: "Last 14 days", ml: total14 }].map(({ label, ml }) => (
            <div key={label} className="flex justify-between items-center">
              <span className="text-sm text-slate-400">{label}</span>
              <span className="text-sm font-semibold text-slate-100">{Math.round(ml)} ml</span>
            </div>
          ))}
        </div>
      </div>

      {/* Export */}
      <button
        onClick={() => exportCsv(feeds)}
        className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium py-3 rounded-xl transition-colors"
      >
        📥 Export CSV
      </button>

      <BottomNav />
    </div>
  );
}
