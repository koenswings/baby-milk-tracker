// §7 #6 — all writers covered with the right source.
import { POST as settingsPOST } from "@/app/api/settings/route";
import { POST as weightsPOST } from "@/app/api/weights/route";
import { PATCH as weightPATCH, DELETE as weightDELETE } from "@/app/api/weights/[id]/route";
import { DEFAULT_SETTINGS, historyFile, writeSettings } from "@/lib/server-store";
import { sourceFromHeaders } from "@/lib/request-source";
import { readLines, tmpDataDir } from "@/lib/test-helpers";
import { NextRequest } from "next/server";

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest("http://localhost/api/settings", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });
const last = () => readLines(historyFile()).at(-1)!;

beforeEach(() => { tmpDataDir(); writeSettings({ ...DEFAULT_SETTINGS }, "web"); });

test("#6 settings POST from browser → web", async () => {
  await settingsPOST(post({ ...DEFAULT_SETTINGS, preferredBottleWaterMl: 120 }, { "user-agent": "Mozilla/5.0 Safari" }));
  expect(last().source).toBe("web");
});

test("#6 settings POST with X-MilkWise-Source: mobile → mobile", async () => {
  await settingsPOST(post({ ...DEFAULT_SETTINGS, preferredBottleWaterMl: 150 }, { "x-milkwise-source": "mobile" }));
  expect(last().source).toBe("mobile");
});

test("#6 native user agents → mobile", () => {
  for (const ua of ["okhttp/4.9.2", "MilkWise/24 CFNetwork/1490 Darwin/23.0.0"]) {
    expect(sourceFromHeaders(new Headers({ "user-agent": ua }))).toBe("mobile");
  }
  expect(sourceFromHeaders(new Headers())).toBe("web");
});

test("#6 weights POST/PATCH/DELETE → weights-sync", async () => {
  const res = await weightsPOST(new Request("http://l/api/weights", { method: "POST", body: JSON.stringify({ weightKg: 6.8, timestamp: 1000 }) }));
  const entry = await res.json();
  expect(last()).toMatchObject({ source: "weights-sync", changes: { weightKg: { old: 6.27, new: 6.8 } } });
  await weightsPOST(new Request("http://l/api/weights", { method: "POST", body: JSON.stringify({ weightKg: 7.0, timestamp: 2000 }) }));
  const second = readLines(historyFile()).length;
  await weightPATCH(new Request("http://l", { method: "PATCH", body: JSON.stringify({ weightKg: 7.1 }) }), { params: { id: (await (await weightsPOST(new Request("http://l", { method: "POST", body: JSON.stringify({ weightKg: 7.05, timestamp: 3000 }) }))).json()).id } });
  expect(readLines(historyFile()).length).toBeGreaterThan(second);
  expect(last().source).toBe("weights-sync");
  await weightDELETE(new Request("http://l", { method: "DELETE" }), { params: { id: entry.id } });
  expect(last().source).toBe("weights-sync");
});
