// Image -> pixelated crochet grid (pixelate + color quantization).

import type { RGB } from './palette'
import { colorDistance, rgbToHex, hexToRgb } from './palette'

export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    // Keep the object URL alive so it can also back a preview <img>.
    img.onload = () => resolve(img)
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}

/**
 * Downsample an image to a cols x rows grid of average colors. Because the grid
 * dimensions are chosen from the gauge ratio, sampling into a non-square grid
 * here is what keeps the finished crocheted piece from looking distorted.
 */
export function pixelate(img: HTMLImageElement, cols: number, rows: number): RGB[] {
  const canvas = document.createElement('canvas')
  canvas.width = cols
  canvas.height = rows
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, cols, rows)
  const { data } = ctx.getImageData(0, 0, cols, rows)
  const out: RGB[] = []
  for (let i = 0; i < cols * rows; i++) {
    out.push({ r: data[i * 4], g: data[i * 4 + 1], b: data[i * 4 + 2] })
  }
  return out
}

interface Bucket {
  pixels: RGB[]
}

function bucketRange(pixels: RGB[]): { channel: keyof RGB; range: number } {
  let rMin = 255,
    rMax = 0,
    gMin = 255,
    gMax = 0,
    bMin = 255,
    bMax = 0
  for (const p of pixels) {
    rMin = Math.min(rMin, p.r)
    rMax = Math.max(rMax, p.r)
    gMin = Math.min(gMin, p.g)
    gMax = Math.max(gMax, p.g)
    bMin = Math.min(bMin, p.b)
    bMax = Math.max(bMax, p.b)
  }
  const ranges: { channel: keyof RGB; range: number }[] = [
    { channel: 'r', range: rMax - rMin },
    { channel: 'g', range: gMax - gMin },
    { channel: 'b', range: bMax - bMin },
  ]
  return ranges.sort((a, b) => b.range - a.range)[0]
}

function averageColor(pixels: RGB[]): RGB {
  let r = 0,
    g = 0,
    b = 0
  for (const p of pixels) {
    r += p.r
    g += p.g
    b += p.b
  }
  const n = pixels.length || 1
  return { r: r / n, g: g / n, b: b / n }
}

/** Median-cut color quantization. Returns up to `numColors` representative colors. */
export function medianCut(pixels: RGB[], numColors: number): RGB[] {
  if (pixels.length === 0) return []
  let buckets: Bucket[] = [{ pixels: pixels.slice() }]
  while (buckets.length < numColors) {
    // Split the bucket with the largest single-channel range.
    let target = -1
    let bestRange = -1
    buckets.forEach((bk, i) => {
      if (bk.pixels.length < 2) return
      const { range } = bucketRange(bk.pixels)
      if (range > bestRange) {
        bestRange = range
        target = i
      }
    })
    if (target < 0) break
    const bucket = buckets[target]
    const { channel } = bucketRange(bucket.pixels)
    const sorted = bucket.pixels.slice().sort((a, b) => a[channel] - b[channel])
    const mid = Math.floor(sorted.length / 2)
    buckets = [
      ...buckets.slice(0, target),
      { pixels: sorted.slice(0, mid) },
      { pixels: sorted.slice(mid) },
      ...buckets.slice(target + 1),
    ]
  }
  return buckets.map((bk) => averageColor(bk.pixels))
}

export function nearestIndex(color: RGB, palette: RGB[]): number {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < palette.length; i++) {
    const d = colorDistance(color, palette[i])
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

export interface QuantizeResult {
  palette: string[]
  cells: number[][]
}

/**
 * Convert pixelated colors into a palette + index grid.
 * If `snapTo` is provided, colors snap to that fixed palette (e.g. real yarn
 * colors). Otherwise a palette is generated via median cut.
 */
export function quantizeToGrid(
  pixels: RGB[],
  cols: number,
  rows: number,
  numColors: number,
  snapTo?: string[],
): QuantizeResult {
  const paletteRgb: RGB[] = snapTo
    ? snapTo.map(hexToRgb)
    : medianCut(pixels, numColors)
  const indices = pixels.map((p) => nearestIndex(p, paletteRgb))

  // Keep only palette colors that are actually used, and remap indices.
  const used = [...new Set(indices)].sort((a, b) => a - b)
  const remap = new Map(used.map((old, i) => [old, i]))
  const palette = used.map((i) => rgbToHex(paletteRgb[i]))

  const cells: number[][] = []
  for (let r = 0; r < rows; r++) {
    const row: number[] = []
    for (let c = 0; c < cols; c++) {
      row.push(remap.get(indices[r * cols + c]) ?? 0)
    }
    cells.push(row)
  }
  return { palette, cells }
}
