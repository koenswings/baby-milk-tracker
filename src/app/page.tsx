"use client";

import { useEffect, useState, useCallback } from "react";
import { getFeeds, getSettings, getWeights, addWeight, saveSettings, migrateFromLocalStorage } from "@/lib/store";
import { WeightEntry } from "@/lib/weights";
import {
  deriveSettings,
  strict24hTotal,
  smoothedEffective,
  smoothedAtTime,
  waterToMilk,
  milkToWater,
  computePredictors,
} from "@/lib/calculations";
import { Feed, Settings, DerivedSettings, PredictorResult } from "@/types";
import Strict24hExplainer from "@/components/Strict24hExplainer";
import SmoothedExplainer from "@/components/SmoothedExplainer";
import DailyTargetCard from "@/components/cards/DailyTargetCard";
import StatusCard from "@/components/cards/StatusCard";
import CanTakeCard from "@/components/cards/CanTakeCard";
import FeedingTimelineCards from "@/components/cards/FeedingTimelineCards";
import BottomNav from "@/components/BottomNav";
import Link from "next/link";
import { formatTime } from "@/lib/formatTime";
import { estimateZChannel, predictWeightKg } from "@/lib/whoGrowth";

function formatRelative(ms: number, now: number): string {
  const diff = ms - now;
  const absDiff = Math.abs(diff);
  const mins = Math.round(absDiff / 60000);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  const timeStr = hrs > 0 ? `${hrs}h ${remMins}m` : `${mins}m`;
  return diff > 0 ? `in ${timeStr}` : `${timeStr} ago`;
}

function formatIntervalLabel(ms: number): string {
  const totalMins = Math.round(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function DigClock({ ts, timeFormat, sub }: { ts: number | null; timeFormat: '24h' | '12h'; sub?: string }) {
  if (!ts) return <span className="text-slate-500 text-xs">No feeds yet</span>;
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = timeFormat === '12h' ? (h >= 12 ? 'PM' : 'AM') : null;
  if (timeFormat === '12h') h = h % 12 || 12;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return (
    <>
      <div className="font-mono font-bold text-2xl text-blue-300 tracking-widest tabular-nums leading-none">
        {hh}<span className="text-slate-500">:</span>{mm}
        {ampm && <span className="text-sm text-slate-400 ml-0.5">{ampm}</span>}
      </div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </>
  );
}

export default function Dashboard() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [derived, setDerived] = useState<DerivedSettings | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showStrictExplainer, setShowStrictExplainer] = useState(false);
  const [showSmoothedExplainer, setShowSmoothedExplainer] = useState(false);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [newWeightKg, setNewWeightKg] = useState('');
  const [newWeightTime, setNewWeightTime] = useState('');
  const [showBottlePicker, setShowBottlePicker] = useState(false);
  const [predictors, setPredictors] = useState<PredictorResult | null>(null);
  const [showBabyProfile, setShowBabyProfile] = useState(false);
  const [profileSex, setProfileSex] = useState<'F' | 'M' | null>(null);
  const [profileDob, setProfileDob] = useState('');

  const load = useCallback(async () => {
    await migrateFromLocalStorage();
    const [f, s, w] = await Promise.all([getFeeds(), getSettings(), getWeights()]);
    setFeeds(f);
    setSettings(s);
    const d = deriveSettings(s);
    setDerived(d);
    setWeights(w);
    setNow(Date.now());
    // Compute predictors
    const preds = computePredictors(f, d.hourlyRate, d.dailyTargetMl, s.preferredBottleWaterMl);
    setPredictors(preds);
    // Show baby profile onboarding if DOB or sex is missing
    if (!s.dateOfBirthMs || !s.sex) {
      setProfileSex(s.sex ?? null);
      setProfileDob(s.dateOfBirthMs ? new Date(s.dateOfBirthMs).toISOString().slice(0, 10) : '');
      setShowBabyProfile(true);
    }
  }, []);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "bmt_feeds" || e.key === "bmt_settings") load();
    };
    window.addEventListener("storage", onStorage);
    const clockInterval = setInterval(() => setNow(Date.now()), 60000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      clearInterval(clockInterval);
    };
  }, [load]);

  if (!settings || !derived) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-slate-400">Loading…</div>
      </div>
    );
  }

  const lastFeed = feeds.length > 0
    ? feeds.reduce((a, b) => (a.timestamp > b.timestamp ? a : b))
    : null;

  const smoothedAt = lastFeed ? lastFeed.timestamp : now;
  const strict24h = strict24hTotal(feeds, smoothedAt);
  const liveSmoothedMl = smoothedAtTime(feeds, derived.hourlyRate, now);
  const liveSmoothedPct = (liveSmoothedMl / derived.dailyTargetMl) * 100;
  const { totalMl: smoothedMl } = smoothedEffective(
    feeds,
    derived.hourlyRate,
    settings.preferredBottleWaterMl,
    smoothedAt
  );
  const strict24hPct = (strict24h / derived.dailyTargetMl) * 100;
  const smoothedPct = (smoothedMl / derived.dailyTargetMl) * 100;

  // WHO z-score and effective weight
  const startOfToday = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
  let effectiveWeightKg = settings.weightKg;
  let zScore: number | null = null;
  let weightSource: 'manual' | 'predicted' = 'manual';
  if (settings.dateOfBirthMs && settings.sex && weights.length >= 1) {
    zScore = estimateZChannel(weights, settings.dateOfBirthMs, settings.sex);
    // Only use the WHO growth model prediction if there is no recent measurement.
    // If a real weigh-in exists within the last 7 days, use it directly — projecting
    // forward from historical z-scores would override a fresh measurement with a
    // potentially higher estimate (e.g. showing 7.62 kg when 7.5 kg was measured yesterday).
    const latestWeight = [...weights].sort((a, b) => b.timestamp - a.timestamp)[0];
    const daysSinceLastWeigh = (startOfToday - latestWeight.timestamp) / 86_400_000;
    if (daysSinceLastWeigh <= 7) {
      effectiveWeightKg = latestWeight.weightKg;
      weightSource = 'manual';
    } else {
      const predicted = predictWeightKg(weights, settings.dateOfBirthMs, settings.sex, startOfToday);
      if (predicted !== null && predicted > 0) {
        effectiveWeightKg = predicted;
        weightSource = 'predicted';
      }
    }
  }
  const effectiveDailyTargetMl = effectiveWeightKg * settings.mlPerKgPerDay;

  const tf = settings.timeFormat;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-2xl font-bold text-slate-100">🍼 MilkWise</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">v1.1.51</span>
          <Link
            href="/info/app"
            className="w-5 h-5 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-400 text-xs font-bold flex items-center justify-center leading-none"
          >?</Link>
        </div>
      </div>
      <p className="text-slate-400 text-sm mb-4">
        {effectiveWeightKg.toFixed(2)} kg{weightSource === 'predicted' ? ' (est.)' : ''}
        {zScore !== null && (
          <span className={`ml-2 font-semibold ${
            Math.abs(zScore) <= 1 ? 'text-green-400' :
            Math.abs(zScore) <= 2 ? 'text-yellow-400' : 'text-red-400'
          }`}>Z {zScore >= 0 ? '+' : ''}{zScore.toFixed(1)}</span>
        )}
        {' · '}Target: {Math.round(effectiveDailyTargetMl)} ml/day
      </p>

      {/* Three equal action buttons */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Link
          href="/log"
          className="text-center bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          ➕ Log Feed
        </Link>
        <button
          onClick={() => {
            const d = new Date();
            const pad = (n: number) => String(n).padStart(2, '0');
            const local = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            setNewWeightKg(settings.weightKg.toString());
            setNewWeightTime(local);
            setShowWeightModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          ⚖️ Weight
        </button>
        <button
          onClick={() => setShowBottlePicker(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          🍼 Bottle Size
        </button>
      </div>

      {/* Baby profile onboarding modal */}
      {showBabyProfile && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm border border-slate-700">
            <h2 className="text-lg font-bold text-slate-100 mb-1">👶 Baby profile</h2>
            <p className="text-sm text-slate-400 mb-5">Needed for the WHO growth model and automatic weight tracking.</p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-slate-300 font-medium mb-2">Sex</label>
                <div className="flex gap-2">
                  {(['F', 'M'] as const).map(s => (
                    <button key={s} onClick={() => setProfileSex(s)}
                      className={`flex-1 py-2.5 rounded-xl font-semibold transition-colors ${
                        profileSex === s ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}>
                      {s === 'F' ? '👧 Girl' : '👦 Boy'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-300 font-medium mb-2">🎂 Date of birth</label>
                <input
                  type="date"
                  value={profileDob}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={e => setProfileDob(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <button
              disabled={!profileSex || !profileDob}
              onClick={async () => {
                if (!profileSex || !profileDob || !settings) return;
                const dob = new Date(profileDob + 'T00:00:00').getTime();
                const updated = { ...settings, sex: profileSex, dateOfBirthMs: dob };
                await saveSettings(updated);
                setShowBabyProfile(false);
                await load();
              }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
            >
              Save &amp; continue
            </button>
          </div>
        </div>
      )}

      {/* Weight modal */}
      {showWeightModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowWeightModal(false)}>
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-100 mb-4">⚖️ Update Weight</h2>
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Weight (kg)</label>
                <input type="number" step="0.01" min="1" max="30"
                  value={newWeightKg} onChange={e => setNewWeightKg(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 text-lg focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Date &amp; time</label>
                <input type="datetime-local"
                  value={newWeightTime} onChange={e => setNewWeightTime(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowWeightModal(false)} className="flex-1 py-3 bg-slate-700 text-slate-300 rounded-xl">Cancel</button>
              <button
                onClick={async () => {
                  const kg = parseFloat(newWeightKg);
                  if (isNaN(kg) || kg <= 0) { alert('Please enter a valid weight'); return; }
                  const ts = newWeightTime ? new Date(newWeightTime).getTime() : Date.now();
                  if (isNaN(ts)) { alert('Invalid date/time'); return; }
                  try {
                    await addWeight({ timestamp: ts, weightKg: kg });
                    setShowWeightModal(false);
                    await load();
                  } catch(e) {
                    alert('Save failed: ' + String(e));
                  }
                }}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preferred bottle picker modal */}
      {showBottlePicker && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 pb-24" onClick={() => setShowBottlePicker(false)}>
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-100 mb-1">🍼 Preferred Bottle Size</h2>
            <p className="text-sm text-slate-400 mb-5">Sets the standard interval and predictor targets.</p>
            <div className="grid grid-cols-2 gap-3">
              {[60, 90, 120, 150].map((v) => {
                const milkMl = Math.round(waterToMilk(v));
                const isSelected = settings.preferredBottleWaterMl === v;
                return (
                  <button
                    key={v}
                    onClick={async () => {
                      const updated = { ...settings, preferredBottleWaterMl: v };
                      await saveSettings(updated);
                      setShowBottlePicker(false);
                      await load();
                    }}
                    className={`py-4 rounded-xl font-semibold transition-colors flex flex-col items-center gap-1 ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    <span className="text-lg">{v} ml</span>
                    <span className={`text-xs ${isSelected ? 'text-blue-200' : 'text-slate-500'}`}>= {milkMl} ml milk</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Daily target card */}
      <DailyTargetCard
        settings={settings}
        derived={derived}
      />

      {/* Status card */}
      <StatusCard
        strict24h={strict24h}
        strictPct={strict24hPct}
        smoothedMl={smoothedMl}
        smoothedPct={smoothedPct}
        liveSmoothedMl={liveSmoothedMl}
        liveSmoothedPct={liveSmoothedPct}
        dailyTargetMl={derived.dailyTargetMl}
        standardBottleVolume={settings.preferredBottleWaterMl}
        hourlyRate={derived.hourlyRate}
        yellowThresholdPct={settings.yellowThresholdPct}
        redThresholdPct={settings.redThresholdPct}
        onStrictExplain={() => setShowStrictExplainer(true)}
        onSmoothedExplain={() => setShowSmoothedExplainer(true)}
        feeds={feeds}
        weights={weights}
        now={now}
      />

      {showStrictExplainer && (
        <Strict24hExplainer onClose={() => setShowStrictExplainer(false)} />
      )}
      {showSmoothedExplainer && derived && (
        <SmoothedExplainer
          onClose={() => setShowSmoothedExplainer(false)}
          hourlyRate={derived.hourlyRate}
          preferredBottleWaterMl={settings.preferredBottleWaterMl}
          dailyTargetMl={derived.dailyTargetMl}
          feeds={feeds}
          now={smoothedAt}
        />
      )}

      {/* Row 1: Last Feed + Next Feed — hidden while evaluating Feeding Timeline */}

      {/* Row 2: Feeding Timeline — enabled for evaluation */}
      {predictors && settings && derived && (
        <div className="mb-4">
          {(settings.feedingTimelineView ?? 'timeline') === 'timeline' ? (
            <CanTakeCard
              predictors={predictors}
              preferredBottleWaterMl={settings.preferredBottleWaterMl}
              feeds={feeds}
              now={now}
              hourlyRate={derived.hourlyRate}
              dailyTargetMl={derived.dailyTargetMl}
              timeFormat={settings.timeFormat}
            />
          ) : (
            <FeedingTimelineCards
              predictors={predictors}
              preferredBottleWaterMl={settings.preferredBottleWaterMl}
              feeds={feeds}
              now={now}
              hourlyRate={derived.hourlyRate}
              dailyTargetMl={derived.dailyTargetMl}
              timeFormat={settings.timeFormat}
            />
          )}
        </div>
      )}

      {/* Summary stats row */}
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
