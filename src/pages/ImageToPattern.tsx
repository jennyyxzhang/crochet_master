import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GridCanvas from '../components/GridCanvas'
import { createPattern, savePattern, type Pattern } from '../lib/grid'
import { YARN_PALETTE, contrastText } from '../lib/palette'
import { loadImageFile, pixelate, quantizeToGrid } from '../lib/image'
import { cellAspect, type Gauge } from '../lib/gauge'
import { exportPNG, exportPDF, rowSegments } from '../lib/export'

const DEFAULT_GAUGE: Gauge = { stsPer4in: 13, rowsPer4in: 15 }

export default function ImageToPattern() {
  const navigate = useNavigate()
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [cols, setCols] = useState(40)
  const [numColors, setNumColors] = useState(8)
  const [snapYarn, setSnapYarn] = useState(false)
  const [gauge, setGauge] = useState<Gauge>(DEFAULT_GAUGE)
  const [pattern, setPattern] = useState<Pattern | null>(null)
  const [cellSize, setCellSize] = useState(12)
  const [trueProportions, setTrueProportions] = useState(true)

  const [following, setFollowing] = useState(false)
  const [currentRow, setCurrentRow] = useState(0) // from bottom

  const fileInput = useRef<HTMLInputElement>(null)

  const imageAspect = img ? img.naturalWidth / img.naturalHeight : 1
  const aspectRatio = cellAspect(gauge)
  const rows = useMemo(
    () => Math.max(1, Math.round((cols * aspectRatio) / imageAspect)),
    [cols, aspectRatio, imageAspect],
  )

  const handleFile = async (file: File) => {
    const image = await loadImageFile(file)
    setImg(image)
    setFileName(file.name)
    setPattern(null)
    setFollowing(false)
  }

  const generate = () => {
    if (!img) return
    const pixels = pixelate(img, cols, rows)
    const { palette, cells } = quantizeToGrid(
      pixels,
      cols,
      rows,
      numColors,
      snapYarn ? YARN_PALETTE : undefined,
    )
    const p = createPattern(fileName.replace(/\.[^.]+$/, '') || 'Photo pattern', cols, rows, palette, gauge)
    p.cells = cells
    setPattern(p)
    setCurrentRow(0)
  }

  useEffect(() => {
    if (!following) return
    const onKey = (e: KeyboardEvent) => {
      if (!pattern) return
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        setCurrentRow((r) => Math.min(pattern.rows - 1, r + 1))
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        setCurrentRow((r) => Math.max(0, r - 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [following, pattern])

  const aspect = trueProportions ? aspectRatio : 1
  const rightToLeft = currentRow % 2 === 0
  const segments = pattern ? rowSegments(pattern, currentRow) : []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Image → Pattern</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload a photo, pixelate it to a crochet grid, then follow it stitch by stitch.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700">1 · Upload</h3>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
            <button
              onClick={() => fileInput.current?.click()}
              className="mt-2 w-full rounded-md border-2 border-dashed border-slate-300 py-6 text-sm text-slate-500 hover:border-rose-300 hover:text-rose-600"
            >
              {fileName ? `📷 ${fileName}` : 'Click to choose an image'}
            </button>
            {img && (
              <img
                src={img.src}
                alt="source preview"
                className="mt-2 max-h-40 w-full rounded-md object-contain"
              />
            )}
          </section>

          {img && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <h3 className="font-semibold text-slate-700">2 · Settings</h3>
              <label className="mt-2 block">
                <span className="text-xs text-slate-500">Stitches wide: {cols}</span>
                <input type="range" min={10} max={150} value={cols} onChange={(e) => setCols(parseInt(e.target.value))} className="w-full" />
              </label>
              <p className="text-xs text-slate-400">→ {rows} rows (kept in proportion via gauge)</p>

              <label className="mt-2 block">
                <span className="text-xs text-slate-500">Colors: {numColors}</span>
                <input type="range" min={2} max={24} value={numColors} disabled={snapYarn} onChange={(e) => setNumColors(parseInt(e.target.value))} className="w-full disabled:opacity-40" />
              </label>
              <label className="mt-1 flex items-center gap-2">
                <input type="checkbox" checked={snapYarn} onChange={(e) => setSnapYarn(e.target.checked)} />
                <span className="text-slate-600">Snap to real yarn colors</span>
              </label>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <label>
                  <span className="text-xs text-slate-500">sts / 4in</span>
                  <input type="number" min={1} value={gauge.stsPer4in} onChange={(e) => setGauge((g) => ({ ...g, stsPer4in: parseFloat(e.target.value) || 1 }))} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1" />
                </label>
                <label>
                  <span className="text-xs text-slate-500">rows / 4in</span>
                  <input type="number" min={1} value={gauge.rowsPer4in} onChange={(e) => setGauge((g) => ({ ...g, rowsPer4in: parseFloat(e.target.value) || 1 }))} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1" />
                </label>
              </div>

              <button onClick={generate} className="mt-3 w-full rounded-md bg-rose-600 py-2 font-medium text-white hover:bg-rose-700">
                Generate pattern
              </button>
            </section>
          )}

          {pattern && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <h3 className="font-semibold text-slate-700">3 · Use it</h3>
              <label className="mt-2 block">
                <span className="text-xs text-slate-500">Zoom ({cellSize}px)</span>
                <input type="range" min={4} max={30} value={cellSize} onChange={(e) => setCellSize(parseInt(e.target.value))} className="w-full" />
              </label>
              <label className="mt-1 flex items-center gap-2">
                <input type="checkbox" checked={trueProportions} onChange={(e) => setTrueProportions(e.target.checked)} />
                <span className="text-slate-600">True stitch proportions</span>
              </label>
              <button
                onClick={() => setFollowing((f) => !f)}
                className={`mt-3 w-full rounded-md py-2 font-medium ${following ? 'bg-slate-200 text-slate-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
              >
                {following ? 'Exit follow mode' : '▶ Follow row by row'}
              </button>
              <div className="mt-2 flex gap-2">
                <button onClick={() => exportPNG(pattern, { aspect })} className="flex-1 rounded-md border border-slate-300 py-1.5 hover:bg-slate-50">PNG</button>
                <button onClick={() => exportPDF(pattern, { aspect })} className="flex-1 rounded-md border border-slate-300 py-1.5 hover:bg-slate-50">PDF</button>
              </div>
              <button
                onClick={() => {
                  savePattern(pattern)
                  navigate('/designer', { state: { pattern } })
                }}
                className="mt-2 w-full rounded-md border border-slate-300 py-1.5 hover:bg-slate-50"
              >
                Edit in Grid Designer
              </button>
            </section>
          )}
        </aside>

        <div className="space-y-4">
          {!pattern && (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-slate-400">
              {img ? 'Adjust settings, then “Generate pattern”.' : 'Upload an image to begin.'}
            </div>
          )}

          {pattern && following && (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-700">
                    Row {currentRow + 1} of {pattern.rows} ·{' '}
                    <span className="font-medium">{rightToLeft ? 'read right → left ←' : 'read left → right →'}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {segments.map((s, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 py-1 text-xs"
                      >
                        <span
                          className="inline-block h-3 w-3 rounded-sm border border-slate-200"
                          style={{ backgroundColor: s.hex ?? 'transparent', color: s.hex ? contrastText(s.hex) : undefined }}
                        />
                        {s.count}× {s.hex ? s.hex.toUpperCase() : 'skip'}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button onClick={() => setCurrentRow((r) => Math.max(0, r - 1))} disabled={currentRow === 0} className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40">
                  ← Prev row
                </button>
                <button onClick={() => setCurrentRow((r) => Math.min(pattern.rows - 1, r + 1))} disabled={currentRow >= pattern.rows - 1} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">
                  Next row →
                </button>
                <span className="text-xs text-emerald-600">Tip: use arrow keys</span>
              </div>
            </section>
          )}

          {pattern && (
            <div className="overflow-auto rounded-xl border border-slate-200 bg-white p-3">
              <div className="inline-block">
                <GridCanvas
                  pattern={pattern}
                  cellSize={cellSize}
                  aspect={aspect}
                  showRowNumbers
                  highlightRowFromBottom={following ? currentRow : null}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
