import { describe, expect, it } from 'vitest'
import { analyzeReview, parseChangedFiles, shouldReviewFile, summarizeFindings } from '../../src/workflow/ReviewAnalyzer.js'

describe('ReviewAnalyzer', () => {
  it('parses git status changed files', () => {
    expect(parseChangedFiles(' M src/a.ts\n?? src/new file.ts\nD  src/old.ts\n')).toEqual([
      { status: 'M', path: 'src/a.ts' },
      { status: '??', path: 'src/new file.ts' },
      { status: 'D', path: 'src/old.ts' },
    ])
  })

  it('ignores runtime and binary paths', () => {
    expect(shouldReviewFile('.scale/evidence/a.json')).toBe(false)
    expect(shouldReviewFile('dist/index.js')).toBe(false)
    expect(shouldReviewFile('docs/imgs/logo.png')).toBe(false)
    expect(shouldReviewFile('src/workflow/')).toBe(false)
    expect(shouldReviewFile('src/index.ts')).toBe(true)
  })

  it('flags missing verification evidence', () => {
    const result = analyzeReview({ statusOutput: ' M src/a.ts', diffs: [] })

    expect(result.findings).toContainEqual(expect.objectContaining({
      category: 'process',
      severity: 'HIGH',
    }))
  })

  it('flags deleted source files', () => {
    const result = analyzeReview({
      statusOutput: ' D src/removed.ts',
      diffs: [],
      taskPayload: { verificationEvidenceIds: ['GATE-1'] },
    })

    expect(result.findings).toContainEqual(expect.objectContaining({
      category: 'logic',
      severity: 'HIGH',
      file: 'src/removed.ts',
    }))
  })

  it('flags public API changes without docs or tests', () => {
    const result = analyzeReview({
      statusOutput: ' M src/artifact/types.ts',
      diffs: [],
      taskPayload: { verificationEvidenceIds: ['GATE-1'] },
    })

    expect(result.findings).toContainEqual(expect.objectContaining({
      category: 'process',
      severity: 'MEDIUM',
    }))
  })

  it('does not flag public API changes when docs or tests changed', () => {
    const result = analyzeReview({
      statusOutput: ' M src/artifact/types.ts\n M tests/workflow/example.test.ts',
      diffs: [],
      taskPayload: { verificationEvidenceIds: ['GATE-1'] },
    })

    expect(result.findings.some(f => f.description.includes('Public API'))).toBe(false)
  })

  it('flags secret-like assignments in diffs', () => {
    const secretLikeDiff = '+const api' + 'Key = "abc123"\n'
    const result = analyzeReview({
      statusOutput: ' M src/config.ts',
      diffs: [{ file: 'src/config.ts', text: secretLikeDiff }],
      taskPayload: { verificationEvidenceIds: ['GATE-1'] },
    })

    expect(result.findings).toContainEqual(expect.objectContaining({
      category: 'security',
      severity: 'CRITICAL',
      file: 'src/config.ts',
    }))
  })

  it('includes untracked files in changed files', () => {
    const result = analyzeReview({
      statusOutput: '?? src/new.ts',
      diffs: [],
      taskPayload: { verificationEvidenceIds: ['GATE-1'] },
    })

    expect(result.changedFiles).toEqual([{ status: '??', path: 'src/new.ts' }])
  })

  it('excludes untracked directory placeholders while keeping expanded files', () => {
    const result = analyzeReview({
      statusOutput: '?? src/workflow/\n?? src/workflow/index.ts',
      diffs: [],
      taskPayload: { verificationEvidenceIds: ['GATE-1'] },
    })

    expect(result.changedFiles).toEqual([{ status: '??', path: 'src/workflow/index.ts' }])
  })

  it('flags secret-like assignments in untracked file content', () => {
    const secretLikeDiff = '+const tok' + 'en = "abc123"\n'
    const result = analyzeReview({
      statusOutput: '?? src/new-config.ts',
      diffs: [{ file: 'src/new-config.ts', text: secretLikeDiff }],
      taskPayload: { verificationEvidenceIds: ['GATE-1'] },
    })

    expect(result.findings).toContainEqual(expect.objectContaining({
      category: 'security',
      severity: 'CRITICAL',
      file: 'src/new-config.ts',
    }))
  })

  it('flags large diffs', () => {
    const text = Array.from({ length: 6 }, (_, index) => `+line ${index}`).join('\n')
    const result = analyzeReview({
      statusOutput: ' M src/large.ts',
      diffs: [{ file: 'src/large.ts', text }],
      taskPayload: { verificationEvidenceIds: ['GATE-1'] },
      largeDiffThreshold: 5,
    })

    expect(result.findings).toContainEqual(expect.objectContaining({
      category: 'process',
      severity: 'MEDIUM',
    }))
  })

  it('summarizes finding severity counts', () => {
    const summary = summarizeFindings([
      { category: 'security', severity: 'CRITICAL', description: 'a' },
      { category: 'logic', severity: 'HIGH', description: 'b' },
      { category: 'process', severity: 'MEDIUM', description: 'c' },
      { category: 'style', severity: 'LOW', description: 'd' },
    ])

    expect(summary).toEqual({ critical: 1, high: 1, medium: 1, low: 1 })
  })
})
