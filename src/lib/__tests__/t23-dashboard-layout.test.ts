// 1.1.60 layout: Daily Target card sits below the feeding timeline in every view
// (zones, classic, cards) and above the summary stats; Status card stays above the timeline.
import fs from "fs";
import path from "path";

const src = fs.readFileSync(path.join(__dirname, "../../app/page.tsx"), "utf8");
const pos = (needle: string) => { const i = src.indexOf(needle); expect(i).toBeGreaterThan(-1); return i; };

test("order: Status → timeline (all three views) → Daily Target → summary stats", () => {
  const status = pos("<StatusCard");
  const zones = pos("<ZonesTimelineCard");
  const classic = pos("<CanTakeCard");
  const cards = pos("<FeedingTimelineCards");
  const daily = pos("<DailyTargetCard");
  const summary = pos("{/* Summary stats row */}");
  expect(status).toBeLessThan(zones);
  expect(Math.max(zones, classic, cards)).toBeLessThan(daily);
  expect(daily).toBeLessThan(summary);
  expect(src.split("<DailyTargetCard").length - 1).toBe(1);
});
