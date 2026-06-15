// Export a pattern as PNG / PDF and generate written row-by-row instructions.

import { jsPDF } from 'jspdf'
import type { Pattern } from './grid'
import { EMPTY } from './grid'
import { contrastText } from './palette'

export interface RenderOptions {
  cellSize?: number
  showGrid?: boolean
  showRowNumbers?: boolean
  aspect?: number // cell width / height
}

/** Render a pattern to an offscreen canvas for export. */
export function renderPattern(p: Pattern, opts: RenderOptions = {}): HTMLCanvasElement {
  const aspect = opts.aspect ?? 1
  const base = opts.cellSize ?? 18
  const cellW = base * (aspect >= 1 ? aspect : 1)
  const cellH = base * (aspect >= 1 ? 1 : 1 / aspect)
  const margin = opts.showRowNumbers ? Math.max(24, base * 1.4) : 0

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(p.cols * cellW + margin)
  canvas.height = Math.ceil(p.rows * cellH + margin)
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < p.cols; c++) {
      const idx = p.cells[r][c]
      const x = margin + c * cellW
      const y = margin + r * cellH
      if (idx !== EMPTY) {
        ctx.fillStyle = p.palette[idx] ?? '#000'
        ctx.fillRect(x, y, cellW, cellH)
      }
      if (opts.showGrid) {
        ctx.strokeStyle = 'rgba(0,0,0,0.12)'
        ctx.lineWidth = 1
        ctx.strokeRect(x + 0.5, y + 0.5, cellW, cellH)
      }
    }
  }

  if (opts.showRowNumbers) {
    ctx.fillStyle = '#374151'
    ctx.font = `${Math.round(base * 0.7)}px sans-serif`
    ctx.textBaseline = 'middle'
    for (let r = 0; r < p.rows; r++) {
      ctx.textAlign = 'right'
      ctx.fillText(String(p.rows - r), margin - 4, margin + r * cellH + cellH / 2)
    }
    for (let c = 0; c < p.cols; c++) {
      ctx.textAlign = 'center'
      ctx.fillText(String(c + 1), margin + c * cellW + cellW / 2, margin / 2)
    }
  }

  return canvas
}

function triggerDownload(dataUrl: string, filename: string): void {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function exportPNG(p: Pattern, opts?: RenderOptions): void {
  const canvas = renderPattern(p, { showGrid: true, showRowNumbers: true, ...opts })
  triggerDownload(canvas.toDataURL('image/png'), `${slug(p.name)}.png`)
}

export function exportPDF(p: Pattern, opts?: RenderOptions): void {
  const canvas = renderPattern(p, { showGrid: true, showRowNumbers: true, ...opts })
  const pdf = new jsPDF({
    orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const pad = 24
  const scale = Math.min((pageW - pad * 2) / canvas.width, (pageH - pad * 2) / canvas.height)
  const w = canvas.width * scale
  const h = canvas.height * scale
  pdf.setFontSize(14)
  pdf.text(p.name, pad, pad)
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', pad, pad + 8, w, h)
  pdf.save(`${slug(p.name)}.pdf`)
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pattern'
}

export interface RowSegment {
  hex: string | null
  count: number
}

/**
 * Run-length segments for a single row, honoring boustrophedon reading: odd
 * rows (1-indexed from the bottom) are read right-to-left, even rows
 * left-to-right — matching how flat color work is actually crocheted.
 */
export function rowSegments(p: Pattern, rowIndexFromBottom: number): RowSegment[] {
  const r = p.rows - 1 - rowIndexFromBottom
  const cells = p.cells[r].slice()
  const rightToLeft = rowIndexFromBottom % 2 === 0
  const ordered = rightToLeft ? cells.slice().reverse() : cells
  const segs: RowSegment[] = []
  for (const idx of ordered) {
    const hex = idx === EMPTY ? null : p.palette[idx] ?? '#000'
    const last = segs[segs.length - 1]
    if (last && last.hex === hex) last.count++
    else segs.push({ hex, count: 1 })
  }
  return segs
}

export function segmentLabel(seg: RowSegment): string {
  return `${seg.count} ${seg.hex ? colorName(seg.hex) : 'skip'}`
}

function colorName(hex: string): string {
  const text = contrastText(hex)
  void text
  return hex.toUpperCase()
}
