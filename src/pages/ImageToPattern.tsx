import { useCallback, useEffect, useRef, useState } from 'react'
import { loadImageFile } from '../lib/image'

const SATURATION = 0.8 // tune original saturation down by 20%
const GRID_COLOR = 'rgba(0,0,0,0.85)'

interface DrawOpts {
  scale?: number
  showNumbers?: boolean
  highlightRowFromBottom?: number | null
}

export default function ImageToPattern() {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [cols, setCols] = useState(40)
  const [rows, setRows] = useState(40)
  const [width, setWidth] = useState(700) // on-screen image width in px
  const [showNumbers, setShowNumbers] = useState(true)

  const [following, setFollowing] = useState(false)
  const [currentRow, setCurrentRow] = useState(0) // counted from the bottom
  const [showFileName, setShowFileName] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const imageAspect = img ? img.naturalWidth / img.naturalHeight : 1

  const handleFile = async (file: File) => {
    const image = await loadImageFile(file)
    setImg(image)
    setFileName(file.name)
    setFollowing(false)
    setCurrentRow(0)
    setShowFileName(false)
    // Seed the row count so the initial grid roughly matches the image shape.
    const aspect = image.naturalWidth / image.naturalHeight
    setRows(Math.max(1, Math.round(40 / aspect)))
  }

  /** Draw the (desaturated) image plus the grid overlay onto a canvas. */
  const render = useCallback(
    (canvas: HTMLCanvasElement, opts: DrawOpts = {}) => {
      if (!img) return
      const scale = opts.scale ?? 1
      const contentW = width
      const contentH = width / imageAspect
      const cellW = contentW / cols
      const cellH = contentH / rows
      const margin = opts.showNumbers ? Math.max(24, (contentW / cols) * 1.1) : 0

      const w = contentW + margin
      const h = contentH + margin
      const ctx = canvas.getContext('2d')!
      canvas.width = Math.ceil(w * scale)
      canvas.height = Math.ceil(h * scale)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(scale, 0, 0, scale, 0, 0)

      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)

      // Original image, kept as-is aside from a 20% saturation reduction.
      ctx.filter = `saturate(${SATURATION})`
      ctx.drawImage(img, margin, margin, contentW, contentH)
      ctx.filter = 'none'

      const highlightRow =
        opts.highlightRowFromBottom == null ? null : rows - 1 - opts.highlightRowFromBottom
      if (highlightRow != null) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        for (let r = 0; r < rows; r++) {
          if (r === highlightRow) continue
          ctx.fillRect(margin, margin + r * cellH, contentW, cellH)
        }
      }

      // Grid overlay.
      ctx.strokeStyle = GRID_COLOR
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let c = 0; c <= cols; c++) {
        const x = Math.round(margin + c * cellW) + 0.5
        ctx.moveTo(x, margin)
        ctx.lineTo(x, margin + contentH)
      }
      for (let r = 0; r <= rows; r++) {
        const y = Math.round(margin + r * cellH) + 0.5
        ctx.moveTo(margin, y)
        ctx.lineTo(margin + contentW, y)
      }
      ctx.stroke()

      if (highlightRow != null) {
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 2.5
        ctx.strokeRect(margin + 1, margin + highlightRow * cellH + 1, contentW - 2, cellH - 2)
      }

      if (opts.showNumbers) {
        const font = Math.max(9, Math.min(cellW, cellH) * 0.6)
        ctx.fillStyle = '#334155'
        ctx.font = `${Math.round(font)}px sans-serif`
        ctx.textBaseline = 'middle'
        for (let r = 0; r < rows; r++) {
          ctx.textAlign = 'right'
          ctx.fillText(String(rows - r), margin - 5, margin + r * cellH + cellH / 2)
        }
        for (let c = 0; c < cols; c++) {
          if (cellW < 14 && (c + 1) % 5 !== 0 && c !== 0) continue
          ctx.textAlign = 'center'
          ctx.fillText(String(c + 1), margin + c * cellW + cellW / 2, margin / 2)
        }
      }
    },
    [img, width, imageAspect, cols, rows],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    render(canvas, {
      scale: dpr,
      showNumbers,
      highlightRowFromBottom: following ? currentRow : null,
    })
  }, [render, showNumbers, following, currentRow])

  // Arrow keys only move the highlight while the canvas itself is focused, and
  // we preventDefault so they don't also scroll the page.
  const onCanvasKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!following) return
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault()
      setCurrentRow((r) => Math.min(rows - 1, r + 1))
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault()
      setCurrentRow((r) => Math.max(0, r - 1))
    }
  }

  // Focus the canvas when entering follow mode so the arrow keys work right away.
  useEffect(() => {
    if (following) canvasRef.current?.focus()
  }, [following])

  const exportPNG = () => {
    if (!img) return
    const canvas = document.createElement('canvas')
    render(canvas, { scale: 2, showNumbers })
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `${(fileName.replace(/\.[^.]+$/, '') || 'pattern')}-grid.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const rightToLeft = currentRow % 2 === 0

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Image → Pattern</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload a photo, lay an adjustable grid over it, then follow it row by row.
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
          </section>

          {img && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <a
                href={img.src}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => {
                  e.preventDefault()
                  setShowFileName(true)
                  window.open(img.src, '_blank', 'noopener')
                }}
                className="text-rose-600 underline hover:text-rose-700"
              >
                Local Image File
              </a>
              {showFileName && (
                <p className="mt-2 text-xs text-slate-500">{fileName}</p>
              )}
            </section>
          )}

          {img && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <h3 className="font-semibold text-slate-700">2 · Grid</h3>
              <label className="mt-2 block">
                <span className="text-xs text-slate-500">Stitches wide: {cols}</span>
                <input
                  type="range"
                  min={2}
                  max={200}
                  value={cols}
                  onChange={(e) => setCols(parseInt(e.target.value))}
                  className="w-full"
                />
              </label>
              <label className="mt-2 block">
                <span className="text-xs text-slate-500">Rows tall: {rows}</span>
                <input
                  type="range"
                  min={2}
                  max={200}
                  value={rows}
                  onChange={(e) => setRows(parseInt(e.target.value))}
                  className="w-full"
                />
              </label>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <label>
                  <span className="text-xs text-slate-500">Width</span>
                  <input
                    type="number"
                    min={1}
                    value={cols}
                    onChange={(e) => setCols(Math.max(1, parseInt(e.target.value) || 1))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
                  />
                </label>
                <label>
                  <span className="text-xs text-slate-500">Height</span>
                  <input
                    type="number"
                    min={1}
                    value={rows}
                    onChange={(e) => setRows(Math.max(1, parseInt(e.target.value) || 1))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                The photo is kept as-is (saturation lowered 20% so the black grid stands out).
              </p>
            </section>
          )}

          {img && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <h3 className="font-semibold text-slate-700">3 · Use it</h3>
              <label className="mt-2 block">
                <span className="text-xs text-slate-500">Display size</span>
                <input
                  type="range"
                  min={300}
                  max={1200}
                  step={20}
                  value={width}
                  onChange={(e) => setWidth(parseInt(e.target.value))}
                  className="w-full"
                />
              </label>
              <label className="mt-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showNumbers}
                  onChange={(e) => setShowNumbers(e.target.checked)}
                />
                <span className="text-slate-600">Show row / stitch numbers</span>
              </label>
              <button
                onClick={() => setFollowing((f) => !f)}
                className={`mt-3 w-full rounded-md py-2 font-medium ${following ? 'bg-slate-200 text-slate-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
              >
                {following ? 'Exit follow mode' : '▶ Follow row by row'}
              </button>
              <button
                onClick={exportPNG}
                className="mt-2 w-full rounded-md border border-slate-300 py-1.5 hover:bg-slate-50"
              >
                Export PNG
              </button>
            </section>
          )}
        </aside>

        <div className="space-y-4">
          {!img && (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-slate-400">
              Upload an image to begin.
            </div>
          )}

          {img && following && (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm text-emerald-700">
                Row {currentRow + 1} of {rows} ·{' '}
                <span className="font-medium">
                  {rightToLeft ? 'read right → left ←' : 'read left → right →'}
                </span>
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => setCurrentRow((r) => Math.max(0, r - 1))}
                  disabled={currentRow === 0}
                  className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  ← Prev row
                </button>
                <button
                  onClick={() => setCurrentRow((r) => Math.min(rows - 1, r + 1))}
                  disabled={currentRow >= rows - 1}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  Next row →
                </button>
                <span className="text-xs text-emerald-600">Tip: click the image, then use arrow keys</span>
              </div>
            </section>
          )}

          {img && (
            <div className="overflow-auto rounded-xl border border-slate-200 bg-white p-3">
              <div className="inline-block">
                <canvas
                  ref={canvasRef}
                  tabIndex={following ? 0 : -1}
                  onKeyDown={onCanvasKeyDown}
                  className={`rounded-sm outline-none ${following ? 'cursor-pointer ring-emerald-500 focus:ring-2 focus:ring-offset-2' : ''}`}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
