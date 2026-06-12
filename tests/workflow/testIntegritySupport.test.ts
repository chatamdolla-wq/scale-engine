import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_COVERAGE_EPSILON,
  computeTestFileHash,
  detectCoverageRegression,
  enumerateTestFiles,
  isEnforcedTestIntegrityProfile,
  isTestFile,
  readCoverageBaseline,
  readTestIntegrityBaseline,
  writeCoverageBaseline,
  writeTestIntegrityBaseline,
} from '../../src/workflow/gates/testIntegritySupport.js'

let dirs: string[] = []

function tmp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  dirs.push(dir)
  return dir
}

function gitRepo(): string {
  const dir = tmp('ti-repo-')
  execSync('git init -q', { cwd: dir })
  execSync('git config user.email t@t.io && git config user.name t', { cwd: dir })
  return dir
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

describe('isTestFile', () => {
  it('matches suffix and directory conventions, ignores source files', () => {
    expect(isTestFile('tests/foo.test.ts')).toBe(true)
    expect(isTestFile('src/__tests__/foo.ts')).toBe(true)
    expect(isTestFile('pkg/foo.spec.tsx')).toBe(true)
    expect(isTestFile('spec/bar.js')).toBe(true)
    expect(isTestFile('src/foo.ts')).toBe(false)
    expect(isTestFile('README.md')).toBe(false)
  })
})

describe('isEnforcedTestIntegrityProfile', () => {
  it('enforces full/ci/strict (and tokenized variants), advisory otherwise', () => {
    expect(isEnforcedTestIntegrityProfile('full')).toBe(true)
    expect(isEnforcedTestIntegrityProfile('ci')).toBe(true)
    expect(isEnforcedTestIntegrityProfile('strict')).toBe(true)
    expect(isEnforcedTestIntegrityProfile('preflight:ci')).toBe(true)
    expect(isEnforcedTestIntegrityProfile('release-full')).toBe(true)
    expect(isEnforcedTestIntegrityProfile('default')).toBe(false)
    expect(isEnforcedTestIntegrityProfile('auto')).toBe(false)
    expect(isEnforcedTestIntegrityProfile(undefined)).toBe(false)
  })
})

describe('detectCoverageRegression', () => {
  it('flags a block-severity finding when coverage drops beyond epsilon', () => {
    const { delta, finding } = detectCoverageRegression(80, 90)
    expect(delta).toBeCloseTo(-10)
    expect(finding?.kind).toBe('coverage-regression')
    expect(finding?.severity).toBe('block')
  })

  it('returns no finding within epsilon and when a baseline is missing', () => {
    expect(detectCoverageRegression(89.7, 90).finding).toBeUndefined()
    expect(detectCoverageRegression(50, undefined)).toEqual({})
    expect(detectCoverageRegression(undefined, 90)).toEqual({})
    expect(DEFAULT_COVERAGE_EPSILON).toBeGreaterThan(0)
  })
})

describe('enumerateTestFiles + computeTestFileHash', () => {
  it('enumerates test files deterministically and detects content changes', () => {
    const repo = gitRepo()
    mkdirSync(join(repo, 'tests'), { recursive: true })
    writeFileSync(join(repo, 'tests', 'a.test.ts'), 'expect(1).toBe(1)\n')
    writeFileSync(join(repo, 'tests', 'b.spec.ts'), 'expect(2).toBe(2)\n')
    writeFileSync(join(repo, 'src.ts'), 'export const x = 1\n')

    const files = enumerateTestFiles(repo)
    expect(files).toEqual(['tests/a.test.ts', 'tests/b.spec.ts'])

    const h1 = computeTestFileHash(repo, files)
    writeFileSync(join(repo, 'tests', 'a.test.ts'), 'expect(1).toBe(2)\n')
    const h2 = computeTestFileHash(repo, files)
    expect(h1).not.toBe(h2)

    // Stable when content is unchanged.
    expect(computeTestFileHash(repo, files)).toBe(h2)
  })

  it('falls back to a filesystem walk outside a git repo', () => {
    const dir = tmp('ti-nogit-')
    mkdirSync(join(dir, 'tests'), { recursive: true })
    writeFileSync(join(dir, 'tests', 'a.test.ts'), 'x')
    writeFileSync(join(dir, 'index.ts'), 'y')
    expect(enumerateTestFiles(dir)).toEqual(['tests/a.test.ts'])
  })
})

describe('baseline persistence', () => {
  it('round-trips the test-integrity baseline and coverage baseline', () => {
    const scaleDir = tmp('ti-scale-')
    writeTestIntegrityBaseline(scaleDir, {
      taskId: 'TASK-1',
      profile: 'ci',
      enforce: true,
      testFileHashAtVerify: 'deadbeef',
      testFiles: ['tests/a.test.ts'],
      coverage: 91.2,
      verifiedAt: 123,
    })
    const record = readTestIntegrityBaseline(scaleDir, 'TASK-1')
    expect(record?.testFileHashAtVerify).toBe('deadbeef')
    expect(record?.enforce).toBe(true)
    expect(record?.testFiles).toEqual(['tests/a.test.ts'])

    expect(readCoverageBaseline(scaleDir, 'TASK-1')).toBeUndefined()
    writeCoverageBaseline(scaleDir, 'TASK-1', 91.2)
    expect(readCoverageBaseline(scaleDir, 'TASK-1')).toBeCloseTo(91.2)
  })

  it('returns null/undefined for unknown tasks', () => {
    const scaleDir = tmp('ti-scale-')
    expect(readTestIntegrityBaseline(scaleDir, 'missing')).toBeNull()
    expect(readCoverageBaseline(scaleDir, 'missing')).toBeUndefined()
  })
})
