import { afterEach, describe, expect, it } from 'vitest'
import { execa } from 'execa'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let dirs: string[] = []

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

function makeDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  dirs.push(dir)
  return dir
}

function write(projectDir: string, relativePath: string, content: string): void {
  const target = join(projectDir, ...relativePath.split('/'))
  mkdirSync(target.split(/[\\/]/).slice(0, -1).join('/'), { recursive: true })
  writeFileSync(target, content, 'utf-8')
}

function runScale(args: string[], scaleDir: string, projectDir: string) {
  return execa('node', ['--import', 'tsx', 'src/api/cli.ts', ...args], {
    env: {
      ...process.env,
      SCALE_DIR: scaleDir,
      SCALE_PROJECT_DIR: projectDir,
      SCALE_LOG_LEVEL: undefined,
    },
    reject: false,
  })
}

function runScaleWithoutScaleEnv(args: string[]) {
  return execa('node', ['--import', 'tsx', 'src/api/cli.ts', ...args], {
    env: {
      ...process.env,
      SCALE_DIR: undefined,
      SCALE_PROJECT_DIR: undefined,
      SCALE_LOG_LEVEL: undefined,
    },
    reject: false,
  })
}

function writeFailingSuite(scaleDir: string, caseId = 'missing-proof') {
  const suitesDir = join(scaleDir, 'evals', 'suites')
  mkdirSync(suitesDir, { recursive: true })
  writeFileSync(join(suitesDir, 'failing.json'), JSON.stringify({
    version: '1.0',
    id: 'failing',
    name: 'Failing replay suite',
    cases: [
      {
        id: caseId,
        type: 'bugfix',
        title: 'Missing verification evidence is preserved',
        task: 'Simulate an agent claim without a passing command.',
        phase: 'verify',
        successCriteria: ['command exits 0'],
        expectedFailureCategory: 'missing-verification-evidence',
        attempts: [
          {
            id: 'attempt-1',
            command: 'node -e "console.error(\'no verification evidence\'); process.exit(1)"',
            expectedExitCode: 0,
          },
        ],
      },
    ],
  }, null, 2), 'utf-8')
}

describe('artifact CLI', () => {
  it('renders and doctors a task HTML artifact', async () => {
    const projectDir = makeDir('scale-artifact-cli-project-')
    const scaleDir = makeDir('scale-artifact-cli-state-')
    const taskId = '2026-05-18-cli'
    write(projectDir, `docs/worklog/tasks/${taskId}/summary.md`, '# Summary\n\nReady for review.\n')
    write(projectDir, `docs/worklog/tasks/${taskId}/verification.md`, '# Verification\n\nnpm test exit 0.\n')

    const render = await runScale([
      'artifact',
      'render',
      '--dir',
      projectDir,
      '--task-id',
      taskId,
      '--type',
      'status-report',
      '--json',
    ], scaleDir, projectDir)

    expect(render.exitCode).toBe(0)
    const rendered = JSON.parse(render.stdout) as { outputPath: string; indexPath: string }
    expect(readFileSync(rendered.outputPath, 'utf-8')).toContain('Ready for review')
    expect(readFileSync(rendered.indexPath, 'utf-8')).toContain('status-report')

    const doctor = await runScale([
      'artifact',
      'doctor',
      '--dir',
      projectDir,
      '--task-id',
      taskId,
      '--json',
    ], scaleDir, projectDir)

    expect(doctor.exitCode).toBe(0)
    expect(JSON.parse(doctor.stdout)).toMatchObject({ ok: true })
  }, 20_000)

  it('renders a governance dashboard from runtime, eval, memory, resource, and HTML artifact evidence', async () => {
    const projectDir = makeDir('scale-artifact-dashboard-project-')
    const scaleDir = makeDir('scale-artifact-dashboard-state-')
    const taskId = '2026-05-19-dashboard'
    write(projectDir, 'README.md', '# Demo\n')
    write(projectDir, `docs/worklog/tasks/${taskId}/summary.md`, '# Summary\n\nDashboard scope.\n')
    write(projectDir, `docs/worklog/tasks/${taskId}/verification.md`, '# Verification\n\nRuntime evidence exists.\n')

    const runtimeStart = await runScale([
      'runtime',
      'start',
      '--session-id',
      'SESSION-DASH',
      '--task-id',
      taskId,
      '--level',
      'M',
      '--summary',
      'Dashboard test',
    ], scaleDir, projectDir)
    expect(runtimeStart.exitCode).toBe(0)

    const runtimeRecord = await runScale([
      'runtime',
      'record',
      '--title',
      'dashboard smoke',
      '--status',
      'passed',
      '--exit-code',
      '0',
      '--summary',
      'dashboard evidence passed',
    ], scaleDir, projectDir)
    expect(runtimeRecord.exitCode).toBe(0)

    const html = await runScale([
      'artifact',
      'render',
      '--dir',
      projectDir,
      '--task-id',
      taskId,
      '--type',
      'status-report',
      '--json',
    ], scaleDir, projectDir)
    expect(html.exitCode).toBe(0)

    writeFailingSuite(scaleDir, taskId)
    const evalRun = await runScale(['eval', 'run', '--suite', 'failing', '--json'], scaleDir, projectDir)
    expect(evalRun.exitCode).toBe(1)
    const evalReport = JSON.parse(evalRun.stdout) as { run: { failureReplayIds: string[] } }
    expect(evalReport.run.failureReplayIds.length).toBe(1)

    const ingest = await runScale([
      'memory',
      'ingest',
      '--from',
      'failure',
      '--failure-id',
      evalReport.run.failureReplayIds[0],
      '--json',
    ], scaleDir, projectDir)
    expect(ingest.exitCode).toBe(0)

    const dashboard = await runScale([
      'artifact',
      'dashboard',
      '--dir',
      projectDir,
      '--task-id',
      taskId,
      '--json',
    ], scaleDir, projectDir)
    expect(dashboard.exitCode).toBe(0)
    const report = JSON.parse(dashboard.stdout) as {
      ok: boolean
      outputPath: string
      manifestPath: string
      summary: {
        runtime: { passed: number }
        eval: { failures: number }
        memory: { candidate: number }
        htmlArtifacts: { count: number }
        governanceMetrics: {
          commandRuns: { savedEstimatedTokens: number }
          modelUsage: { cacheSavingsTokens: number }
        }
      }
      findings: Array<{ code: string }>
    }
    expect(report.ok).toBe(true)
    expect(report.summary.runtime.passed).toBe(1)
    expect(report.summary.eval.failures).toBe(1)
    expect(report.summary.memory.candidate).toBeGreaterThanOrEqual(1)
    expect(report.summary.htmlArtifacts.count).toBeGreaterThanOrEqual(1)
    expect(report.summary.governanceMetrics.commandRuns.savedEstimatedTokens).toBeGreaterThanOrEqual(0)
    expect(report.summary.governanceMetrics.modelUsage.cacheSavingsTokens).toBeGreaterThanOrEqual(0)
    expect(report.findings.map(finding => finding.code)).toContain('open-eval-failures')
    expect(readFileSync(report.outputPath, 'utf-8')).toContain('SCALE Governance Dashboard')
    expect(readFileSync(report.outputPath, 'utf-8')).toContain('Governance Metrics')
    expect(readFileSync(report.outputPath, 'utf-8')).toContain('missing-verification-evidence')
    expect(readFileSync(report.manifestPath, 'utf-8')).toContain('generated-report')
  }, 60_000)

  it('honors --dir for dashboard default output when SCALE_DIR is not set', async () => {
    const projectDir = makeDir('scale-artifact-dashboard-dir-project-')
    write(projectDir, 'README.md', '# Demo\n')

    const dashboard = await runScaleWithoutScaleEnv([
      'artifact',
      'dashboard',
      '--dir',
      projectDir,
      '--json',
    ])

    expect(dashboard.exitCode).toBe(0)
    const report = JSON.parse(dashboard.stdout) as { outputPath: string; manifestPath: string }
    expect(report.outputPath).toBe(join(projectDir, '.scale', 'reports', 'governance-dashboard.html'))
    expect(report.manifestPath).toBe(join(projectDir, '.scale', 'reports', 'governance-dashboard-manifest.json'))
    expect(existsSync(report.outputPath)).toBe(true)
    expect(existsSync(report.manifestPath)).toBe(true)
  }, 20_000)
})
