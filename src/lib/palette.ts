// Color helpers + default yarn-ish palettes.

export interface RGB {
  r: number
  g: number
  b: number
}

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const num = parseInt(full, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

export function colorDistance(a: RGB, b: RGB): number {
  // Weighted euclidean distance, a cheap approximation of perceptual distance.
  const rMean = (a.r + b.r) / 2
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return Math.sqrt(
    (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db,
  )
}

/** Pick a readable text color (black/white) for a given background hex. */
export function contrastText(hex: string): string {
  const { r, g, b } = hexToRgb(hex)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#1f2937' : '#ffffff'
}

export const DEFAULT_PALETTE: string[] = [
  '#ffffff',
  '#000000',
  '#e63946',
  '#f4a261',
  '#e9c46a',
  '#2a9d8f',
  '#264653',
  '#457b9d',
  '#a8dadc',
  '#f1faee',
  '#ff8fab',
  '#b5838d',
]

export const YARN_PALETTE: string[] = [
  '#f8f4e9', // cream
  '#e8e6df', // ecru
  '#9c9a93', // grey
  '#3d3d3d', // charcoal
  '#000000', // black
  '#7d2e2e', // brick
  '#c1442e', // tomato
  '#e07a3f', // pumpkin
  '#e8b84b', // mustard
  '#f3e0a1', // butter
  '#5a7d4f', // sage
  '#2f5d50', // forest
  '#3a6ea5', // denim
  '#1d3461', // navy
  '#9bc1bc', // seafoam
  '#7b4b94', // plum
  '#d782ba', // rose
  '#f7c4d9', // blush
  '#8b5e3c', // chestnut
  '#5b3a29', // espresso
]
