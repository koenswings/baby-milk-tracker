"use client";

import Link from "next/link";
import { Feed } from "@/types";
import { waterToMilk, milkToWater, bottleCredit, stomachCapMilk, stomachLoad, FORMULA_TABLE } from "@/lib/calculations";

interface Props {
  onClose: () => void;
  hourlyRate: number;
  preferredBottleWaterMl: number;
  dailyTargetMl: number;
  feeds: Feed[];
  now: number;
}

export default function SmoothedExplainer({ onClose, hourlyRate, preferredBottleWaterMl, dailyTargetMl, feeds, now }: Props) {
  const milkPerBottle = waterToMilk(preferredBottleWaterMl);

  // Bottle credit table — frozen at last feed (display principle)
  const lastFeed = feeds.length > 0
    ? feeds.reduce((a, b) => (a.timestamp > b.timestamp ? a : b))
    : null;
  const creditRows = lastFeed
    ? [...feeds]
        .map((f) => {
          const ageHours = (lastFeed.timestamp - f.timestamp) / 3_600_000;
          const fullMilk = waterToMilk(f.volume);
          const creditMl = bottleCredit(ageHours, fullMilk, hourlyRate);
          return { f, ageHours, fullMilk, creditMl };
        })
        .filter((r) => r.creditMl > 0)
        .sort((a, b) => b.f.timestamp - a.f.timestamp)
    : [];
  const creditTotal = creditRows.reduce((sum, r) => sum + r.creditMl, 0);
  const creditTotalPct = dailyTargetMl > 0 ? (creditTotal / dailyTargetMl) * 100 : 0;

  // Stomach state at now
  const capMilk = stomachCapMilk(preferredBottleWaterMl, hourlyRate);
  const loadNow = stomachLoad(feeds, now);
  const roomNow = Math.max(0, capMilk - loadNow);
  const stomachFillPct = Math.min(100, (loadNow / capMilk) * 100);

  const fmtAge = (h: number) => {
    const totalMin = Math.max(0, Math.round(h * 60));
    return `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`;
  };
  const fmtClock = (ts: number) =>
    new Date(ts).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto mt-16 sm:mt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4">
          <button onClick={onClose} className="text-blue-400 hover:text-blue-300 text-sm">← Back to dashboard</button>
        </div>

        <div className="space-y-6 text-base text-slate-300 leading-relaxed mt-2">

          {/* ── Introduction ── */}
          <section>
            <h2 className="text-lg font-bold text-slate-100 mb-2">What does the Status card show?</h2>
            <p>
              This panel gives you a real-time picture of how well the baby is fed. It shows
              two complementary measurements side by side: the <strong className="text-slate-100">24h intake at last feed</strong>, which
              reflects the energy the baby has received and used over the past day, and
              the <strong className="text-slate-100">stomach room now</strong>, which tells you how much space is
              currently available for the next feed. Together they answer the two questions
              that matter most: <em>has she had enough over the last 24 hours?</em> and <em>how much milk
              can her stomach take right now?</em>
            </p>
          </section>

          {/* ── 24h Intake ── */}
          <section>
            <h3 className="font-semibold text-slate-100 mb-2 text-base">📊 24h intake · at last feed</h3>

            {/* Mini replica of the intake column */}
            <div className="flex justify-center mb-3">
              <div className="bg-slate-700/50 rounded-xl px-5 py-3 flex flex-col items-center gap-1">
                <span className="text-xs text-slate-400 font-medium">24h intake · at last feed</span>
                <span className="text-2xl font-bold text-slate-100">{Math.round(creditTotal)}<span className="text-sm font-normal ml-1">ml</span></span>
                <span className="text-xs text-slate-400">{creditTotalPct.toFixed(0)}% of daily target</span>
              </div>
            </div>

            <p>
              The 24h intake is a running total of all the prepared formula milk the baby
              has consumed in the past 24 hours. Its purpose is to track how close the baby
              is to the amount that health organisations all over the world recommend for
              formula-fed babies: 150 ml of prepared formula per kilogram of body weight per
              day. This target is the cornerstone of infant feeding guidance, endorsed by
              Kind en Gezin, the NHS, the American Academy of Pediatrics, and the WHO.
              When the 24h intake matches this target, the baby is receiving exactly what
              her growing body needs. Below target she may be hungry; above it she is
              getting more than she needs, and the next feed can wait a little longer.
            </p>
            <p className="mt-2">
              Here is how the calculation works. Each bottle contributes its full prepared
              formula volume from the moment it is given. Milk is not instantly used up —
              the body processes it gradually over the following hours. So a bottle given
              more than 24 hours ago still counts towards the total, but its contribution
              fades out steadily as the body has already absorbed that energy. Once a bottle
              is about 24 to 30 hours old, its contribution reaches zero and it drops out
              of the calculation entirely. This means the total changes smoothly as time
              passes, rather than jumping abruptly the moment a bottle crosses the 24-hour
              mark — giving you a stable, realistic picture of the baby’s nutritional state.
            </p>
            <p className="mt-2">
              The value shown on the card is frozen at the moment of the last feed — this
              is intentional. The goal is to show you the energy state at the last known
              event, not to drift continuously between feeds. The target is{' '}
              <strong className="text-slate-100">{Math.round(dailyTargetMl)} ml per day</strong>.
              When the intake is close to this target, the bar and number appear green.
              Below target they turn blue, above target they turn orange.
            </p>

            <div className="mt-3">
              <p className="text-sm text-slate-400 mb-2 font-medium">
                Bottles counted in this calculation
                {lastFeed ? <span className="font-normal"> (frozen at last feed: {fmtClock(lastFeed.timestamp)})</span> : null}:
              </p>
              {creditRows.length === 0 ? (
                <p className="text-sm text-slate-500">No bottles in the calculation window yet.</p>
              ) : (
                <>
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="text-slate-500 text-left">
                        <th className="font-normal py-1 pr-2">Time</th>
                        <th className="font-normal py-1 pr-2">🍼 Water</th>
                        <th className="font-normal py-1 pr-2">Milk</th>
                        <th className="font-normal py-1 pr-2">Age</th>
                        <th className="font-normal py-1 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditRows.map((r) => {
                        const full = r.creditMl >= r.fullMilk - 0.5;
                        return (
                          <tr key={r.f.id} className="border-t border-slate-700/50">
                            <td className="py-1 pr-2 text-slate-300">{fmtClock(r.f.timestamp)}</td>
                            <td className="py-1 pr-2 text-slate-300">{r.f.volume} 🍼</td>
                            <td className="py-1 pr-2 text-slate-300">{r.fullMilk.toFixed(0)} ml</td>
                            <td className={`py-1 pr-2 ${r.ageHours >= 24 ? 'text-amber-400' : 'text-slate-300'}`}>
                              {fmtAge(r.ageHours)}{r.ageHours >= 24 ? ' ↓' : ''}
                            </td>
                            <td className={`py-1 text-right ${full ? 'text-green-400' : 'text-amber-400'}`}>
                              {r.creditMl.toFixed(0)} ml
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="mt-2 font-bold text-white text-sm">
                    Total: {creditTotal.toFixed(0)} ml &nbsp;·&nbsp; {creditTotalPct.toFixed(0)}% of target
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Bottles older than 24h are shown in amber — they still contribute but
                    their credit is reduced. Age is counted from the last feed time.
                  </p>
                </>
              )}
            </div>
          </section>

          {/* ── Stomach Room ── */}
          <section>
            <h3 className="font-semibold text-slate-100 mb-2 text-base">🫙 Stomach room · now</h3>

            {/* Mini replica of the stomach column */}
            <div className="flex justify-center mb-3">
              <div className="bg-slate-700/50 rounded-xl px-5 py-3 flex flex-col items-center gap-1">
                <span className="text-xs text-slate-400 font-medium">stomach room · now</span>
                <span className={`text-2xl font-bold tabular-nums ${stomachFillPct > 85 ? 'text-red-400' : stomachFillPct > 55 ? 'text-orange-400' : 'text-teal-400'}`}>
                  {Math.round(roomNow)}<span className="text-sm font-normal ml-1">ml free</span>
                </span>
                <span className="text-xs text-slate-400">of {Math.round(capMilk)} ml capacity</span>
                <span className="text-xs text-amber-400">{Math.round(loadNow)} ml still digesting</span>
              </div>
            </div>

            <p>
              A baby's stomach has a limited capacity. Right after a feed it is full; as
              digestion progresses, the stomach empties and makes room for the next bottle.
              Giving a bottle before there is enough room can cause discomfort, spitting
              up, or refusal — so knowing how much space is available is genuinely useful.
            </p>
            <p className="mt-2">
              We estimate how much milk is still in the stomach right now by looking at
              every recent bottle and calculating how much of it has already been digested.
              Digestion follows an exponential pattern: roughly half the milk leaves the
              stomach within the first hour. By tracking this decay across all recent
              bottles, we get a good picture of the current stomach load and — by subtracting
              that from the stomach's total capacity — how much room remains.
            </p>
            <p className="mt-2">
              The stomach capacity is set to the volume of the next bottle size above
              your preferred bottle. With a preferred bottle of {preferredBottleWaterMl} 🍼
              ({Math.round(milkPerBottle)} ml milk), the next size up is used as the
              capacity:{' '}
              <strong className="text-slate-100">{(() => { const sizes = FORMULA_TABLE.map(e => e.water); const idx = sizes.indexOf(preferredBottleWaterMl); const nextW = idx >= 0 && idx < sizes.length - 1 ? sizes[idx + 1] : preferredBottleWaterMl; return `${nextW} 🍼 (${Math.round(capMilk)} ml milk)`; })()}</strong> — a
              realistic ceiling that a healthy stomach can comfortably reach.
            </p>
            <p className="mt-2">
              The vessel on the status card fills from the bottom as milk is still
              digesting, and empties as time passes. Teal means plenty of room; amber
              means the stomach is getting full; red means there is very little space left.
              Unlike the 24h intake, the stomach room updates live — it always reflects
              right now, not the moment of the last feed.
            </p>
          </section>

          {/* ── Footer link ── */}
          <section>
            <p className="text-xs text-slate-500">
              For a full explanation of the app, the water‑vs‑formula conversion table,
              and the clinical basis of all calculations, see the{' '}
              <Link href="/info/app" className="text-blue-400 underline">About MilkWise</Link> page
              (tap the <span className="font-mono text-xs bg-slate-700 px-1 rounded">?</span> next to the version number on the dashboard).
            </p>
          </section>

          <button onClick={onClose} className="mt-2 w-full text-center text-blue-400 hover:text-blue-300 text-sm py-2">← Back to dashboard</button>
        </div>
      </div>
    </div>
  );
}
