import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { execa } from 'execa'

let dirs: string[] = []
let repoFiles: string[] = []

function makeScaleDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'scale-cli-'))
  dirs.push(dir)
  return dir
}

async function runScale(args: string[], scaleDir: string) {
  return execa('node', ['--import', 'tsx', 'src/api/cli.ts', ...args], {
    env: {
      ...process.env,
      SCALE_DIR: scaleDir,
      SCALE_LOG_LEVEL: undefined,
      SCALE_VERIFICATION_BUILD_CMD: undefined,
      SCALE_VERIFICATION_LINT_CMD: undefined,
      SCALE_VERIFICATION_TEST_CMD: undefined,
      SCALE_VERIFICATION_COVERAGE_CMD: undefined,
    },
    reject: false,
  })
}

function parseJson<T = unknown>(stdout: string): T {
  return JSON.parse(stdout) as T
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  for (const file of repoFiles) rmSync(file, { force: true })
  // Clean up test-fixtures/phase-cli directory if created
  rmSync(join('test-fixtures', 'phase-cli'), { recursive: true, force: true })
  dirs = []
  repoFiles = []
})

describe('phase CLI workflow', () => {
  it('blocks ship before review, then allows review -> ship --no-commit without changing HEAD', async () => {
    const scaleDir = makeScaleDir()

    const define = await runScale([
      'define',
      'CLI Regression Feature',
      '--description',
      'Implement a deterministic CLI regression workflow with input arguments and output evidence persisted by the CLI. Use TypeScript CLI commands with rollback constraints, quality lint typecheck, and acceptance verification evidence.',
      '--success-criteria',
      'verify evidence is persisted,review evidence is persisted,ship skip commit does not commit',
      '--json',
    ], scaleDir)
    expect(define.exitCode).toBe(0)
    const specId = parseJson<{ spec: { id: string } }>(define.stdout).spec.id

    const plan = await runScale(['plan', specId, '--rollback', 'Delete generated artifacts in temporary SCALE_DIR', '--json'], scaleDir)
    expect(plan.exitCode).toBe(0)
    const planId = parseJson<{ plan: { id: string } }>(plan.stdout).plan.id

    const build = await runScale(['build', planId, '--description', 'CLI regression task', '--json'], scaleDir)
    expect(build.exitCode).toBe(0)
    const taskId = parseJson<{ task: { id: string } }>(build.stdout).task.id

    const coverageCommand = 'node -p String.fromCharCode(65,108,108,32,102,105,108,101,115,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48)'
    const verify = await runScale([
      'verify',
      taskId,
      '--build-cmd',
      'node -v',
      '--lint-cmd',
      'node -v',
      '--test-cmd',
      'node -v',
      '--coverage-cmd',
      coverageCommand,
      '--json',
    ], scaleDir)
    expect(verify.exitCode).toBe(0)
    expect(parseJson<{ passed: boolean }>(verify.stdout).passed).toBe(true)

    const blockedShip = await runScale(['ship', taskId, '--no-commit', '--json'], scaleDir)
    expect(blockedShip.exitCode).not.toBe(0)
    expect(blockedShip.stderr).toContain('Task not reviewed with persisted passing evidence')

    const review = await runScale(['review', taskId, '--json'], scaleDir)
    expect(review.exitCode).toBe(0)
    const reviewResult = parseJson<{ passed: boolean; reviewId: string }>(review.stdout)
    expect(reviewResult.passed).toBe(true)
    expect(reviewResult.reviewId).toMatch(/^REVIEW-/)

    const headBefore = await execa('git', ['rev-parse', 'HEAD'])
    const ship = await runScale(['ship', taskId, '--no-commit', '--json'], scaleDir)
    const headAfter = await execa('git', ['rev-parse', 'HEAD'])

    expect(ship.exitCode).toBe(0)
    const shipResult = parseJson<{ commitHash: string | null; reviewValidation: { ok: boolean }; evidenceValidation: { ok: boolean } }>(ship.stdout)
    expect(shipResult.commitHash).toBeNull()
    expect(shipResult.reviewValidation.ok).toBe(true)
    expect(shipResult.evidenceValidation.ok).toBe(true)
    expect(headAfter.stdout).toBe(headBefore.stdout)
  }, 120_000)

  it('blocks committing unreviewed files instead of staging the whole workspace', async () => {
    const scaleDir = makeScaleDir()
    const define = await runScale([
      'define',
      'Scoped Ship Feature',
      '--description',
      'Implement a TypeScript CLI workflow that accepts task input arguments, persists review evidence output, enforces rollback constraints, includes lint and typecheck quality standards, and verifies with test acceptance evidence so unreviewed files are never included in a release commit today.',
      '--success-criteria',
      'verification evidence is persisted,review evidence is persisted,unreviewed files block ship',
      '--goal',
      'Prevent release commits from including files that were not covered by persisted review evidence.',
      '--constraint',
      'Only files present in passing review records may be staged by ship; unrelated working tree changes must remain untouched.',
      '--acceptance',
      'Ship exits non-zero when a new unreviewed file exists after review and HEAD remains unchanged.',
      '--context',
      'The CLI stores verification evidence and review evidence in a temporary SCALE_DIR during this regression test.',
      '--risk',
      'A broad git add could commit unrelated files from the shared repository workspace.',
      '--priority',
      'Protect commit scope before creating a release commit.',
      '--json',
    ], scaleDir)
    expect(define.exitCode).toBe(0)
    const specId = parseJson<{ spec: { id: string } }>(define.stdout).spec.id

    const plan = await runScale(['plan', specId, '--rollback', 'Delete temporary test artifacts', '--json'], scaleDir)
    expect(plan.exitCode).toBe(0)
    const planId = parseJson<{ plan: { id: string } }>(plan.stdout).plan.id

    const build = await runScale(['build', planId, '--description', 'Scoped ship task', '--json'], scaleDir)
    expect(build.exitCode).toBe(0)
    const taskId = parseJson<{ task: { id: string } }>(build.stdout).task.id

    const coverageCommand = 'node -p String.fromCharCode(65,108,108,32,102,105,108,101,115,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48)'
    const verify = await runScale([
      'verify',
      taskId,
      '--build-cmd',
      'node -v',
      '--lint-cmd',
      'node -v',
      '--test-cmd',
      'node -v',
      '--coverage-cmd',
      coverageCommand,
      '--json',
    ], scaleDir)
    expect(verify.exitCode).toBe(0)
    expect(parseJson<{ passed: boolean }>(verify.stdout).passed).toBe(true)

    // Use a directory that is NOT in .gitignore so git ls-files can detect it
    // tmp/ is ignored by .gitignore, so use test-fixtures/ instead
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const reviewedPath = join('test-fixtures', 'phase-cli', `reviewed-${suffix}.txt`)
    const unreviewedPath = join('test-fixtures', 'phase-cli', `unreviewed-${suffix}.txt`)
    // Ensure directory exists
    mkdirSync(join('test-fixtures', 'phase-cli'), { recursive: true })
    repoFiles.push(reviewedPath, unreviewedPath)
    writeFileSync(reviewedPath, 'reviewed\n', 'utf-8')
    const review = await runScale(['review', taskId, '--json'], scaleDir)
    expect(review.exitCode).toBe(0)
    expect(parseJson<{ passed: boolean }>(review.stdout).passed).toBe(true)

    writeFileSync(unreviewedPath, 'unreviewed\n', 'utf-8')
    const headBefore = await execa('git', ['rev-parse', 'HEAD'])
    const ship = await runScale(['ship', taskId, '--message', 'test: scoped ship regression', '--json'], scaleDir)
    const headAfter = await execa('git', ['rev-parse', 'HEAD'])

    expect(ship.exitCode).not.toBe(0)
    expect(ship.stderr).toContain('Unreviewed working tree changes detected')
    expect(ship.stderr).toContain(unreviewedPath.replace(/\\/g, '/'))
    expect(headAfter.stdout).toBe(headBefore.stdout)
  }, 120_000)
})
