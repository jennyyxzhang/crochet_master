import { useCallback, useEffect, useRef } from 'react'
import type { Pattern } from '../lib/grid'
import { EMPTY } from '../lib/grid'

interface GridCanvasProps {
  pattern: Pattern
  cellSize: number
  aspect?: number
  showGrid?: boolean
  showRowNumbers?: boolean
  /** row index counted from the bottom; that row is highlighted, others dimmed */
  highlightRowFromBottom?: number | null
  interactive?: boolean
  onPaint?: (col: number, row: number) => void
  onPaintStart?: (col: number, row: number) => void
  onPaintEnd?: () => void
}

export default function GridCanvas({
  pattern,
  cellSize,
  aspect = 1,
  showGrid = true,
  showRowNumbers = false,
  highlightRowFromBottom = null,
  interactive = false,
  onPaint,
  onPaintStart,
  onPaintEnd,
}: GridCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const painting = useRef(false)
  const lastCell = useRef<{ col: number; row: number } | null>(null)

  const cellW = cellSize * (aspect >= 1 ? aspect : 1)
  const cellH = cellSize * (aspect >= 1 ? 1 : 1 / aspect)
  const margin = showRowNumbers ? Math.max(22, cellSize * 1.3) : 0

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = pattern.cols * cellW + margin
    const h = pattern.rows * cellH + margin
    canvas.width = Math.ceil(w * dpr)
    canvas.height = Math.ceil(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    // checkerboard for empty cells
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)

    const highlightRow =
      highlightRowFromBottom == null ? null : pattern.rows - 1 - highlightRowFromBottom

    for (let r = 0; r < pattern.rows; r++) {
      for (let c = 0; c < pattern.cols; c++) {
        const idx = pattern.cells[r][c]
        const x = margin + c * cellW
        const y = margin + r * cellH
        if (idx === EMPTY) {
          const even = (r + c) % 2 === 0
          ctx.fillStyle = even ? '#f8fafc' : '#eef2f7'
          ctx.fillRect(x, y, cellW, cellH)
        } else {
          ctx.fillStyle = pattern.palette[idx] ?? '#000'
          ctx.fillRect(x, y, cellW, cellH)
        }
        if (highlightRow != null && r !== highlightRow) {
          ctx.fillStyle = 'rgba(255,255,255,0.62)'
          ctx.fillRect(x, y, cellW, cellH)
        }
        if (showGrid && cellW > 4) {
          ctx.strokeStyle = 'rgba(15,23,42,0.12)'
          ctx.lineWidth = 1
          ctx.strokeRect(x + 0.5, y + 0.5, cellW, cellH)
        }
      }
    }

    if (highlightRow != null) {
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2.5
      ctx.strokeRect(margin + 1, margin + highlightRow * cellH + 1, pattern.cols * cellW - 2, cellH - 2)
    }

    if (showRowNumbers) {
      ctx.fillStyle = '#475569'
      ctx.font = `${Math.round(cellSize * 0.62)}px sans-serif`
      ctx.textBaseline = 'middle'
      for (let r = 0; r < pattern.rows; r++) {
        ctx.textAlign = 'right'
        ctx.fillText(String(pattern.rows - r), margin - 5, margin + r * cellH + cellH / 2)
      }
      for (let c = 0; c < pattern.cols; c++) {
        if (cellW < 12 && (c + 1) % 5 !== 0 && c !== 0) continue
        ctx.textAlign = 'center'
        ctx.fillText(String(c + 1), margin + c * cellW + cellW / 2, margin / 2)
      }
    }
  }, [pattern, cellW, cellH, margin, showGrid, showRowNumbers, highlightRowFromBottom, cellSize])

  useEffect(() => {
    draw()
  }, [draw])

  const cellFromEvent = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>): { col: number; row: number } | null => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left - margin
      const y = e.clientY - rect.top - margin
      const col = Math.floor(x / cellW)
      const row = Math.floor(y / cellH)
      if (col < 0 || row < 0 || col >= pattern.cols || row >= pattern.rows) return null
      return { col, row }
    },
    [cellW, cellH, margin, pattern.cols, pattern.rows],
  )

  return (
    <canvas
      ref={canvasRef}
      className={interactive ? 'cursor-crosshair touch-none' : 'touch-none'}
      onPointerDown={(e) => {
        if (!interactive) return
        const cell = cellFromEvent(e)
        if (!cell) return
        e.currentTarget.setPointerCapture(e.pointerId)
        painting.current = true
        lastCell.current = cell
        onPaintStart?.(cell.col, cell.row)
        onPaint?.(cell.col, cell.row)
      }}
      onPointerMove={(e) => {
        if (!interactive || !painting.current) return
        const cell = cellFromEvent(e)
        if (!cell) return
        // Interpolate along the line from the last cell so fast drags don't gap.
        const prev = lastCell.current ?? cell
        let x0 = prev.col
        let y0 = prev.row
        const x1 = cell.col
        const y1 = cell.row
        const dx = Math.abs(x1 - x0)
        const dy = Math.abs(y1 - y0)
        const sx = x0 < x1 ? 1 : -1
        const sy = y0 < y1 ? 1 : -1
        let err = dx - dy
        for (;;) {
          onPaint?.(x0, y0)
          if (x0 === x1 && y0 === y1) break
          const e2 = 2 * err
          if (e2 > -dy) {
            err -= dy
            x0 += sx
          }
          if (e2 < dx) {
            err += dx
            y0 += sy
          }
        }
        lastCell.current = cell
      }}
      onPointerUp={() => {
        if (!interactive) return
        painting.current = false
        lastCell.current = null
        onPaintEnd?.()
      }}
      onPointerLeave={() => {
        if (!interactive || !painting.current) return
        painting.current = false
        lastCell.current = null
        onPaintEnd?.()
      }}
    />
  )
}
