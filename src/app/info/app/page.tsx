"use client";

import Link from "next/link";
import { FORMULA_TABLE } from "@/lib/calculations";

export default function AppInfoPage() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
      <div className="mb-5">
        <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm">← Back to dashboard</Link>
      </div>

      <h1 className="text-2xl font-bold text-slate-100 mb-1">🍼 About MilkWise</h1>
      <p className="text-sm text-slate-500 mb-6">What this app does and how it works</p>

      <div className="space-y-7 text-base text-slate-300 leading-relaxed">

        {/* ── Purpose ── */}
        <section>
          <h2 className="text-lg font-bold text-slate-100 mb-2">What is MilkWise?</h2>
          <p>
            MilkWise helps parents of formula-fed babies track and interpret their baby's
            milk intake in real time. Keeping a baby well-fed without over- or underfeeding
            is harder than it sounds — appetites vary, bottles come in different sizes, and
            the standard guideline of 150 ml per kilogram per day is easy to state but
            surprisingly tricky to apply in practice across a full day of irregular feeds.
          </p>
          <p className="mt-2">
            MilkWise takes the guesswork out of this by doing the calculations for you and
            showing you a clear, at-a-glance picture of where things stand — right now,
            and looking ahead to the next feed.
          </p>
        </section>

        {/* ── Functions ── */}
        <section>
          <h2 className="text-lg font-bold text-slate-100 mb-2">What can it do?</h2>
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-slate-100">📊 Status — 24h intake &amp; stomach room</h3>
              <p className="text-sm mt-0.5">
                Shows how much formula the baby has received in the last 24 hours relative
                to the daily target, and how much room is currently available in the stomach.
                Both update automatically as time passes. Tap the <span className="font-mono text-xs bg-slate-700 px-1 rounded">?</span> on
                the status card for a full explanation.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-100">⏱️ Predictors — next feed timing and amount</h3>
              <p className="text-sm mt-0.5">
                Two predictors tell you when to feed next and how much to offer.
                Predictor A (Adjust amount) suggests a bottle size that brings the baby back
                to her daily target at the standard interval. Predictor B (Adjust timing)
                tells you how much milk the baby can take right now and when the stomach
                will have enough room for a full preferred bottle.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-100">⚗️ WHO growth tracking</h3>
              <p className="text-sm mt-0.5">
                When you enter the baby's date of birth and sex in Settings, MilkWise
                calculates her WHO z-score — a measure of how her weight compares to the
                global reference population of healthy infants. The daily target automatically
                adjusts as the baby gains weight, based on a growth model fitted to her
                own weight history.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-100">📈 Analytics</h3>
              <p className="text-sm mt-0.5">
                The analytics page shows intake trends over 3, 7, or 30 days, feeding
                consistency, and a weight chart with WHO reference curves at Z = −2, −1, 0,
                +1, +2 — the same presentation used by Kind en Gezin and other child health
                organisations.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-100">📝 Feed log</h3>
              <p className="text-sm mt-0.5">
                Log each feed with its volume and time. You can edit or delete entries.
                All data is stored locally on the server — nothing leaves your network.
              </p>
            </div>
          </div>
        </section>

        {/* ── Water vs milk ── */}
        <section>
          <h2 className="text-lg font-bold text-slate-100 mb-2">🍼 Water ml versus prepared formula ml</h2>
          <p>
            You log bottles by the amount of water you measure into the bottle — for example,
            90 ml of water. But the 150 ml per kilogram guideline refers to the total volume
            of <em>prepared formula</em> after mixing in the powder. Because powder adds
            volume, a 90 ml water bottle yields slightly more than 90 ml of prepared formula.
            The exact ratio varies by bottle size per the standard manufacturer table:
          </p>
          <div className="mt-3 grid grid-cols-2 gap-x-6 text-sm text-slate-400 font-mono border-t border-slate-700 pt-2">
            <span className="text-slate-500 py-1">Water 🍼</span>
            <span className="text-slate-500 py-1">Prepared formula</span>
            {FORMULA_TABLE.map(({ water, formula }) => (
              <>
                <span key={`w${water}`} className="py-0.5">{water} ml</span>
                <span key={`f${water}`} className="py-0.5">{formula} ml milk</span>
              </>
            ))}
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Throughout the app, bottle sizes are shown in water ml with a 🍼 icon.
            Prepared formula volumes are shown in plain ml without an icon.
            Values between table entries are interpolated linearly.
          </p>
        </section>

        {/* ── Clinical basis ── */}
        <section>
          <h2 className="text-lg font-bold text-slate-100 mb-2">🔬 Clinical basis</h2>
          <p>
            All calculations in MilkWise are grounded in established paediatric and
            physiological research:
          </p>
          <ul className="mt-3 space-y-3 text-sm">
            <li>
              <strong className="text-slate-200">150 ml/kg/day guideline</strong><br />
              The standard recommendation for term infants receiving formula, published by
              Kind en Gezin (Belgium), the NHS (UK), the American Academy of Pediatrics (AAP),
              and WHO/ESPGHAN. The target is updated automatically as the baby grows.{" "}
              <Link href="/info/150ml" className="text-blue-400 underline">Learn more →</Link>
            </li>
            <li>
              <strong className="text-slate-200">24h intake calculation</strong><br />
              Each bottle contributes its full prepared formula volume immediately and fades
              gradually after the 24-hour mark at a rate equal to the baby's hourly target
              (daily target ÷ 24). This provides a stable, continuous picture of nutritional
              state without the abrupt jumps that a strict 24h window would produce.
            </li>
            <li>
              <strong className="text-slate-200">Gastric emptying half-life ≈ 60 minutes</strong><br />
              The stomach load model uses an exponential decay with a half-life of 60 minutes,
              consistent with published studies of gastric emptying in healthy infants:
              Husband &amp; Husband (1969); Cavell (1981); van den Driessche et al. (1999).
              Formula empties somewhat more slowly than breast milk; our model uses a
              conservative estimate that accounts for this.
            </li>
            <li>
              <strong className="text-slate-200">Stomach capacity</strong><br />
              Estimated from neonatal anatomy studies placing infant gastric capacity at
              approximately 20–30 ml/kg at birth, growing rapidly in the first months.
              MilkWise sets capacity at one standard bottle size above your preferred bottle —
              a practical, conservative approximation consistent with these ranges.
            </li>
            <li>
              <strong className="text-slate-200">WHO growth standards (weight-for-age)</strong><br />
              Z-scores and weight predictions use the WHO Child Growth Standards LMS method
              (WHO 2006), the globally recognised reference for healthy infant growth from
              birth to 24 months, covering both girls and boys.
            </li>
          </ul>
        </section>

        <div className="pt-2">
          <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm">← Back to dashboard</Link>
        </div>
      </div>
    </div>
  );
}
