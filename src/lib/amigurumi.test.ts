import { describe, it, expect } from 'vitest'
import {
  shapeProfile,
  profileToRounds,
  roundPlan,
  roundInstruction,
  planConsumed,
  planProduced,
  partPattern,
  FIGURE_PRESETS,
  figureFromPreset,
  type ShapeParams,
} from './amigurumi'
import {
  typicalGauge,
  cellAspect,
  widestFromDiameter,
  diameterFromWidest,
  YARN_WEIGHTS,
  type Gauge,
} from './gauge'

const gauge: Gauge = typicalGauge(YARN_WEIGHTS[4]) // worsted (#4)
const aspect = cellAspect(gauge)

describe('roundPlan stitch math (1 unit = 1 stitch)', () => {
  it("matches the user's example: 6 -> 9 is *1 sc, inc* x3 (9)", () => {
    const rounds = profileToRounds([6, 9])
    const plan = roundPlan(rounds[1], 6)
    expect(plan).toEqual([{ plain: 1, op: 'inc', times: 3 }])
    // 1 sc (1 unit) + inc (2 units) = 3 units per repeat, x3 = 9 stitches.
    expect(planProduced(plan)).toBe(9)
    expect(planConsumed(plan)).toBe(6)
    expect(roundInstruction(rounds[1], 6)).toBe('*1 sc, inc* x3 (9)')
  })

  it('produces exactly the stated stitch count for an uneven increase round', () => {
    // 24 -> 30: 6 increases over 24 sts -> *3 sc, inc* x6 (30)
    const rounds = profileToRounds([24, 30])
    const plan = roundPlan(rounds[1], 24)
    expect(planConsumed(plan)).toBe(24)
    expect(planProduced(plan)).toBe(30)
    expect(roundInstruction(rounds[1], 24)).toBe('*3 sc, inc* x6 (30)')
  })

  it('handles increases that do not divide evenly by splitting into two groups', () => {
    // 25 -> 30: 5 increases over 25 sts, plain = 20, 20/5 = 4 evenly
    const even = roundPlan(profileToRounds([25, 30])[1], 25)
    expect(planConsumed(even)).toBe(25)
    expect(planProduced(even)).toBe(30)
    // 26 -> 30: 4 increases, plain = 18, 18/4 = 4 r2 -> two groups
    const uneven = roundPlan(profileToRounds([26, 30])[1], 26)
    expect(planConsumed(uneven)).toBe(26)
    expect(planProduced(uneven)).toBe(30)
  })

  it('produces exactly the stated stitch count for a decrease round', () => {
    // 30 -> 24: 6 decreases -> *3 sc, dec* x6 (24)
    const rounds = profileToRounds([30, 24])
    const plan = roundPlan(rounds[1], 30)
    expect(planConsumed(plan)).toBe(30)
    expect(planProduced(plan)).toBe(24)
    expect(roundInstruction(rounds[1], 30)).toBe('*3 sc, dec* x6 (24)')
  })

  it('treats round 1 as a magic ring and even rounds as plain sc', () => {
    const rounds = profileToRounds([6, 6])
    expect(planProduced(roundPlan(rounds[0], 0))).toBe(6)
    expect(roundInstruction(rounds[0], 0)).toBe('6 sc in a magic ring (6)')
    expect(roundInstruction(rounds[1], 6)).toBe('sc in each st around (6)')
  })
})

describe('every round of every profile balances', () => {
  const shapes: ShapeParams[] = [
    { start: 6, maxStitches: 36, oval: 1, closed: true },
    { start: 6, maxStitches: 60, oval: 1, closed: true },
    { start: 6, maxStitches: 42, oval: 1.6, closed: true },
    { start: 6, maxStitches: 12, oval: 2.8, closed: true },
    { start: 5, maxStitches: 25, oval: 0.7, closed: false },
    { start: 4, maxStitches: 10, oval: 1.8, closed: false },
  ]

  for (const shape of shapes) {
    it(`profile ${shape.start}->${shape.maxStitches} oval ${shape.oval} balances`, () => {
      const profile = shapeProfile(shape, aspect)
      const rounds = profileToRounds(profile)
      rounds.forEach((round, i) => {
        const plan = roundPlan(round, i === 0 ? 0 : profile[i - 1])
        // produced units always equal the round's stated stitch count
        expect(planProduced(plan)).toBe(profile[i])
        if (i > 0) {
          // consumed units always equal the previous round's stitch count
          expect(planConsumed(plan)).toBe(profile[i - 1])
        }
      })
    })
  }
})

describe('shapeProfile geometry', () => {
  it('grows monotonically to the peak then mirrors back down when closed', () => {
    const profile = shapeProfile({ start: 6, maxStitches: 36, oval: 1, closed: true }, aspect)
    expect(profile[0]).toBe(6)
    expect(Math.max(...profile)).toBe(36)
    // symmetric
    expect(profile).toEqual([...profile].reverse())
    // each step at most doubles (a single inc round can only double)
    for (let i = 1; i < profile.length; i++) {
      if (profile[i] > profile[i - 1]) expect(profile[i]).toBeLessThanOrEqual(profile[i - 1] * 2)
    }
  })

  it('tapers increases toward the equator (sphere, not cone)', () => {
    const profile = shapeProfile({ start: 6, maxStitches: 60, oval: 1, closed: true }, aspect)
    const half = profile.slice(0, profile.indexOf(Math.max(...profile)) + 1)
    const deltas = half.slice(1).map((n, i) => n - half[i])
    // the last increase before the equator is no larger than the first
    expect(deltas[deltas.length - 1]).toBeLessThanOrEqual(deltas[0])
  })

  it('an open piece ends at the widest round (no decrease)', () => {
    const profile = shapeProfile({ start: 6, maxStitches: 30, oval: 1, closed: false }, aspect)
    expect(profile[profile.length - 1]).toBe(Math.max(...profile))
  })
})

describe('diameter <-> widest stitch count', () => {
  it('derives widest from a target diameter via the circumference', () => {
    // widest = pi * diameter / stitchWidth (circumference / stitch width)
    const w = widestFromDiameter(2, gauge)
    expect(w).toBe(Math.round((Math.PI * 2 * gauge.stsPer4in) / 4))
  })

  it('round-trips diameter -> widest -> diameter within one stitch', () => {
    for (const d of [1, 2, 3.5, 5]) {
      const w = widestFromDiameter(d, gauge)
      const back = diameterFromWidest(w, gauge)
      expect(Math.abs(back - d)).toBeLessThan(diameterFromWidest(1, gauge))
    }
  })
})

describe('partPattern matches the rendered profile', () => {
  it("each instruction's (n) equals the round it describes for every preset part", () => {
    for (const preset of FIGURE_PRESETS) {
      const fig = figureFromPreset(preset, gauge)
      for (const part of fig.parts) {
        const pat = partPattern(part, gauge)
        const profile = shapeProfile(part.shape, aspect)
        expect(pat.rounds.map((r) => r.stitches)).toEqual(profile)
        expect(pat.total).toBe(profile.reduce((a, b) => a + b, 0))
      }
    }
  })
})
