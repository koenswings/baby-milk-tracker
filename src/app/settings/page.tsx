"use client";

import { useEffect, useState } from "react";
import { getSettings, saveSettings } from "@/lib/store";
import { deriveSettings } from "@/lib/calculations";
import { Settings } from "@/types";
import BottomNav from "@/components/BottomNav";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    weightKg: 6.27,
    mlPerKgPerDay: 150,
    standardBottleVolume: 90,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const derived = deriveSettings(settings);

  async function handleSave() {
    await saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function update(field: keyof Settings, value: string) {
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) {
      setSettings((prev) => ({ ...prev, [field]: num }));
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
      <h1 className="text-2xl font-bold text-slate-100 mb-6">⚙️ Settings</h1>

      <div className="space-y-4 mb-6">
        <div className="bg-slate-800 rounded-xl p-4">
          <label className="block text-sm text-slate-400 mb-1">Baby weight (kg)</label>
          <input
            type="number"
            value={settings.weightKg}
            onChange={(e) => update("weightKg", e.target.value)}
            step="0.01"
            min="0.5"
            max="30"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 text-lg focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="bg-slate-800 rounded-xl p-4">
          <label className="block text-sm text-slate-400 mb-1">ml per kg per day</label>
          <input
            type="number"
            value={settings.mlPerKgPerDay}
            onChange={(e) => update("mlPerKgPerDay", e.target.value)}
            step="5"
            min="50"
            max="300"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 text-lg focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="bg-slate-800 rounded-xl p-4">
          <label className="block text-sm text-slate-400 mb-1">Standard bottle volume (ml)</label>
          <input
            type="number"
            value={settings.standardBottleVolume}
            onChange={(e) => update("standardBottleVolume", e.target.value)}
            step="5"
            min="30"
            max="300"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 text-lg focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Derived values */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6">
        <h2 className="text-sm font-semibold text-slate-400 mb-3">Auto-calculated</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Daily target</span>
            <span className="text-slate-100 font-medium">{derived.dailyTargetMl.toFixed(1)} ml</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Hourly rate</span>
            <span className="text-slate-100 font-medium">{derived.hourlyRate.toFixed(2)} ml/h</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Ideal interval</span>
            <span className="text-slate-100 font-medium">{derived.idealIntervalHours.toFixed(2)} hours</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        className={`w-full font-semibold py-4 rounded-xl text-lg transition-colors ${
          saved
            ? "bg-green-600 text-white"
            : "bg-blue-600 hover:bg-blue-500 text-white"
        }`}
      >
        {saved ? "✓ Saved!" : "Save Settings"}
      </button>

      <BottomNav />
    </div>
  );
}
