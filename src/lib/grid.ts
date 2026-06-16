// Grid pattern data model + persistence.

import type { Gauge } from './gauge'

/**
 * A pattern is a grid of palette indices. -1 means "empty" (no stitch / blank).
 * cells is row-major: cells[row][col].
 */
export interface Pattern {
  id: string
  name: string
  cols: number
  rows: number
  palette: string[]
  cells: number[][]
  gauge: Gauge
  updatedAt: number
}

export const EMPTY = -1
export const MAX_DIM = 250

export function makeCells(cols: number, rows: number, fill = EMPTY): number[][] {
  return Array.from({ length: rows }, () => Array<number>(cols).fill(fill))
}

export function createPattern(
  name: string,
  cols: number,
  rows: number,
  palette: string[],
  gauge: Gauge,
): Pattern {
  return {
    id: crypto.randomUUID(),
    name,
    cols,
    rows,
    palette,
    cells: makeCells(cols, rows),
    gauge,
    updatedAt: Date.now(),
  }
}

/** Resize a pattern's grid, preserving existing cells where they overlap. */
export function resizePattern(p: Pattern, cols: number, rows: number): Pattern {
  const next = makeCells(cols, rows)
  for (let r = 0; r < Math.min(rows, p.rows); r++) {
    for (let c = 0; c < Math.min(cols, p.cols); c++) {
      next[r][c] = p.cells[r][c]
    }
  }
  return { ...p, cols, rows, cells: next }
}

/** Flood fill starting at (col,row), returning a new cells array. */
export function floodFill(
  cells: number[][],
  col: number,
  row: number,
  newIndex: number,
): number[][] {
  const rows = cells.length
  const cols = cells[0].length
  const target = cells[row][col]
  if (target === newIndex) return cells
  const next = cells.map((r) => r.slice())
  const stack: [number, number][] = [[col, row]]
  while (stack.length) {
    const [c, r] = stack.pop()!
    if (c < 0 || r < 0 || c >= cols || r >= rows) continue
    if (next[r][c] !== target) continue
    next[r][c] = newIndex
    stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1])
  }
  return next
}

export interface ColorCount {
  index: number
  hex: string
  count: number
}

export function colorCounts(p: Pattern): ColorCount[] {
  const counts = new Map<number, number>()
  for (const row of p.cells) {
    for (const idx of row) {
      if (idx === EMPTY) continue
      counts.set(idx, (counts.get(idx) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([index, count]) => ({ index, hex: p.palette[index] ?? '#000', count }))
    .sort((a, b) => b.count - a.count)
}

export function totalStitches(p: Pattern): number {
  let total = 0
  for (const row of p.cells) {
    for (const idx of row) {
      if (idx !== EMPTY) total++
    }
  }
  return total
}

// ----- persistence -----

const STORAGE_KEY = 'crochet:patterns'

type StoredPattern = Pattern

export function loadPatterns(): StoredPattern[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredPattern[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function savePattern(p: Pattern): void {
  const all = loadPatterns()
  const next = { ...p, updatedAt: Date.now() }
  const idx = all.findIndex((x) => x.id === p.id)
  if (idx >= 0) all[idx] = next
  else all.unshift(next)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function deletePattern(id: string): void {
  const all = loadPatterns().filter((p) => p.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}
