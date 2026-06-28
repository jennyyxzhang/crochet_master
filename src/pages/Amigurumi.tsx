import { useMemo, useState } from 'react'
import FigureViewer from '../components/FigureViewer'
import {
  FIGURE_PRESETS,
  figureFromPreset,
  partPattern,
  partId,
  newPart,
  saveFigure,
  loadFigures,
  deleteFigure,
  shapeProfile,
  type AmiPart,
  type Figure,
  type ShapeParams,
} from '../lib/amigurumi'
import { exportAmigurumiPDF, exportAmigurumiText, assemblyNotes } from '../lib/export'
import {
  YARN_WEIGHTS,
  typicalGauge,
  fromInches,
  toInches,
  cellAspect,
  widestFromDiameter,
  diameterFromWidest,
  SWATCH_INCHES,
  type Gauge,
  type Unit,
} from '../lib/gauge'

function num(value: string, fallback = 0): number {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : fallback
}

export default function Amigurumi() {
  const [weightId, setWeightId] = useState(4)
  const gauge = useMemo(() => typicalGauge(YARN_WEIGHTS.find((w) => w.id === weightId)!), [weightId])

  const [figure, setFigure] = useState<Figure>(() => figureFromPreset(FIGURE_PRESETS[1], typicalGauge(YARN_WEIGHTS[4])))
  const [selectedId, setSelectedId] = useState<string | null>(figure.parts[0]?.id ?? null)
  const [unit, setUnit] = useState<Unit>('in')
  const [saved, setSaved] = useState<Figure[]>(() => loadFigures())

  // keep the gauge in sync with the yarn selector
  const liveFigure = useMemo<Figure>(() => ({ ...figure, gauge }), [figure, gauge])

  const selected = figure.parts.find((p) => p.id === selectedId) ?? null

  function loadPreset(presetId: string) {
    const preset = FIGURE_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    const fig = figureFromPreset(preset, gauge)
    setFigure(fig)
    setSelectedId(fig.parts[0]?.id ?? null)
  }

  function updatePart(id: string, patch: Partial<AmiPart>) {
    setFigure((f) => ({ ...f, parts: f.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
  }

  function updateShape(id: string, patch: Partial<ShapeParams>) {
    setFigure((f) => ({
      ...f,
      parts: f.parts.map((p) => (p.id === id ? { ...p, shape: { ...p.shape, ...patch } } : p)),
    }))
  }

  function addPart() {
    const part = newPart(partId(), `Part ${figure.parts.length + 1}`)
    setFigure((f) => ({ ...f, parts: [...f.parts, part] }))
    setSelectedId(part.id)
  }

  function removePart(id: string) {
    setFigure((f) => ({ ...f, parts: f.parts.filter((p) => p.id !== id) }))
    if (selectedId === id) setSelectedId(null)
  }

  function persist() {
    saveFigure(liveFigure)
    setSaved(loadFigures())
  }

  function load(fig: Figure) {
    setFigure(fig)
    setWeightIdFromGauge(fig)
    setSelectedId(fig.parts[0]?.id ?? null)
  }

  function setWeightIdFromGauge(fig: Figure) {
    const match = YARN_WEIGHTS.find((w) => typicalGauge(w).stsPer4in === fig.gauge.stsPer4in)
    if (match) setWeightId(match.id)
  }

  function remove(id: string) {
    deleteFigure(id)
    setSaved(loadFigures())
  }

  // Finished dimensions: height = sum of stacked parts; width = widest part.
  const dims = useMemo(() => {
    const sw = SWATCH_INCHES / gauge.stsPer4in
    const rh = SWATCH_INCHES / gauge.rowsPer4in
    let top = 0
    let maxWidthIn = 0
    const aspect = cellAspect(gauge)
    for (const part of figure.parts) {
      const profile = shapeProfile(part.shape, aspect)
      top = Math.max(top, part.position.y * rh + profile.length * rh)
      const diaIn = (Math.max(...profile) * sw) / Math.PI
      maxWidthIn = Math.max(maxWidthIn, diaIn)
    }
    return { heightIn: top, widthIn: maxWidthIn }
  }, [figure.parts, gauge])

  const totalStitches = useMemo(
    () => figure.parts.reduce((sum, p) => sum + partPattern(p, gauge).total * p.count, 0),
    [figure.parts, gauge],
  )

  const unitLabel = unit === 'in' ? 'in' : 'cm'
  const fmt = (inches: number) => fromInches(inches, unit).toFixed(1)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Amigurumi Generator</h1>
        <p className="mt-1 text-sm text-slate-500">
          Build a 3D figure from crochet-in-the-round shapes, see how the parts fit together in
          space, and get the round-by-round pattern with assembly notes.
        </p>
      </div>

      {/* Presets */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-800">Start from a figure</h2>
          <label className="text-sm text-slate-600">
            Yarn weight{' '}
            <select
              value={weightId}
              onChange={(e) => setWeightId(num(e.target.value))}
              className="ml-1 rounded-md border border-slate-300 px-2 py-1"
            >
              {YARN_WEIGHTS.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.symbol} · {w.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {FIGURE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => loadPreset(preset.id)}
              title={preset.description}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-rose-300 hover:bg-rose-50"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* 3D + pattern */}
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">3D preview</h2>
              <span className="text-xs text-slate-400">drag to rotate · scroll to zoom</span>
            </div>
            <FigureViewer figure={liveFigure} />
            <div className="mt-3 grid grid-cols-3 gap-3 text-center text-sm">
              <Stat label={`Height (${unitLabel})`} value={fmt(dims.heightIn)} />
              <Stat label={`Max width (${unitLabel})`} value={fmt(dims.widthIn)} />
              <Stat label="Total stitches" value={String(totalStitches)} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setUnit((u) => (u === 'in' ? 'cm' : 'in'))}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Show in {unit === 'in' ? 'cm' : 'inches'}
              </button>
              <div className="grow" />
              <button onClick={persist} className="rounded-md bg-rose-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-600">
                Save
              </button>
              <button onClick={() => exportAmigurumiText(liveFigure)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
                Export .txt
              </button>
              <button onClick={() => exportAmigurumiPDF(liveFigure)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
                Export PDF
              </button>
            </div>
          </section>

          {/* Written pattern */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 font-semibold text-slate-800">Written pattern</h2>
            <p className="mb-4 text-xs text-slate-500">
              sc = single crochet · inc = 2 sc in one st · dec = invisible decrease · work in a
              continuous spiral, marking the first stitch of each round. (n) = stitch count.
            </p>
            <div className="space-y-5">
              {figure.parts.map((part) => {
                const pat = partPattern(part, gauge)
                return (
                  <div key={part.id} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="inline-block h-4 w-4 rounded-full border border-slate-300" style={{ background: part.color }} />
                      <span className="font-medium text-slate-800">{part.name}</span>
                      {part.count > 1 && <span className="text-xs text-slate-500">make {part.count}</span>}
                      <span className="ml-auto text-xs text-slate-400">{pat.total} sts · {pat.rounds.length} rnds</span>
                    </div>
                    <ol className="space-y-0.5 text-sm text-slate-700">
                      {pat.instructions.map((ins, i) => (
                        <li key={i} className="font-mono text-[13px]">{ins}</li>
                      ))}
                    </ol>
                  </div>
                )
              })}
            </div>
            <div className="mt-5">
              <h3 className="mb-1 text-sm font-semibold text-slate-700">Assembly</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                {assemblyNotes(liveFigure).map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        {/* Part editor */}
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Parts</h2>
              <button onClick={addPart} className="rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50">
                + Add part
              </button>
            </div>
            <input
              value={figure.name}
              onChange={(e) => setFigure((f) => ({ ...f, name: e.target.value }))}
              className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium"
            />
            <ul className="space-y-1">
              {figure.parts.map((part) => (
                <li key={part.id}>
                  <button
                    onClick={() => setSelectedId(part.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                      selectedId === part.id ? 'bg-rose-50 ring-1 ring-rose-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="inline-block h-4 w-4 rounded-full border border-slate-300" style={{ background: part.color }} />
                    <span className="font-medium text-slate-700">{part.name}</span>
                    <span className="ml-auto text-xs text-slate-400">{part.shape.maxStitches} sts{part.count > 1 ? ` ×${part.count}` : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {selected && (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-slate-800">Edit “{selected.name}”</h2>
                <button onClick={() => removePart(selected.id)} className="text-xs text-rose-500 hover:underline">
                  Remove
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <Field label="Name">
                  <input
                    value={selected.name}
                    onChange={(e) => updatePart(selected.id, { name: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5"
                  />
                </Field>
                <ShapeControls
                  shape={selected.shape}
                  count={selected.count}
                  gauge={gauge}
                  unit={unit}
                  onShape={(patch) => updateShape(selected.id, patch)}
                  onCount={(v) => updatePart(selected.id, { count: v })}
                />
                <Field label="Color">
                  <input
                    type="color"
                    value={selected.color}
                    onChange={(e) => updatePart(selected.id, { color: e.target.value })}
                    className="h-9 w-full rounded-md border border-slate-300"
                  />
                </Field>
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Placement (spatial)</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="X (side)">
                      <NumberInput value={selected.position.x} step={0.5} onChange={(v) => updatePart(selected.id, { position: { ...selected.position, x: v } })} />
                    </Field>
                    <Field label="Y (height)">
                      <NumberInput value={selected.position.y} step={0.5} onChange={(v) => updatePart(selected.id, { position: { ...selected.position, y: v } })} />
                    </Field>
                    <Field label="Z (front)">
                      <NumberInput value={selected.position.z} step={0.5} onChange={(v) => updatePart(selected.id, { position: { ...selected.position, z: v } })} />
                    </Field>
                  </div>
                </div>
              </div>
            </section>
          )}

          {saved.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 font-semibold text-slate-800">Saved figures</h2>
              <ul className="space-y-1 text-sm">
                {saved.map((fig) => (
                  <li key={fig.id} className="flex items-center gap-2">
                    <button onClick={() => load(fig)} className="grow rounded-md px-2 py-1.5 text-left hover:bg-slate-50">
                      <span className="font-medium text-slate-700">{fig.name}</span>
                      <span className="ml-2 text-xs text-slate-400">{fig.parts.length} parts</span>
                    </button>
                    <button onClick={() => remove(fig.id)} className="text-xs text-slate-400 hover:text-rose-500">
                      delete
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <div className="text-lg font-semibold text-slate-800">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

function ShapeControls({
  shape,
  count,
  gauge,
  unit,
  onShape,
  onCount,
}: {
  shape: ShapeParams
  count: number
  gauge: Gauge
  unit: Unit
  onShape: (patch: Partial<ShapeParams>) => void
  onCount: (v: number) => void
}) {
  const unitLabel = unit === 'in' ? 'in' : 'cm'
  const diameter = fromInches(diameterFromWidest(shape.maxStitches, gauge), unit)
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start sts (magic ring)">
          <NumberInput value={shape.start} min={3} max={12} onChange={(v) => onShape({ start: v })} />
        </Field>
        <Field label="Make (count)">
          <NumberInput value={count} min={1} max={8} onChange={onCount} />
        </Field>
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Size — set widest count or diameter</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Widest sts">
          <NumberInput
            value={shape.maxStitches}
            min={shape.start}
            max={200}
            onChange={(v) => onShape({ maxStitches: v })}
          />
        </Field>
        <Field label={`Diameter (${unitLabel})`}>
          <NumberInput
            value={Number(diameter.toFixed(2))}
            min={0}
            step={0.1}
            onChange={(v) => onShape({ maxStitches: widestFromDiameter(toInches(v, unit), gauge) })}
          />
        </Field>
      </div>
      <p className="text-[11px] text-slate-400">
        Widest = π × diameter ÷ single-crochet width. At this gauge, {shape.maxStitches} sts ≈{' '}
        {diameter.toFixed(2)} {unitLabel} across.
      </p>
      <Field label={`Oval / elongation: ${shape.oval.toFixed(1)}× (1 = round, >1 = egg)`}>
        <input
          type="range"
          min={0.5}
          max={2.5}
          step={0.1}
          value={shape.oval}
          onChange={(e) => onShape({ oval: num(e.target.value, 1) })}
          className="w-full"
        />
      </Field>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={shape.closed}
          onChange={(e) => onShape({ closed: e.target.checked })}
        />
        <span className="text-slate-600">Closed (decrease &amp; stuff) — uncheck for an open bowl</span>
      </label>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        let v = num(e.target.value)
        if (min !== undefined) v = Math.max(min, v)
        if (max !== undefined) v = Math.min(max, v)
        onChange(v)
      }}
      className="w-full rounded-md border border-slate-300 px-2 py-1.5"
    />
  )
}
