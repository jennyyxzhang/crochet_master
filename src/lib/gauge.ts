// Yarn weight reference data + gauge / sizing math.
// Gauge values follow the Craft Yarn Council standard, measured in single
// crochet over a 4 in (10.16 cm) swatch. These ranges are approximations —
// the accurate path is always for the user to measure their own swatch.

export const CM_PER_INCH = 2.54
export const SWATCH_INCHES = 4

export type Unit = 'in' | 'cm'

export interface YarnWeight {
  id: number
  name: string
  symbol: string
  examples: string
  /** recommended hook size range in mm */
  hookMm: [number, number]
  /** single crochet stitches per 4 in (low, typical, high) */
  sts: [number, number, number]
  /** single crochet rows per 4 in (low, typical, high) */
  rows: [number, number, number]
}

export const YARN_WEIGHTS: YarnWeight[] = [
  {
    id: 0,
    name: 'Lace',
    symbol: '0',
    examples: 'fingering, 10-count crochet thread',
    hookMm: [1.6, 2.25],
    sts: [32, 37, 42],
    rows: [36, 42, 48],
  },
  {
    id: 1,
    name: 'Super Fine',
    symbol: '1',
    examples: 'sock, fingering, baby',
    hookMm: [2.25, 3.5],
    sts: [21, 27, 32],
    rows: [24, 31, 37],
  },
  {
    id: 2,
    name: 'Fine',
    symbol: '2',
    examples: 'sport, baby',
    hookMm: [3.5, 4.5],
    sts: [16, 18, 20],
    rows: [18, 21, 23],
  },
  {
    id: 3,
    name: 'Light',
    symbol: '3',
    examples: 'DK, light worsted',
    hookMm: [4.5, 5.5],
    sts: [12, 14, 17],
    rows: [14, 16, 20],
  },
  {
    id: 4,
    name: 'Medium',
    symbol: '4',
    examples: 'worsted, afghan, aran',
    hookMm: [5.5, 6.5],
    sts: [11, 13, 14],
    rows: [13, 15, 16],
  },
  {
    id: 5,
    name: 'Bulky',
    symbol: '5',
    examples: 'chunky, craft, rug',
    hookMm: [6.5, 9],
    sts: [8, 10, 11],
    rows: [9, 11, 13],
  },
  {
    id: 6,
    name: 'Super Bulky',
    symbol: '6',
    examples: 'super bulky, roving',
    hookMm: [9, 15],
    sts: [7, 8, 9],
    rows: [7, 9, 11],
  },
  {
    id: 7,
    name: 'Jumbo',
    symbol: '7',
    examples: 'jumbo, giant roving',
    hookMm: [15, 25],
    sts: [4, 5, 6],
    rows: [4, 5, 7],
  },
]

export interface StitchType {
  id: string
  name: string
  /** relative yarn used per stitch, as a multiple of stitch width */
  yarnFactor: number
}

export const STITCH_TYPES: StitchType[] = [
  { id: 'ch', name: 'Chain (ch)', yarnFactor: 1.0 },
  { id: 'sc', name: 'Single crochet (sc)', yarnFactor: 2.8 },
  { id: 'hdc', name: 'Half double crochet (hdc)', yarnFactor: 3.5 },
  { id: 'dc', name: 'Double crochet (dc)', yarnFactor: 4.4 },
  { id: 'tr', name: 'Treble crochet (tr)', yarnFactor: 5.6 },
]

/** Gauge expressed per 4 in (10.16 cm) swatch. */
export interface Gauge {
  stsPer4in: number
  rowsPer4in: number
}

export function inToCm(inches: number): number {
  return inches * CM_PER_INCH
}

export function cmToIn(cm: number): number {
  return cm / CM_PER_INCH
}

export function toInches(value: number, unit: Unit): number {
  return unit === 'in' ? value : cmToIn(value)
}

export function fromInches(inches: number, unit: Unit): number {
  return unit === 'in' ? inches : inToCm(inches)
}

/** Finished size (in inches) for a given stitch & row count. */
export function sizeFromCounts(
  stitches: number,
  rows: number,
  gauge: Gauge,
): { widthIn: number; heightIn: number } {
  return {
    widthIn: (stitches * SWATCH_INCHES) / gauge.stsPer4in,
    heightIn: (rows * SWATCH_INCHES) / gauge.rowsPer4in,
  }
}

/** Stitch & row counts needed to reach a desired finished size (inches). */
export function countsFromSize(
  widthIn: number,
  heightIn: number,
  gauge: Gauge,
): { stitches: number; rows: number } {
  return {
    stitches: Math.max(1, Math.round((widthIn * gauge.stsPer4in) / SWATCH_INCHES)),
    rows: Math.max(1, Math.round((heightIn * gauge.rowsPer4in) / SWATCH_INCHES)),
  }
}

/**
 * Ratio of cell width to cell height for a true-proportion preview.
 * Single crochet is usually wider than tall, so this is typically > 1.
 */
export function cellAspect(gauge: Gauge): number {
  const cellWidth = SWATCH_INCHES / gauge.stsPer4in
  const cellHeight = SWATCH_INCHES / gauge.rowsPer4in
  return cellWidth / cellHeight
}

/**
 * Very rough yardage estimate. Yarn use depends heavily on tension and stitch
 * type, so this is clearly labelled as an approximation in the UI.
 */
export function estimateYardage(
  stitches: number,
  gauge: Gauge,
  stitch: StitchType,
): { yards: number; meters: number } {
  const stitchWidthIn = SWATCH_INCHES / gauge.stsPer4in
  const yarnPerStitchIn = stitchWidthIn * stitch.yarnFactor
  const totalIn = yarnPerStitchIn * stitches
  const yards = totalIn / 36
  return { yards, meters: (yards * 0.9144) }
}

export function typicalGauge(weight: YarnWeight): Gauge {
  return { stsPer4in: weight.sts[1], rowsPer4in: weight.rows[1] }
}
