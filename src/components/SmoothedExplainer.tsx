"use client";

interface Props {
  onClose: () => void;
  hourlyRate: number;
  standardBottleVolume: number;
  dailyTargetMl: number;
}

export default function SmoothedExplainer({ onClose, hourlyRate, standardBottleVolume, dailyTargetMl }: Props) {
  const targetBottles = (dailyTargetMl / standardBottleVolume).toFixed(1);

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-100">How is Smoothed % calculated?</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-2xl leading-none">×</button>
        </div>

        <div className="space-y-5 text-sm text-slate-300 leading-relaxed">

          <section>
            <h3 className="font-semibold text-slate-100 mb-1">The core idea</h3>
            <p>
              A bottle your baby drank <strong>1 hour ago</strong> fully counts toward today's intake.
              A bottle from <strong>30 hours ago</strong> barely counts — most of that nutrition is already
              in the past. The Smoothed calculation gives each bottle a <em>credit score</em> based on how
              long ago it was given.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-100 mb-1">Step 1 — score each bottle</h3>
            <p>
              Every bottle starts with full credit equal to its volume (e.g. {standardBottleVolume} ml).
            </p>
            <p className="mt-2">
              If a bottle was given <strong>less than 24 hours ago</strong>, it keeps its full credit — nothing is subtracted.
            </p>
            <p className="mt-2">
              If a bottle was given <strong>more than 24 hours ago</strong>, we start reducing its credit.
              Your baby burns through about <strong>{hourlyRate.toFixed(1)} ml per hour</strong> (that's
              your daily target spread evenly across 24 hours). For every hour beyond 24, we subtract that
              amount from the bottle's credit. Once the credit hits zero, the bottle no longer counts at all.
            </p>
            <div className="bg-slate-700/60 rounded-lg p-3 mt-2 text-slate-400 text-xs">
              <strong className="text-slate-300">Example:</strong> A {standardBottleVolume} ml bottle given 26 hours ago.<br />
              Hours beyond 24: 2 hours.<br />
              Credit lost: 2 × {hourlyRate.toFixed(1)} ml = {(2 * hourlyRate).toFixed(0)} ml.<br />
              Remaining credit: {Math.max(0, standardBottleVolume - 2 * hourlyRate).toFixed(0)} ml.
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-slate-100 mb-1">Step 2 — add it all up</h3>
            <p>
              We add together the credits from every bottle ever logged. The result is a number in ml —
              the "smoothed total". We then divide by your standard bottle size ({standardBottleVolume} ml)
              to turn it into a bottle count.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-100 mb-1">Step 3 — the percentage</h3>
            <p>
              Your baby's daily target is <strong>{dailyTargetMl.toFixed(0)} ml</strong> ({targetBottles} bottles).
              We divide the smoothed total by that target and multiply by 100 to get a percentage.
            </p>
            <p className="mt-2">
              <strong className="text-green-400">100% or more</strong> — your baby is well fed for the current pace. 🟢<br />
              <strong className="text-yellow-400">90–99%</strong> — slightly behind, worth keeping an eye on. 🟡<br />
              <strong className="text-red-400">Below 90%</strong> — noticeably behind the target. 🔴
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-100 mb-1">Why not just use the last 24 hours?</h3>
            <p>
              The "Strict 24h" number is simpler but can jump around a lot. If your baby had a big feeding
              session at 11 PM last night, it disappears from the count exactly 24 hours later — even though
              the baby is still digesting the pattern from those feeds.
            </p>
            <p className="mt-2">
              The Smoothed version fades out old feeds gradually, so the number moves more smoothly and gives
              a better sense of whether the overall intake trend is on track.
            </p>
          </section>

        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium py-3 rounded-xl transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
