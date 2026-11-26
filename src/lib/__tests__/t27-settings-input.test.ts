// t27 — settings number inputs (design/2026-11-26-live-rules-and-weight-anchor.md §10): commit on
// blur or Enter, never mid-keystroke; out-of-range values (e.g. ml/kg = 1) are refused.
import fs from "fs";
import path from "path";
import { SETTING_LIMITS, parseSettingValue, thresholdsError } from "@/lib/settingsLimits";

describe("parseSettingValue", () => {
  test("ml/kg = 1 is refused; 80 and 150 accepted; limits inclusive (50–200)", () => {
    expect(parseSettingValue("mlPerKgPerDay", "1").ok).toBe(false);
    expect(parseSettingValue("mlPerKgPerDay", "49").ok).toBe(false);
    expect(parseSettingValue("mlPerKgPerDay", "201").ok).toBe(false);
    expect(parseSettingValue("mlPerKgPerDay", "80")).toEqual({ ok: true, value: 80 });
    expect(parseSettingValue("mlPerKgPerDay", "150")).toEqual({ ok: true, value: 150 });
    expect(parseSettingValue("mlPerKgPerDay", "50")).toEqual({ ok: true, value: 50 });
    expect(parseSettingValue("mlPerKgPerDay", "200")).toEqual({ ok: true, value: 200 });
  });
  test("intermediate keystrokes of 150 → 80 are all refused or harmless", () => {
    // Typing over 150: "" → "8" → "80". Neither "" nor "8" may be committed.
    expect(parseSettingValue("mlPerKgPerDay", "").ok).toBe(false);
    expect(parseSettingValue("mlPerKgPerDay", "8").ok).toBe(false);
  });
  test("empty / non-numeric refused; decimal comma accepted", () => {
    expect(parseSettingValue("weightKg", "").ok).toBe(false);
    expect(parseSettingValue("weightKg", "abc").ok).toBe(false);
    expect(parseSettingValue("weightKg", "9,5")).toEqual({ ok: true, value: 9.5 });
    expect(parseSettingValue("weightKg", "0.4").ok).toBe(false);
    expect(parseSettingValue("weightKg", "31").ok).toBe(false);
  });
  test("thresholds 1–50 and red > yellow", () => {
    expect(parseSettingValue("yellowThresholdPct", "0").ok).toBe(false);
    expect(parseSettingValue("redThresholdPct", "51").ok).toBe(false);
    expect(parseSettingValue("yellowThresholdPct", "5")).toEqual({ ok: true, value: 5 });
    expect(thresholdsError(5, 10)).toBeNull();
    expect(thresholdsError(10, 10)).not.toBeNull();
    expect(thresholdsError(12, 10)).not.toBeNull();
  });
  test("bottle size 30–210 ml water", () => {
    expect(parseSettingValue("preferredBottleWaterMl", "20").ok).toBe(false);
    expect(parseSettingValue("preferredBottleWaterMl", "120")).toEqual({ ok: true, value: 120 });
    expect(SETTING_LIMITS.preferredBottleWaterMl).toMatchObject({ min: 30, max: 210 });
  });
});

describe("web settings page", () => {
  const src = fs.readFileSync(path.join(__dirname, "../../app/settings/page.tsx"), "utf8");
  test("no auto-save while typing: no debounced save effect, onChange never saves", () => {
    expect(src).not.toMatch(/setTimeout\(\s*\(\)\s*=>\s*\{?\s*saveSettings/);
    expect(src).not.toMatch(/useEffect\([^]*?saveSettings\(settings\)/);
    const onChanges = src.match(/onChange=\{\(e\) => handleChange\([^)]*\)\}/g) ?? [];
    expect(onChanges.length).toBe(4);
    expect(src).toMatch(/function handleChange\([^)]*\) \{\s*setLocalValues\([^;]*;\s*\}/);
  });
  test("each number field commits on blur and on Enter", () => {
    for (const f of ["weightKg", "mlPerKgPerDay", "yellowThresholdPct", "redThresholdPct"]) {
      expect(src).toContain(`onBlur={() => commitField("${f}")}`);
      expect(src).toContain(`onKeyDown={onEnter("${f}")}`);
    }
    expect(src).toMatch(/e\.key === "Enter"/);
    expect(src).toMatch(/parseSettingValue\(field, raw\)/);
  });
});

describe("header z and analytics", () => {
  test("dashboard header z = latest weigh-in z; analytics keeps the mean as 'average channel'", () => {
    const page = fs.readFileSync(path.join(__dirname, "../../app/page.tsx"), "utf8");
    expect(page).toMatch(/latestZScore\(weights, settings\.dateOfBirthMs, settings\.sex\)/);
    expect(page).not.toMatch(/estimateZChannel/);
    const analytics = fs.readFileSync(path.join(__dirname, "../../app/analytics/page.tsx"), "utf8");
    expect(analytics).toMatch(/estimateZChannel\(sorted2, dateOfBirthMs, sex\)/);
    expect(analytics).toMatch(/average channel/);
  });
});
