import type { Gauge } from './gauge'

// Amigurumi (worked-in-the-round) shape math.
//
// Amigurumi pieces are crocheted as a spiral of rounds. A piece is described by
// a profile: the stitch count of every round from the start (magic ring) to the
// end. The 3D form comes from revolving that profile around the vertical axis —
// the radius of each round is proportional to its stitch count.
//
// Shaping between rounds is done with increases (inc = 2 sc in one stitch) and
// invisible decreases (dec = 2 stitches worked together). We distribute those
// changes as evenly as possible and describe them in standard amigurumi
// notation, e.g. "*2 sc, inc* x6 (24)".

export type ShapeKind = 'ball' | 'cylinder' | 'cone' | 'dome' | 'teardrop'

export interface ShapeParams {
  kind: ShapeKind
  /** stitches in the start magic ring (typically 6) */
  start: number
  /** widest round's stitch count (must be reachable from start by +start/round) */
  maxStitches: number
  /** straight rounds worked even at the widest point (cylinder body / teardrop) */
  evenRounds: number
  /** whether the piece is closed at the end (stuffed) or left open (e.g. a limb) */
  closed: boolean
}

export interface PartColor {
  hex: string
}

export interface AmiPart {
  id: string
  name: string
  shape: ShapeParams
  color: string
  /** how many of this part to make (e.g. 2 ears, 4 legs) */
  count: number
  /** placement of the part's center relative to the figure, in stitch units */
  position: { x: number; y: number; z: number }
  /** uniform scale multiplier applied to the rendered 3D mesh only */
  scale: number
}

export interface Round {
  /** 1-indexed round number */
  index: number
  /** stitch count of this round */
  stitches: number
  /** change from the previous round (positive = increases, negative = decreases) */
  delta: number
}

export const DEFAULT_START = 6

/**
 * Generate the stitch-count profile (one entry per round) for a shape.
 *
 * The growth phase increases by `start` stitches per round (the classic flat
 * circle rule that keeps the disc flat), reaching `maxStitches`. Depending on
 * the shape we then work even and/or mirror the growth as a decrease phase.
 */
export function shapeProfile(shape: ShapeParams): number[] {
  const start = Math.max(3, Math.round(shape.start))
  const step = start
  const peak = Math.max(start, roundToStep(shape.maxStitches, step, start))
  const growth: number[] = []
  for (let s = start; s <= peak; s += step) growth.push(s)

  const even: number[] = Array.from({ length: Math.max(0, Math.round(shape.evenRounds)) }, () => peak)
  const decrease = growth.slice(0, -1).reverse() // mirror, excluding the peak (already counted)
  const closing = shape.closed ? [start] : []

  switch (shape.kind) {
    case 'cone':
      // Linear taper to a point: grow only, optional even rounds at the base.
      return [...growth, ...even]
    case 'dome':
      // Half a ball: grow to the equator, then optional even rounds.
      return [...growth, ...even]
    case 'cylinder':
      // Grow a base, long even tube, optional closed top.
      return [...growth, ...even, ...(shape.closed ? [...decrease, ...closing] : [])]
    case 'teardrop':
      // Ball with an elongated straight midsection.
      return [...growth, ...even, ...decrease, ...closing]
    case 'ball':
    default:
      // Sphere: symmetric grow / (optional even) / shrink.
      return [...growth, ...even, ...decrease, ...closing]
  }
}

/** Round a target up/down to the nearest achievable stitch count for the step. */
function roundToStep(target: number, step: number, start: number): number {
  const rounds = Math.max(1, Math.round((target - start) / step) + 1)
  return start + (rounds - 1) * step
}

export function profileToRounds(profile: number[]): Round[] {
  return profile.map((stitches, i) => ({
    index: i + 1,
    stitches,
    delta: i === 0 ? stitches : stitches - profile[i - 1],
  }))
}

export function totalStitches(profile: number[]): number {
  return profile.reduce((sum, n) => sum + n, 0)
}

/**
 * Human-readable instruction for a single round, given the previous round's
 * stitch count. Uses standard amigurumi shorthand.
 */
export function roundInstruction(round: Round, prevStitches: number): string {
  if (round.index === 1) {
    return `${round.stitches} sc in a magic ring (${round.stitches})`
  }
  if (round.delta === 0) {
    return `sc in each st around (${round.stitches})`
  }
  if (round.delta > 0) {
    return `${distribute('inc', round.delta, prevStitches, true)} (${round.stitches})`
  }
  return `${distribute('dec', -round.delta, prevStitches, false)} (${round.stitches})`
}

/**
 * Distribute `changes` increases/decreases evenly across a round of
 * `prevStitches` stitches and format the repeat instruction.
 *
 * For increases: each repeat is (k sc, inc) over k+1 base stitches.
 * For decreases: each repeat is (k sc, dec) over k+2 base stitches.
 */
function distribute(kind: 'inc' | 'dec', changes: number, prevStitches: number, isInc: boolean): string {
  // stitches consumed by each shaping element from the previous round
  const consumed = isInc ? 1 : 2
  const plain = prevStitches - changes * consumed
  const groups = changes
  const baseEach = Math.floor(plain / groups)
  const remainder = plain - baseEach * groups

  // When evenly divisible, one tidy repeat; otherwise split into two repeats so
  // the count still works out (common in real patterns).
  const op = kind
  if (remainder === 0) {
    const lead = baseEach > 0 ? `${baseEach} sc, ` : ''
    return repeat(`${lead}${op}`, groups)
  }
  // groups with one extra plain stitch vs. the rest
  const big = remainder
  const small = groups - remainder
  const parts: string[] = []
  if (small > 0) parts.push(repeat(`${baseEach > 0 ? `${baseEach} sc, ` : ''}${op}`, small))
  if (big > 0) parts.push(repeat(`${baseEach + 1} sc, ${op}`, big))
  return parts.join(', ')
}

function repeat(body: string, times: number): string {
  if (times === 1) return body.includes(',') ? body.replace(/,\s*(inc|dec)$/, ' $1') : body
  return `*${body}* x${times}`
}

export interface PartPattern {
  name: string
  count: number
  color: string
  rounds: Round[]
  instructions: string[]
  total: number
}

export function partPattern(part: AmiPart): PartPattern {
  const profile = shapeProfile(part.shape)
  const rounds = profileToRounds(profile)
  const instructions = rounds.map((r, i) =>
    `Rnd ${r.index}: ${roundInstruction(r, i === 0 ? 0 : profile[i - 1])}`,
  )
  if (!part.shape.closed) instructions.push('Fasten off, leaving a tail for sewing.')
  return {
    name: part.name,
    count: part.count,
    color: part.color,
    rounds,
    instructions,
    total: totalStitches(profile),
  }
}

/** Maximum radius (in stitch-width units) reached by a profile. */
export function profileMaxRadius(profile: number[]): number {
  const peak = Math.max(...profile, 1)
  return peak / (2 * Math.PI)
}

/**
 * Convert a stitch-count profile into a list of [radius, height] points for a
 * lathe (surface of revolution). Radius derives from circumference = stitches *
 * stitchWidth; height accumulates one rowHeight per round.
 */
export function latheProfile(
  profile: number[],
  stitchWidth: number,
  rowHeight: number,
): { r: number; y: number }[] {
  const pts: { r: number; y: number }[] = []
  profile.forEach((stitches, i) => {
    const circumference = stitches * stitchWidth
    const r = circumference / (2 * Math.PI)
    pts.push({ r, y: i * rowHeight })
  })
  return pts
}

export function newPart(id: string, name: string, overrides: Partial<AmiPart> = {}): AmiPart {
  return {
    id,
    name,
    color: '#d97706',
    count: 1,
    position: { x: 0, y: 0, z: 0 },
    scale: 1,
    shape: { kind: 'ball', start: DEFAULT_START, maxStitches: 30, evenRounds: 4, closed: true },
    ...overrides,
  }
}

// ----- figure (a full assembled amigurumi) -----

export interface Figure {
  id: string
  name: string
  parts: AmiPart[]
  gauge: Gauge
  updatedAt: number
}

let partSeq = 0
export function partId(): string {
  partSeq += 1
  return `part-${Date.now().toString(36)}-${partSeq}`
}

/** Total height of a part (in stitch-row units) from its profile length. */
export function partHeight(shape: ShapeParams): number {
  return shapeProfile(shape).length
}

// ----- presets -----

type PresetPart = Omit<AmiPart, 'id'>

export interface FigurePreset {
  id: string
  name: string
  description: string
  parts: PresetPart[]
}

const COLORS = {
  fur: '#b5793a',
  cream: '#f5e6c8',
  white: '#f8fafc',
  black: '#1f2937',
  pink: '#f9a8c4',
  orange: '#ea7a2c',
}

export const FIGURE_PRESETS: FigurePreset[] = [
  {
    id: 'ball',
    name: 'Simple Ball',
    description: 'A single stuffed sphere — the building block of all amigurumi.',
    parts: [
      {
        name: 'Ball',
        color: COLORS.fur,
        count: 1,
        position: { x: 0, y: 0, z: 0 },
        scale: 1,
        shape: { kind: 'ball', start: 6, maxStitches: 36, evenRounds: 6, closed: true },
      },
    ],
  },
  {
    id: 'teddy',
    name: 'Teddy Bear',
    description: 'Classic seated bear: round body, head, two ears, arms and legs.',
    parts: [
      {
        name: 'Body',
        color: COLORS.fur,
        count: 1,
        position: { x: 0, y: 0, z: 0 },
        scale: 1,
        shape: { kind: 'teardrop', start: 6, maxStitches: 36, evenRounds: 6, closed: true },
      },
      {
        name: 'Head',
        color: COLORS.fur,
        count: 1,
        position: { x: 0, y: 13, z: 0 },
        scale: 1,
        shape: { kind: 'ball', start: 6, maxStitches: 42, evenRounds: 6, closed: true },
      },
      {
        name: 'Ear',
        color: COLORS.fur,
        count: 2,
        position: { x: 3.2, y: 19, z: 0 },
        scale: 1,
        shape: { kind: 'dome', start: 6, maxStitches: 18, evenRounds: 0, closed: true },
      },
      {
        name: 'Arm',
        color: COLORS.fur,
        count: 2,
        position: { x: 4, y: 4, z: 0.5 },
        scale: 1,
        shape: { kind: 'cylinder', start: 6, maxStitches: 12, evenRounds: 7, closed: true },
      },
      {
        name: 'Leg',
        color: COLORS.fur,
        count: 2,
        position: { x: 2.4, y: -3, z: 1 },
        scale: 1,
        shape: { kind: 'cylinder', start: 6, maxStitches: 18, evenRounds: 6, closed: true },
      },
      {
        name: 'Muzzle',
        color: COLORS.cream,
        count: 1,
        position: { x: 0, y: 12, z: 4 },
        scale: 1,
        shape: { kind: 'dome', start: 6, maxStitches: 18, evenRounds: 1, closed: true },
      },
    ],
  },
  {
    id: 'bunny',
    name: 'Bunny',
    description: 'Long-eared bunny: egg-shaped body, head and two tall ears.',
    parts: [
      {
        name: 'Body',
        color: COLORS.white,
        count: 1,
        position: { x: 0, y: 0, z: 0 },
        scale: 1,
        shape: { kind: 'teardrop', start: 6, maxStitches: 30, evenRounds: 8, closed: true },
      },
      {
        name: 'Head',
        color: COLORS.white,
        count: 1,
        position: { x: 0, y: 12, z: 0 },
        scale: 1,
        shape: { kind: 'ball', start: 6, maxStitches: 36, evenRounds: 5, closed: true },
      },
      {
        name: 'Ear',
        color: COLORS.white,
        count: 2,
        position: { x: 2.6, y: 22, z: 0 },
        scale: 1,
        shape: { kind: 'cylinder', start: 6, maxStitches: 12, evenRounds: 9, closed: true },
      },
      {
        name: 'Foot',
        color: COLORS.white,
        count: 2,
        position: { x: 2.4, y: -3, z: 1.5 },
        scale: 1,
        shape: { kind: 'ball', start: 6, maxStitches: 18, evenRounds: 2, closed: true },
      },
    ],
  },
  {
    id: 'snowman',
    name: 'Snowman',
    description: 'Three stacked balls — great for practising even decreases.',
    parts: [
      {
        name: 'Bottom',
        color: COLORS.white,
        count: 1,
        position: { x: 0, y: 0, z: 0 },
        scale: 1,
        shape: { kind: 'ball', start: 6, maxStitches: 42, evenRounds: 4, closed: true },
      },
      {
        name: 'Middle',
        color: COLORS.white,
        count: 1,
        position: { x: 0, y: 13, z: 0 },
        scale: 1,
        shape: { kind: 'ball', start: 6, maxStitches: 30, evenRounds: 3, closed: true },
      },
      {
        name: 'Head',
        color: COLORS.white,
        count: 1,
        position: { x: 0, y: 22, z: 0 },
        scale: 1,
        shape: { kind: 'ball', start: 6, maxStitches: 24, evenRounds: 2, closed: true },
      },
      {
        name: 'Nose',
        color: COLORS.orange,
        count: 1,
        position: { x: 0, y: 22, z: 3.5 },
        scale: 1,
        shape: { kind: 'cone', start: 4, maxStitches: 10, evenRounds: 0, closed: false },
      },
    ],
  },
]

export function figureFromPreset(preset: FigurePreset, gauge: Gauge): Figure {
  return {
    id: crypto.randomUUID(),
    name: preset.name,
    parts: preset.parts.map((p) => ({ ...structuredCloneSafe(p), id: partId() })),
    gauge,
    updatedAt: Date.now(),
  }
}

function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

// ----- persistence -----

const STORAGE_KEY = 'crochet:amigurumi'

export function loadFigures(): Figure[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Figure[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveFigure(fig: Figure): void {
  const all = loadFigures()
  const next = { ...fig, updatedAt: Date.now() }
  const idx = all.findIndex((x) => x.id === fig.id)
  if (idx >= 0) all[idx] = next
  else all.unshift(next)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function deleteFigure(id: string): void {
  const all = loadFigures().filter((f) => f.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}
