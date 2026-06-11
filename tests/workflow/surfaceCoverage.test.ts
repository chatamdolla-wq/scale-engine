import { describe, expect, it } from 'vitest'
import { computeSurfaceCoverage, formatSurfaceCoverageWarnings } from '../../src/workflow/SurfaceCoverage.js'

describe('computeSurfaceCoverage', () => {
  it('reports zero declared when verificationSurface is empty/undefined', () => {
    expect(computeSurfaceCoverage(undefined, ['anything'])).toEqual({
      declared: 0,
      mapped: 0,
      unmapped: [],
      items: [],
    })
    expect(computeSurfaceCoverage([], ['anything']).declared).toBe(0)
  })

  it('maps a surface item when a signal contains it (command match)', () => {
    const report = computeSurfaceCoverage(['npm run e2e:auth'], ['node -v', 'npm run e2e:auth --silent'])
    expect(report.mapped).toBe(1)
    expect(report.unmapped).toEqual([])
    expect(report.items[0]).toMatchObject({ surface: 'npm run e2e:auth', mapped: true })
  })

  it('maps a file path surface when a changed file matches', () => {
    const report = computeSurfaceCoverage(['tests/auth/oauth.test.ts'], ['tests/auth/oauth.test.ts'])
    expect(report.mapped).toBe(1)
  })

  it('reduces glob patterns to their literal prefix for matching', () => {
    const report = computeSurfaceCoverage(['src/auth/**'], ['src/auth/oauth.ts'])
    expect(report.mapped).toBe(1)
    expect(report.unmapped).toEqual([])
  })

  it('flags unmapped surface items without blocking', () => {
    const report = computeSurfaceCoverage(
      ['tests/auth/oauth.test.ts', 'npm run perf:bench'],
      ['tests/auth/oauth.test.ts'],
    )
    expect(report.declared).toBe(2)
    expect(report.mapped).toBe(1)
    expect(report.unmapped).toEqual(['npm run perf:bench'])
  })

  it('matches via an explicit verificationSurfaceRef-style signal', () => {
    const report = computeSurfaceCoverage(['benchmark:p95'], ['benchmark:p95'])
    expect(report.mapped).toBe(1)
  })
})

describe('formatSurfaceCoverageWarnings', () => {
  it('returns no lines when everything is mapped', () => {
    const report = computeSurfaceCoverage(['npm run test'], ['npm run test'])
    expect(formatSurfaceCoverageWarnings(report)).toEqual([])
  })

  it('returns no lines when nothing is declared', () => {
    expect(formatSurfaceCoverageWarnings(computeSurfaceCoverage([], []))).toEqual([])
  })

  it('produces a soft warning header plus one line per unmapped item', () => {
    const report = computeSurfaceCoverage(['a-surface-item', 'another-surface-item'], [])
    const lines = formatSurfaceCoverageWarnings(report)
    expect(lines[0]).toContain('0/2 mapped')
    expect(lines[0]).toContain('not blocking')
    expect(lines.some(l => l.includes('[UNMAPPED] a-surface-item'))).toBe(true)
    expect(lines.some(l => l.includes('[UNMAPPED] another-surface-item'))).toBe(true)
  })
})
