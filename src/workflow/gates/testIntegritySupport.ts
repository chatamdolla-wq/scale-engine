// SCALE Engine — G23 Test Integrity support helpers (P1.2, PR-D2)
// Deterministic test-file enumeration + hashing (verify→ship consistency),
// coverage-regression detection, per-task baseline persistence, and the
// profile policy that decides advisory vs enforced (decision E1).

import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { TestIntegrityFinding } from '../../artifact/types.js'

/** Matches test files by filename suffix or by living under a tests/__tests__ dir. */
export const TEST_FILE_PATTERN = /(?:^|\/)(?:__tests__|tests?|specs?)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/

export function isTestFile(path: string): boolean {
  return TEST_FILE_PATTERN.test(path.split(sep).join('/'))
}

/** Default coverage regression tolerance (percentage points) — decision G1 (ε). */
export const DEFAULT_COVERAGE_EPSILON = 0.5

/**
 * Profiles in which G23 enforces block-severity findings (decision E1).
 * `default`/`auto` stay advisory; `full`/`ci`/`strict` (as a name token) enforce.
 */
export function isEnforcedTestIntegrityProfile(profileName: string | undefined): boolean {
  if (!profileName) return false
  return /(?:^|[:_-])(?:full|ci|strict)$/i.test(profileName) || /^(?:full|ci|strict)$/i.test(profileName)
}

function walkFiles(dir: string, root: string, acc: string[]): void {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === 'coverage') continue
    const full = join(dir, entry)
    let isDir = false
    try {
      isDir = statSync(full).isDirectory()
    } catch {
      continue
    }
    if (isDir) walkFiles(full, root, acc)
    else acc.push(relative(root, full).split(sep).join('/'))
  }
}

/**
 * Deterministically enumerate test files under `cwd`. Prefers git (tracked +
 * untracked-not-ignored) so verify and ship agree on the same set; falls back
 * to a filesystem walk outside a git repo. Always sorted, repo-relative, POSIX.
 */
export function enumerateTestFiles(cwd: string): string[] {
  let candidates: string[] = []
  try {
    const out = execSync('git ls-files --cached --others --exclude-standard', {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe',
      maxBuffer: 32 * 1024 * 1024,
    })
    candidates = out.split('\n').map(line => line.trim()).filter(Boolean)
  } catch {
    const acc: string[] = []
    walkFiles(cwd, cwd, acc)
    candidates = acc
  }
  return [...new Set(candidates.filter(isTestFile))].sort()
}

/**
 * Hash the content of the given test files (sorted) into a single sha256 hex.
 * Missing files are folded in as an explicit marker so deletions change the hash.
 */
export function computeTestFileHash(cwd: string, files: string[]): string {
  const hash = createHash('sha256')
  for (const file of [...files].sort()) {
    hash.update(file)
    hash.update('\0')
    try {
      hash.update(readFileSync(join(cwd, file)))
    } catch {
      hash.update('\0<missing>')
    }
    hash.update('\n')
  }
  return hash.digest('hex')
}

/** Compute coverage delta and, if it regresses beyond ε, a block-severity finding. */
export function detectCoverageRegression(
  current: number | undefined,
  baseline: number | undefined,
  epsilon: number = DEFAULT_COVERAGE_EPSILON,
): { delta?: number; finding?: TestIntegrityFinding } {
  if (typeof current !== 'number' || typeof baseline !== 'number') return {}
  const delta = current - baseline
  if (delta < -epsilon) {
    return {
      delta,
      finding: {
        file: '(coverage)',
        kind: 'coverage-regression',
        severity: 'block',
        detail: `Coverage regressed ${delta.toFixed(2)}pp vs baseline (current=${current.toFixed(2)}%, baseline=${baseline.toFixed(2)}%, ε=${epsilon})`,
      },
    }
  }
  return { delta }
}

export interface TestIntegrityBaselineRecord {
  taskId: string
  profile: string
  enforce: boolean
  testFileHashAtVerify: string
  testFiles: string[]
  coverage?: number
  verifiedAt: number
}

export interface CoverageBaselineRecord {
  coverage: number
  updatedAt: number
}

function integrityDir(scaleDir: string): string {
  const dir = join(scaleDir, 'test-integrity')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function safeTaskId(taskId: string): string {
  return taskId.replace(/[^A-Za-z0-9._-]/g, '_')
}

export function writeTestIntegrityBaseline(scaleDir: string, record: TestIntegrityBaselineRecord): string {
  const file = join(integrityDir(scaleDir), `${safeTaskId(record.taskId)}.json`)
  writeFileSync(file, JSON.stringify(record, null, 2), 'utf-8')
  return file
}

export function readTestIntegrityBaseline(scaleDir: string, taskId: string): TestIntegrityBaselineRecord | null {
  const file = join(scaleDir, 'test-integrity', `${safeTaskId(taskId)}.json`)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as TestIntegrityBaselineRecord
  } catch {
    return null
  }
}

export function writeCoverageBaseline(scaleDir: string, taskId: string, coverage: number): void {
  const file = join(integrityDir(scaleDir), `${safeTaskId(taskId)}.coverage.json`)
  const record: CoverageBaselineRecord = { coverage, updatedAt: Date.now() }
  writeFileSync(file, JSON.stringify(record, null, 2), 'utf-8')
}

export function readCoverageBaseline(scaleDir: string, taskId: string): number | undefined {
  const file = join(scaleDir, 'test-integrity', `${safeTaskId(taskId)}.coverage.json`)
  if (!existsSync(file)) return undefined
  try {
    return (JSON.parse(readFileSync(file, 'utf-8')) as CoverageBaselineRecord).coverage
  } catch {
    return undefined
  }
}
