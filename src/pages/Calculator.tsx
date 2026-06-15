import { useMemo, useState } from 'react'
import {
  YARN_WEIGHTS,
  STITCH_TYPES,
  typicalGauge,
  sizeFromCounts,
  countsFromSize,
  estimateYardage,
  fromInches,
  toInches,
  type Gauge,
  type Unit,
} from '../lib/gauge'

type Mode = 'estimate' | 'measured'

function num(value: string, fallback = 0): number {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : fallback
}

export default function Calculator() {
  const [mode, setMode] = useState<Mode>('estimate')
  const [weightId, setWeightId] = useState(4)
  const [unit, setUnit] = useState<Unit>('in')
  const [gauge, setGauge] = useState<Gauge>(typicalGauge(YARN_WEIGHTS[4]))
  const [stitchTypeId, setStitchTypeId] = useState('sc')

  const [stitches, setStitches] = useState(60)
  const [rows, setRows] = useState(60)
  const [wantWidth, setWantWidth] = useState(12)
  const [wantHeight, setWantHeight] = useState(12)

  const weight = YARN_WEIGHTS.find((w) => w.id === weightId)!
  const stitchType = STITCH_TYPES.find((s) => s.id === stitchTypeId)!

  const effectiveGauge: Gauge = mode === 'estimate' ? typicalGauge(weight) : gauge

  const size = useMemo(
    () => sizeFromCounts(stitches, rows, effectiveGauge),
    [stitches, rows, effectiveGauge],
  )
  const yardage = useMemo(
    () => estimateYardage(stitches * rows, effectiveGauge, stitchType),
    [stitches, rows, effectiveGauge, stitchType],
  )
  const counts = useMemo(
    () =>
      countsFromSize(
        toInches(wantWidth, unit),
        toInches(wantHeight, unit),
        effectiveGauge,
      ),
    [wantWidth, wantHeight, unit, effectiveGauge],
  )

  const unitLabel = unit === 'in' ? 'in' : 'cm'
  const fmt = (inches: number) => fromInches(inches, unit).toFixed(1)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Size Calculator</h1>
        <p className="mt-1 text-sm text-slate-500">
          Figure out how big your project will be — or how many stitches you need to hit a
          target size.
        </p>
      </div>

      {/* Gauge setup */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-800">1 · Your gauge</h2>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
            <button
              onClick={() => setMode('estimate')}
              className={`rounded-md px-3 py-1 ${mode === 'estimate' ? 'bg-white shadow-sm font-medium' : 'text-slate-500'}`}
            >
              Estimate from yarn
            </button>
            <button
              onClick={() => setMode('measured')}
              className={`rounded-md px-3 py-1 ${mode === 'measured' ? 'bg-white shadow-sm font-medium' : 'text-slate-500'}`}
            >
              I measured a swatch
            </button>
          </div>
        </div>

        {mode === 'estimate' ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-slate-600">Yarn weight</span>
              <select
                value={weightId}
                onChange={(e) => setWeightId(num(e.target.value))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {YARN_WEIGHTS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.symbol} · {w.name} ({w.examples})
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              <p>
                Recommended hook: <strong>{weight.hookMm[0]}–{weight.hookMm[1]} mm</strong>
              </p>
              <p>
                Typical gauge: <strong>{effectiveGauge.stsPer4in} sts</strong> &amp;{' '}
                <strong>{effectiveGauge.rowsPer4in} rows</strong> per 4&nbsp;in (single crochet)
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Estimates only — your tension may differ. Measure a swatch for accuracy.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-slate-600">Stitches per 4 in (10 cm)</span>
              <input
                type="number"
                min={1}
                value={gauge.stsPer4in}
                onChange={(e) => setGauge((g) => ({ ...g, stsPer4in: num(e.target.value, 1) }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">Rows per 4 in (10 cm)</span>
              <input
                type="number"
                min={1}
                value={gauge.rowsPer4in}
                onChange={(e) => setGauge((g) => ({ ...g, rowsPer4in: num(e.target.value, 1) }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-slate-600">Units:</span>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {(['in', 'cm'] as Unit[]).map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={`rounded-md px-3 py-1 ${unit === u ? 'bg-white shadow-sm font-medium' : 'text-slate-500'}`}
              >
                {u === 'in' ? 'inches' : 'centimeters'}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Counts -> size */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-800">2 · Stitches → finished size</h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="text-slate-600">Stitches (width)</span>
              <input
                type="number"
                min={1}
                value={stitches}
                onChange={(e) => setStitches(Math.max(1, num(e.target.value, 1)))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">Rows (height)</span>
              <input
                type="number"
                min={1}
                value={rows}
                onChange={(e) => setRows(Math.max(1, num(e.target.value, 1)))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
          <div className="mt-4 rounded-lg bg-rose-50 p-4 text-rose-900">
            <p className="text-sm">Finished size</p>
            <p className="text-2xl font-bold">
              {fmt(size.widthIn)} × {fmt(size.heightIn)} {unitLabel}
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <label>
              <span className="text-slate-600">Stitch type (for yarn estimate)</span>
              <select
                value={stitchTypeId}
                onChange={(e) => setStitchTypeId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {STITCH_TYPES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-slate-600">Est. yarn needed</p>
              <p className="text-lg font-semibold text-slate-800">
                ≈ {Math.round(yardage.yards)} yd / {Math.round(yardage.meters)} m
              </p>
              <p className="text-xs text-slate-400">very rough — buy extra</p>
            </div>
          </div>
        </section>

        {/* Size -> counts */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-800">3 · Target size → stitches</h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="text-slate-600">Width ({unitLabel})</span>
              <input
                type="number"
                min={0}
                value={wantWidth}
                onChange={(e) => setWantWidth(Math.max(0, num(e.target.value)))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">Height ({unitLabel})</span>
              <input
                type="number"
                min={0}
                value={wantHeight}
                onChange={(e) => setWantHeight(Math.max(0, num(e.target.value)))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
          <div className="mt-4 rounded-lg bg-sky-50 p-4 text-sky-900">
            <p className="text-sm">Cast on / work</p>
            <p className="text-2xl font-bold">
              {counts.stitches} sts × {counts.rows} rows
            </p>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Rounded to whole stitches and rows. Start with a foundation chain of{' '}
            {counts.stitches} stitches.
          </p>
        </section>
      </div>
    </div>
  )
}
