"use client";

import { Feed, Settings } from "@/types";

const DEFAULT_SETTINGS: Settings = {
  weightKg: 6.27,
  mlPerKgPerDay: 150,
  standardBottleVolume: 90,
};

const FEEDS_KEY = "bmt_feeds";
const SETTINGS_KEY = "bmt_settings";

// Simple localStorage wrapper (SSR-safe)
function isClient() {
  return typeof window !== "undefined";
}

export async function getFeeds(): Promise<Feed[]> {
  if (!isClient()) return [];
  const raw = localStorage.getItem(FEEDS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Feed[];
  } catch {
    return [];
  }
}

export async function saveFeeds(feeds: Feed[]): Promise<void> {
  if (!isClient()) return;
  localStorage.setItem(FEEDS_KEY, JSON.stringify(feeds));
}

export async function addFeed(feed: Feed): Promise<Feed[]> {
  const feeds = await getFeeds();
  const updated = [...feeds, feed];
  await saveFeeds(updated);
  return updated;
}

export async function updateFeed(id: string, partial: Partial<Feed>): Promise<Feed[]> {
  const feeds = await getFeeds();
  const updated = feeds.map((f) => (f.id === id ? { ...f, ...partial } : f));
  await saveFeeds(updated);
  return updated;
}

export async function deleteFeed(id: string): Promise<Feed[]> {
  const feeds = await getFeeds();
  const updated = feeds.filter((f) => f.id !== id);
  await saveFeeds(updated);
  return updated;
}

export async function getSettings(): Promise<Settings> {
  if (!isClient()) return DEFAULT_SETTINGS;
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  if (!isClient()) return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function exportCsv(feeds: Feed[]): void {
  const sorted = [...feeds].sort((a, b) => a.timestamp - b.timestamp);
  const rows = [
    ["#", "Date", "Time", "Volume (ml)"],
    ...sorted.map((f, i) => {
      const d = new Date(f.timestamp);
      return [
        String(i + 1),
        d.toLocaleDateString(),
        d.toLocaleTimeString(),
        String(f.volume),
      ];
    }),
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `milk-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
