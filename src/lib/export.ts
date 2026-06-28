// Export a pattern as PNG / PDF and generate written row-by-row instructions.

import { jsPDF } from 'jspdf'
import type { Pattern } from './grid'
import { EMPTY } from './grid'
import { contrastText } from './palette'
import type { Figure } from './amigurumi'
import { partPattern } from './amigurumi'

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

// ----- amigurumi (worked in the round) export -----

/** Build a plain-text written pattern for an assembled amigurumi figure. */
export function amigurumiText(fig: Figure): string {
  const lines: string[] = []
  lines.push(fig.name)
  lines.push('='.repeat(fig.name.length))
  lines.push('')
  lines.push('Abbreviations: sc = single crochet, inc = increase (2 sc in 1 st),')
  lines.push('dec = invisible decrease, st(s) = stitch(es). Work in continuous')
  lines.push('spiral rounds; use a stitch marker. (n) = stitch count for the round.')
  lines.push('')

  fig.parts.forEach((part, i) => {
    const pat = partPattern(part, fig.gauge)
    const make = pat.count > 1 ? ` — make ${pat.count}` : ''
    lines.push(`${i + 1}. ${pat.name}${make}  [${pat.color.toUpperCase()}]`)
    for (const ins of pat.instructions) lines.push(`   ${ins}`)
    lines.push(`   Total: ${pat.total} sts across ${pat.rounds.length} rounds.`)
    lines.push('')
  })

  lines.push('Assembly')
  lines.push('--------')
  for (const note of assemblyNotes(fig)) lines.push(`- ${note}`)
  return lines.join('\n')
}

/** Heuristic assembly notes derived from each part's vertical position. */
export function assemblyNotes(fig: Figure): string[] {
  const notes: string[] = []
  // Anchor ("body") = the lowest single-count part, falling back to the lowest part overall.
  const singles = fig.parts.filter((p) => p.count <= 1)
  const pool = singles.length > 0 ? singles : fig.parts
  const base = [...pool].sort((a, b) => a.position.y - b.position.y)[0]
  if (!base) return notes
  const baseName = base.name.toLowerCase()
  notes.push(`Stuff each closed piece firmly before sewing. Use the ${baseName} as the anchor.`)
  for (const part of fig.parts) {
    if (part.id === base.id) continue
    const where =
      part.position.y > base.position.y + 8
        ? 'near the top'
        : part.position.y < base.position.y
          ? 'at the base'
          : 'on the side'
    const qty = part.count > 1 ? `${part.count} ${pluralize(part.name.toLowerCase())}` : `the ${part.name.toLowerCase()}`
    notes.push(`Sew ${qty} ${where} of the ${baseName}, spaced symmetrically.`)
  }
  notes.push('Add safety eyes and embroider details before closing any stuffed piece.')
  return notes
}

const IRREGULAR_PLURALS: Record<string, string> = { foot: 'feet', tooth: 'teeth' }

function pluralize(word: string): string {
  if (IRREGULAR_PLURALS[word]) return IRREGULAR_PLURALS[word]
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`
  return `${word}s`
}

export function exportAmigurumiText(fig: Figure): void {
  const blob = new Blob([amigurumiText(fig)], { type: 'text/plain' })
  triggerDownload(URL.createObjectURL(blob), `${slug(fig.name)}.txt`)
}

export function exportAmigurumiPDF(fig: Figure): void {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 48
  let y = margin

  const write = (text: string, size: number, opts: { bold?: boolean; gap?: number } = {}) => {
    pdf.setFont('helvetica', opts.bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    const wrapped = pdf.splitTextToSize(text, pageW - margin * 2) as string[]
    for (const line of wrapped) {
      if (y > pageH - margin) {
        pdf.addPage()
        y = margin
      }
      pdf.text(line, margin, y)
      y += size * 1.35
    }
    y += opts.gap ?? 0
  }

  write(fig.name, 22, { bold: true, gap: 4 })
  write(
    'sc = single crochet · inc = 2 sc in one st · dec = invisible decrease · work in continuous spiral rounds, marking the first st of each round. (n) = stitch count.',
    9,
    { gap: 8 },
  )

  fig.parts.forEach((part, i) => {
    const pat = partPattern(part, fig.gauge)
    const make = pat.count > 1 ? `  (make ${pat.count})` : ''
    write(`${i + 1}. ${pat.name}${make}`, 14, { bold: true, gap: 2 })
    for (const ins of pat.instructions) write(ins, 10)
    write(`Total: ${pat.total} sts over ${pat.rounds.length} rounds.`, 9, { gap: 8 })
  })

  write('Assembly', 14, { bold: true, gap: 2 })
  for (const note of assemblyNotes(fig)) write(`• ${note}`, 10)

  pdf.save(`${slug(fig.name)}.pdf`)
}
