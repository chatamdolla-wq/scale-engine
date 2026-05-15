import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { execa } from 'execa'

let dirs: string[] = []
let repoFiles: string[] = []
let repoDirs: string[] = []

function makeScaleDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'scale-cli-'))
  dirs.push(dir)
  return dir
}

function makeProjectDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'scale-project-'))
  dirs.push(dir)
  return dir
}

async function runScale(args: string[], scaleDir: string, projectDir?: string) {
  return execa('node', ['--import', 'tsx', 'src/api/cli.ts', ...args], {
    env: {
      ...process.env,
      SCALE_DIR: scaleDir,
      SCALE_PROJECT_DIR: projectDir,
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
  for (const dir of repoDirs) rmSync(dir, { recursive: true, force: true })
  // Clean up test-fixtures/phase-cli directory if created
  rmSync(join('test-fixtures', 'phase-cli'), { recursive: true, force: true })
  dirs = []
  repoFiles = []
  repoDirs = []
})

describe('phase CLI workflow', () => {
  it('runs service-aware preflight without requiring a task', async () => {
    const scaleDir = makeScaleDir()
    const projectDir = makeProjectDir()
    mkdirSync(join(projectDir, 'services', 'api'), { recursive: true })
    mkdirSync(join(projectDir, 'services', 'gateway'), { recursive: true })
    writeFileSync(join(scaleDir, 'verification.json'), JSON.stringify({
      version: 1,
      defaultProfile: 'default',
      profiles: { default: { commands: {} } },
      services: [
        { name: 'api', path: 'services/api', required: true },
        { name: 'gateway', path: 'services/gateway', required: true },
      ],
    }, null, 2), 'utf-8')

    const coverageCommand = 'node -p String.fromCharCode(65,108,108,32,102,105,108,101,115,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48)'
    const preflight = await runScale([
      'preflight',
      '--service',
      'all',
      '--build-cmd',
      'node -v',
      '--lint-cmd',
      'node -v',
      '--test-cmd',
      'node -v',
      '--coverage-cmd',
      coverageCommand,
      '--json',
    ], scaleDir, projectDir)

    expect(preflight.exitCode).toBe(0)
    const result = parseJson<{ passed: boolean; services: string[]; targets: Array<{ service: string; passed: boolean }> }>(preflight.stdout)
    expect(result.passed).toBe(true)
    expect(result.services).toEqual(['api', 'gateway'])
    expect(result.targets.every(target => target.passed)).toBe(true)
  }, 120_000)

  it('blocks ship before review, then allows review -> ship --no-commit without changing HEAD', async () => {
    const scaleDir = makeScaleDir()
    const projectDir = makeProjectDir()

    const define = await runScale([
      'define',
      'CLI Regression Feature',
      '--description',
      'Implement a deterministic CLI regression workflow with input arguments and output evidence persisted by the CLI. Use TypeScript CLI commands with rollback constraints, quality lint typecheck, and acceptance verification evidence.',
      '--success-criteria',
      'verify evidence is persisted,review evidence is persisted,ship skip commit does not commit',
      '--json',
    ], scaleDir, projectDir)
    expect(define.exitCode).toBe(0)
    const specId = parseJson<{ spec: { id: string } }>(define.stdout).spec.id

    const plan = await runScale(['plan', specId, '--rollback', 'Delete generated artifacts in temporary SCALE_DIR', '--json'], scaleDir, projectDir)
    expect(plan.exitCode).toBe(0)
    const planId = parseJson<{ plan: { id: string } }>(plan.stdout).plan.id

    const build = await runScale(['build', planId, '--description', 'CLI regression task', '--level', 'L', '--service', 'api,gateway', '--json'], scaleDir, projectDir)
    expect(build.exitCode).toBe(0)
    const buildResult = parseJson<{ task: { id: string }; artifactDir?: string }>(build.stdout)
    const taskId = buildResult.task.id
    expect(buildResult.artifactDir).toContain('docs/worklog/tasks/')
    if (buildResult.artifactDir) repoDirs.push(join(projectDir, buildResult.artifactDir))
    const artifactCheck = await runScale(['task-artifacts', 'check', '--dir', buildResult.artifactDir!, '--level', 'L', '--json'], scaleDir, projectDir)
    expect(artifactCheck.exitCode).toBe(1)
    expect(parseJson<{ complete: boolean; incomplete: Array<{ file: string }> }>(artifactCheck.stdout)).toMatchObject({
      complete: false,
    })

    const coverageCommand = 'node -p String.fromCharCode(65,108,108,32,102,105,108,101,115,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48)'
    mkdirSync(join(projectDir, 'test-fixtures', 'phase-cli', 'api'), { recursive: true })
    mkdirSync(join(projectDir, 'test-fixtures', 'phase-cli', 'gateway'), { recursive: true })
    writeFileSync(join(scaleDir, 'verification.json'), JSON.stringify({
      version: 1,
      defaultProfile: 'default',
      profiles: { default: { commands: {} } },
      services: [
        { name: 'api', path: 'test-fixtures/phase-cli/api', required: true },
        { name: 'gateway', path: 'test-fixtures/phase-cli/gateway', required: true },
      ],
    }, null, 2), 'utf-8')
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
    ], scaleDir, projectDir)
    expect(verify.exitCode).toBe(0)
    const verifyResult = parseJson<{ passed: boolean; services: string[]; verificationArtifactPath: string; artifactCheck: { complete: boolean; incomplete: Array<{ file: string }> }; metric: { taskId: string; level: string; services: string[]; firstVerificationPass: boolean; artifactComplete: boolean; finalGateStatus: string } }>(verify.stdout)
    expect(verifyResult.passed).toBe(true)
    expect(verifyResult.services).toEqual(['api', 'gateway'])
    expect(verifyResult.verificationArtifactPath).toContain('verification.md')
    expect(verifyResult.metric).toMatchObject({
      taskId,
      level: 'L',
      services: ['api', 'gateway'],
      firstVerificationPass: true,
      artifactComplete: false,
      finalGateStatus: 'passed',
    })
    expect(verifyResult.artifactCheck.complete).toBe(false)
    expect(verifyResult.artifactCheck.incomplete.map(item => item.file)).toContain('mini-prd.md')

    const metrics = await runScale(['metrics', 'list', '--json'], scaleDir, projectDir)
    expect(metrics.exitCode).toBe(0)
    const metricsResult = parseJson<{ summary: { total: number; firstPassRate: number }; records: Array<{ taskId: string; level: string }> }>(metrics.stdout)
    expect(metricsResult.summary.total).toBe(1)
    expect(metricsResult.summary.firstPassRate).toBe(1)
    expect(metricsResult.records[0]).toMatchObject({ taskId, level: 'L' })

    const blockedShip = await runScale(['ship', taskId, '--no-commit', '--json'], scaleDir, projectDir)
    expect(blockedShip.exitCode).not.toBe(0)
    expect(blockedShip.stderr).toContain('Task not reviewed with persisted passing evidence')

    const review = await runScale(['review', taskId, '--json'], scaleDir, projectDir)
    expect(review.exitCode).toBe(0)
    const reviewResult = parseJson<{ passed: boolean; reviewId: string }>(review.stdout)
    expect(reviewResult.passed).toBe(true)
    expect(reviewResult.reviewId).toMatch(/^REVIEW-/)

    const headBefore = await execa('git', ['rev-parse', 'HEAD'])
    const ship = await runScale(['ship', taskId, '--no-commit', '--json'], scaleDir, projectDir)
    const headAfter = await execa('git', ['rev-parse', 'HEAD'])

    expect(ship.exitCode).toBe(0)
    const shipResult = parseJson<{ commitHash: string | null; reviewValidation: { ok: boolean }; evidenceValidation: { ok: boolean } }>(ship.stdout)
    expect(shipResult.commitHash).toBeNull()
    expect(shipResult.reviewValidation.ok).toBe(true)
    expect(shipResult.evidenceValidation.ok).toBe(true)
    expect(headAfter.stdout).toBe(headBefore.stdout)
  }, 120_000)

  it('uses changed files during verify to refresh skill routing evidence requirements', async () => {
    const scaleDir = makeScaleDir()
    const projectDir = makeProjectDir()
    await execa('git', ['init'], { cwd: projectDir })
    mkdirSync(join(projectDir, 'src', 'components'), { recursive: true })
    writeFileSync(join(projectDir, 'src', 'components', 'Panel.tsx'), 'export const Panel = () => null\n', 'utf-8')

    const define = await runScale([
      'define',
      'Changed File Skill Feature',
      '--description',
      'Implement a deterministic TypeScript CLI workflow today that accepts task input arguments, persists verification evidence output, keeps rollback constraints explicit, and proves that skill routing can inspect changed files during verification.',
      '--success-criteria',
      'verification evidence is persisted,skill routing checks changed files',
      '--json',
    ], scaleDir, projectDir)
    expect(define.exitCode).toBe(0)
    const specId = parseJson<{ spec: { id: string } }>(define.stdout).spec.id

    const plan = await runScale(['plan', specId, '--rollback', 'Delete temporary files', '--json'], scaleDir, projectDir)
    expect(plan.exitCode).toBe(0)
    const planId = parseJson<{ plan: { id: string } }>(plan.stdout).plan.id

    const build = await runScale(['build', planId, '--description', 'Neutral implementation task', '--level', 'M', '--json'], scaleDir, projectDir)
    expect(build.exitCode).toBe(0)
    const buildResult = parseJson<{ task: { id: string }; artifactDir?: string }>(build.stdout)
    if (buildResult.artifactDir) repoDirs.push(join(projectDir, buildResult.artifactDir))

    const coverageCommand = 'node -p String.fromCharCode(65,108,108,32,102,105,108,101,115,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48)'
    const verify = await runScale([
      'verify',
      buildResult.task.id,
      '--build-cmd',
      'node -v',
      '--lint-cmd',
      'node -v',
      '--test-cmd',
      'node -v',
      '--coverage-cmd',
      coverageCommand,
      '--json',
    ], scaleDir, projectDir)

    expect(verify.exitCode).toBe(0)
    const verifyResult = parseJson<{ skillGate: { complete: boolean; missing: string[] } }>(verify.stdout)
    expect(verifyResult.skillGate.complete).toBe(false)
    expect(verifyResult.skillGate.missing).toEqual(expect.arrayContaining(['ui-spec.md', 'visual-review.md']))
  }, 120_000)

  it('can hard-block verification and ship when required M/L artifacts are placeholders', async () => {
    const scaleDir = makeScaleDir()
    const projectDir = makeProjectDir()

    const define = await runScale([
      'define',
      'Artifact Gate Feature',
      '--description',
      'Implement a deterministic TypeScript CLI artifact gate workflow that accepts task input arguments, persists output verification evidence, checks required medium and large task documents for substantive content, enforces rollback risk constraints, keeps lint and typecheck quality standards, verifies acceptance evidence today, blocks task completion when configured to require artifacts, and prevents ship from bypassing an incomplete artifact gate.',
      '--success-criteria',
      'artifact gate blocks incomplete documents,ship cannot bypass artifact gate,verification evidence is still persisted',
      '--json',
    ], scaleDir, projectDir)
    expect(define.exitCode).toBe(0)
    const specId = parseJson<{ spec: { id: string } }>(define.stdout).spec.id

    const plan = await runScale(['plan', specId, '--rollback', 'Delete generated temporary artifacts', '--json'], scaleDir, projectDir)
    expect(plan.exitCode).toBe(0)
    const planId = parseJson<{ plan: { id: string } }>(plan.stdout).plan.id

    const build = await runScale(['build', planId, '--description', 'Artifact gate task', '--level', 'L', '--json'], scaleDir, projectDir)
    expect(build.exitCode).toBe(0)
    const buildResult = parseJson<{ task: { id: string }; artifactDir?: string }>(build.stdout)
    if (buildResult.artifactDir) repoDirs.push(join(projectDir, buildResult.artifactDir))

    const coverageCommand = 'node -p String.fromCharCode(65,108,108,32,102,105,108,101,115,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48,32,124,32,49,48,48,46,48,48)'
    const verify = await runScale([
      'verify',
      buildResult.task.id,
      '--build-cmd',
      'node -v',
      '--lint-cmd',
      'node -v',
      '--test-cmd',
      'node -v',
      '--coverage-cmd',
      coverageCommand,
      '--artifact-gate',
      'block',
      '--json',
    ], scaleDir, projectDir)

    expect(verify.exitCode).toBe(0)
    const verifyResult = parseJson<{
      passed: boolean
      artifactGate: { mode: string; applies: boolean; checked: boolean; complete: boolean; blocked: boolean }
      metric: { finalGateStatus: string; artifactComplete: boolean }
    }>(verify.stdout)
    expect(verifyResult.passed).toBe(false)
    expect(verifyResult.artifactGate).toMatchObject({
      mode: 'block',
      applies: true,
      checked: true,
      complete: false,
      blocked: true,
    })
    expect(verifyResult.metric).toMatchObject({
      finalGateStatus: 'blocked',
      artifactComplete: false,
    })

    const ship = await runScale(['ship', buildResult.task.id, '--no-commit', '--json'], scaleDir, projectDir)
    expect(ship.exitCode).not.toBe(0)
    expect(ship.stderr).toContain('Task artifact gate did not pass')
  }, 120_000)

  it('blocks committing unreviewed files instead of staging the whole workspace', async () => {
    const scaleDir = makeScaleDir()
    const projectDir = makeProjectDir()
    await execa('git', ['init'], { cwd: projectDir })
    writeFileSync(join(projectDir, 'README.md'), 'fixture\n', 'utf-8')
    await execa('git', ['add', 'README.md'], { cwd: projectDir })
    await execa('git', ['-c', 'user.email=scale-test@example.com', '-c', 'user.name=Scale Test', 'commit', '-m', 'test fixture'], { cwd: projectDir })
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
    ], scaleDir, projectDir)
    expect(define.exitCode).toBe(0)
    const specId = parseJson<{ spec: { id: string } }>(define.stdout).spec.id

    const plan = await runScale(['plan', specId, '--rollback', 'Delete temporary test artifacts', '--json'], scaleDir, projectDir)
    expect(plan.exitCode).toBe(0)
    const planId = parseJson<{ plan: { id: string } }>(plan.stdout).plan.id

    const build = await runScale(['build', planId, '--description', 'Scoped ship task', '--json'], scaleDir, projectDir)
    expect(build.exitCode).toBe(0)
    const buildResult = parseJson<{ task: { id: string }; artifactDir?: string }>(build.stdout)
    const taskId = buildResult.task.id
    if (buildResult.artifactDir) repoDirs.push(join(projectDir, buildResult.artifactDir))

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
    ], scaleDir, projectDir)
    expect(verify.exitCode).toBe(0)
    expect(parseJson<{ passed: boolean }>(verify.stdout).passed).toBe(true)

    // Use a directory that is NOT in .gitignore so git ls-files can detect it
    // tmp/ is ignored by .gitignore, so use test-fixtures/ instead
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const reviewedRel = join('test-fixtures', 'phase-cli', `reviewed-${suffix}.txt`)
    const unreviewedRel = join('test-fixtures', 'phase-cli', `unreviewed-${suffix}.txt`)
    const reviewedPath = join(projectDir, reviewedRel)
    const unreviewedPath = join(projectDir, unreviewedRel)
    // Ensure directory exists
    mkdirSync(join(projectDir, 'test-fixtures', 'phase-cli'), { recursive: true })
    repoFiles.push(reviewedPath, unreviewedPath)
    writeFileSync(reviewedPath, 'reviewed\n', 'utf-8')
    const review = await runScale(['review', taskId, '--json'], scaleDir, projectDir)
    expect(review.exitCode).toBe(0)
    expect(parseJson<{ passed: boolean }>(review.stdout).passed).toBe(true)

    writeFileSync(unreviewedPath, 'unreviewed\n', 'utf-8')
    const headBefore = await execa('git', ['rev-parse', 'HEAD'], { cwd: projectDir })
    const ship = await runScale(['ship', taskId, '--message', 'test: scoped ship regression', '--json'], scaleDir, projectDir)
    const headAfter = await execa('git', ['rev-parse', 'HEAD'], { cwd: projectDir })

    expect(ship.exitCode).not.toBe(0)
    expect(ship.stderr).toContain('Unreviewed working tree changes detected')
    expect(ship.stderr).toContain(unreviewedRel.replace(/\\/g, '/'))
    expect(headAfter.stdout).toBe(headBefore.stdout)
  }, 120_000)
})
