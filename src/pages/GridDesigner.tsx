import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import GridCanvas from '../components/GridCanvas'
import {
  createPattern,
  resizePattern,
  floodFill,
  colorCounts,
  totalStitches,
  savePattern,
  EMPTY,
  MAX_DIM,
  type Pattern,
} from '../lib/grid'
import { DEFAULT_PALETTE, YARN_PALETTE, contrastText } from '../lib/palette'
import { cellAspect, sizeFromCounts, fromInches, type Unit } from '../lib/gauge'
import { exportPNG, exportPDF } from '../lib/export'

type Tool = 'paint' | 'fill' | 'erase' | 'eyedropper'

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: 'paint', label: 'Paint', icon: '🖌️' },
  { id: 'fill', label: 'Fill', icon: '🪣' },
  { id: 'erase', label: 'Erase', icon: '🧽' },
  { id: 'eyedropper', label: 'Pick', icon: '💧' },
]

function clampDim(n: number): number {
  return Math.max(1, Math.min(MAX_DIM, Math.round(n)))
}

export default function GridDesigner() {
  const location = useLocation()
  const incoming = location.state as { pattern?: Pattern } | null

  const [pattern, setPattern] = useState<Pattern>(
    () =>
      incoming?.pattern ??
      createPattern('Untitled pattern', 30, 30, DEFAULT_PALETTE, {
        stsPer4in: 13,
        rowsPer4in: 15,
      }),
  )
  const [tool, setTool] = useState<Tool>('paint')
  const [selected, setSelected] = useState(1)
  const [cellSize, setCellSize] = useState(18)
  const [trueProportions, setTrueProportions] = useState(false)
  const [unit, setUnit] = useState<Unit>('in')
  const [saved, setSaved] = useState(false)

  const [past, setPast] = useState<number[][][]>([])
  const [future, setFuture] = useState<number[][][]>([])
  const snapshot = useRef<number[][] | null>(null)
  const [appliedId, setAppliedId] = useState<string | null>(incoming?.pattern?.id ?? null)

  // adopt an incoming pattern (e.g. handed over from the image tool)
  if (incoming?.pattern && incoming.pattern.id !== appliedId) {
    setAppliedId(incoming.pattern.id)
    setPattern(incoming.pattern)
    setPast([])
    setFuture([])
  }

  const deepCopy = (cells: number[][]) => cells.map((r) => r.slice())

  const commit = useCallback((cells: number[][]) => {
    setPattern((p) => ({ ...p, cells, updatedAt: Date.now() }))
    setSaved(false)
  }, [])

  const undo = useCallback(() => {
    if (past.length === 0) return
    setFuture((f) => [...f, pattern.cells.map((r) => r.slice())])
    setPattern((pt) => ({ ...pt, cells: past[past.length - 1] }))
    setPast((p) => p.slice(0, -1))
  }, [past, pattern.cells])

  const redo = useCallback(() => {
    if (future.length === 0) return
    setPast((p) => [...p, pattern.cells.map((r) => r.slice())])
    setPattern((pt) => ({ ...pt, cells: future[future.length - 1] }))
    setFuture((f) => f.slice(0, -1))
  }, [future, pattern.cells])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const applyAt = useCallback(
    (col: number, row: number, isStart: boolean) => {
      if (tool === 'eyedropper') {
        if (!isStart) return
        const idx = pattern.cells[row][col]
        if (idx !== EMPTY) setSelected(idx)
        return
      }
      if (tool === 'fill') {
        if (!isStart) return
        commit(floodFill(pattern.cells, col, row, selected))
        return
      }
      const target = tool === 'erase' ? EMPTY : selected
      setPattern((p) => {
        if (p.cells[row][col] === target) return p
        const next = p.cells.map((r) => r.slice())
        next[row][col] = target
        return { ...p, cells: next, updatedAt: Date.now() }
      })
      setSaved(false)
    },
    [tool, pattern.cells, selected, commit],
  )

  const handleStart = useCallback(
    (col: number, row: number) => {
      snapshot.current = deepCopy(pattern.cells)
      applyAt(col, row, true)
    },
    [pattern.cells, applyAt],
  )

  const handlePaint = useCallback(
    (col: number, row: number) => {
      if (tool === 'fill' || tool === 'eyedropper') return
      applyAt(col, row, false)
    },
    [tool, applyAt],
  )

  const handleEnd = useCallback(() => {
    if (snapshot.current) {
      const snap = snapshot.current
      setPast((p) => [...p, snap])
      setFuture([])
      snapshot.current = null
    }
  }, [])

  const setDims = (cols: number, rows: number) => {
    setPattern((p) => resizePattern(p, clampDim(cols), clampDim(rows)))
    setPast([])
    setFuture([])
    setSaved(false)
  }

  const editSelectedColor = (hex: string) => {
    setPattern((p) => {
      const palette = p.palette.slice()
      palette[selected] = hex
      return { ...p, palette }
    })
    setSaved(false)
  }

  const addColor = () => {
    setPattern((p) => ({ ...p, palette: [...p.palette, '#888888'] }))
    setSelected(pattern.palette.length)
  }

  const loadPalette = (palette: string[]) => {
    setPattern((p) => ({ ...p, palette }))
    setSelected(1)
  }

  const clearGrid = () => {
    snapshot.current = deepCopy(pattern.cells)
    commit(pattern.cells.map((r) => r.map(() => EMPTY)))
    handleEnd()
  }

  const doSave = () => {
    savePattern(pattern)
    setSaved(true)
  }

  const aspect = trueProportions ? cellAspect(pattern.gauge) : 1
  const counts = colorCounts(pattern)
  const total = totalStitches(pattern)
  const size = sizeFromCounts(pattern.cols, pattern.rows, pattern.gauge)
  const fmt = (inches: number) => fromInches(inches, unit).toFixed(1)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={pattern.name}
          onChange={(e) => setPattern((p) => ({ ...p, name: e.target.value }))}
          className="rounded-md border border-transparent bg-transparent px-1 text-2xl font-bold text-slate-800 hover:border-slate-300 focus:border-slate-300 focus:outline-none"
        />
        <div className="flex flex-wrap gap-2 text-sm">
          <button onClick={doSave} className="rounded-md bg-rose-600 px-3 py-1.5 font-medium text-white hover:bg-rose-700">
            {saved ? 'Saved ✓' : 'Save'}
          </button>
          <button onClick={() => exportPNG(pattern, { aspect })} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium hover:bg-slate-50">
            Export PNG
          </button>
          <button onClick={() => exportPDF(pattern, { aspect })} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium hover:bg-slate-50">
            Export PDF
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700">Tools</h3>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  title={t.label}
                  onClick={() => setTool(t.id)}
                  className={`flex flex-col items-center rounded-md py-2 text-xs ${tool === t.id ? 'bg-rose-100 text-rose-700' : 'hover:bg-slate-100'}`}
                >
                  <span className="text-lg">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={undo} disabled={past.length === 0} className="flex-1 rounded-md border border-slate-300 py-1.5 text-sm disabled:opacity-40">
                ↶ Undo
              </button>
              <button onClick={redo} disabled={future.length === 0} className="flex-1 rounded-md border border-slate-300 py-1.5 text-sm disabled:opacity-40">
                Redo ↷
              </button>
            </div>
            <button onClick={clearGrid} className="mt-2 w-full rounded-md border border-slate-200 py-1.5 text-sm text-slate-500 hover:bg-slate-50">
              Clear grid
            </button>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700">Colors</h3>
            <div className="mt-2 grid grid-cols-6 gap-1.5">
              {pattern.palette.map((hex, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
                  title={hex}
                  className={`aspect-square rounded-md border-2 ${selected === i ? 'border-rose-500 ring-2 ring-rose-200' : 'border-slate-200'}`}
                  style={{ backgroundColor: hex }}
                />
              ))}
              <button onClick={addColor} className="aspect-square rounded-md border-2 border-dashed border-slate-300 text-slate-400">
                +
              </button>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-slate-600">Edit selected</span>
              <input type="color" value={pattern.palette[selected] ?? '#000000'} onChange={(e) => editSelectedColor(e.target.value)} className="h-8 w-12 cursor-pointer rounded" />
            </label>
            <div className="mt-2 flex gap-2 text-xs">
              <button onClick={() => loadPalette(DEFAULT_PALETTE)} className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50">
                Basic palette
              </button>
              <button onClick={() => loadPalette(YARN_PALETTE)} className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50">
                Yarn palette
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <h3 className="font-semibold text-slate-700">Grid</h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label>
                <span className="text-xs text-slate-500">Stitches (w)</span>
                <input
                  type="number"
                  min={1}
                  max={MAX_DIM}
                  value={pattern.cols}
                  onChange={(e) => setDims(parseInt(e.target.value) || 1, pattern.rows)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
                />
              </label>
              <label>
                <span className="text-xs text-slate-500">Rows (h)</span>
                <input
                  type="number"
                  min={1}
                  max={MAX_DIM}
                  value={pattern.rows}
                  onChange={(e) => setDims(pattern.cols, parseInt(e.target.value) || 1)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
                />
              </label>
            </div>
            <label className="mt-3 block">
              <span className="text-xs text-slate-500">Zoom ({cellSize}px)</span>
              <input type="range" min={4} max={40} value={cellSize} onChange={(e) => setCellSize(parseInt(e.target.value))} className="w-full" />
            </label>
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" checked={trueProportions} onChange={(e) => setTrueProportions(e.target.checked)} />
              <span className="text-slate-600">True stitch proportions</span>
            </label>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <h3 className="font-semibold text-slate-700">Finished size</h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label>
                <span className="text-xs text-slate-500">sts / 4in</span>
                <input
                  type="number"
                  min={1}
                  value={pattern.gauge.stsPer4in}
                  onChange={(e) => setPattern((p) => ({ ...p, gauge: { ...p.gauge, stsPer4in: parseFloat(e.target.value) || 1 } }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
                />
              </label>
              <label>
                <span className="text-xs text-slate-500">rows / 4in</span>
                <input
                  type="number"
                  min={1}
                  value={pattern.gauge.rowsPer4in}
                  onChange={(e) => setPattern((p) => ({ ...p, gauge: { ...p.gauge, rowsPer4in: parseFloat(e.target.value) || 1 } }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
                />
              </label>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-lg font-semibold text-slate-800">
                {fmt(size.widthIn)} × {fmt(size.heightIn)} {unit}
              </p>
              <button onClick={() => setUnit(unit === 'in' ? 'cm' : 'in')} className="rounded border border-slate-200 px-2 py-0.5 text-xs">
                {unit}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">{total} stitches placed</p>
          </section>

          {counts.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <h3 className="font-semibold text-slate-700">Color counts</h3>
              <ul className="mt-2 space-y-1">
                {counts.map((c) => (
                  <li key={c.index} className="flex items-center gap-2">
                    <span className="inline-block h-4 w-4 rounded border border-slate-200" style={{ backgroundColor: c.hex }} />
                    <span className="font-mono text-xs" style={{ color: contrastText('#ffffff') }}>
                      {c.hex}
                    </span>
                    <span className="ml-auto text-slate-500">{c.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>

        {/* Canvas */}
        <div className="overflow-auto rounded-xl border border-slate-200 bg-white p-3">
          <div className="inline-block">
            <GridCanvas
              pattern={pattern}
              cellSize={cellSize}
              aspect={aspect}
              showRowNumbers
              interactive
              onPaintStart={handleStart}
              onPaint={handlePaint}
              onPaintEnd={handleEnd}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
