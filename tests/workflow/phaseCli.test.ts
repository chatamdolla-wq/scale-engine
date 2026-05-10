import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { execa } from 'execa'

let dirs: string[] = []

function makeScaleDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'scale-cli-'))
  dirs.push(dir)
  return dir
}

async function runScale(args: string[], scaleDir: string) {
  return execa('node', ['--import', 'tsx', 'src/api/cli.ts', ...args], {
    env: { ...process.env, SCALE_DIR: scaleDir, SCALE_LOG_LEVEL: undefined },
    reject: false,
  })
}

function parseJson<T = unknown>(stdout: string): T {
  return JSON.parse(stdout) as T
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
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
})
