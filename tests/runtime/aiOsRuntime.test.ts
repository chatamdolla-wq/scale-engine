import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createAiOsAdoption, createAiOsBenchmark, createAiOsDashboard, createAiOsDoctor, createAiOsMigration, createAiOsPlan, createAiOsRun, createAiOsStatus } from '../../src/runtime/AiOsRuntime.js'
import { MemoryBrain } from '../../src/memory/MemoryBrain.js'
import { SCALE_ENGINE_VERSION } from '../../src/version.js'

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

describe('AI OS runtime planner', () => {
  it('builds one explainable plan across governance, context, memory, skills, and ROI', async () => {
    const projectDir = makeDir('scale-ai-os-project-')
    const scaleDir = makeDir('scale-ai-os-scale-')
    const brain = new MemoryBrain({ projectDir, scaleDir })
    try {
      brain.addNode({
        id: 'MEM-AI-OS-1',
        type: 'decision',
        title: 'OAuth callbacks use Redis state',
        summary: 'OAuth callbacks must resolve provider and user context from server-side Redis state.',
        source: 'manual',
        evidencePaths: ['docs/oauth-state.md'],
        confidence: 0.88,
        scope: 'project',
        status: 'active',
      })
    } finally {
      brain.close()
    }

    const plan = await createAiOsPlan({
      projectDir,
      scaleDir,
      taskId: 'TASK-AI-OS',
      task: 'Fix OAuth callback auth token handling and verify browser flow',
      level: 'L',
      files: ['src/auth/oauth.ts', 'src/ui/callback.tsx'],
      budget: 2400,
    })

    expect(plan.version).toBe(SCALE_ENGINE_VERSION)
    expect(plan.governance.effectiveMode).toBe('critical')
    expect(plan.context.compiler?.strategy).toBe('relevance-budget-v1')
    expect(plan.memory.providerOrder).toEqual(['agentmemory', 'gbrain', 'scale-local'])
    expect(plan.memory.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'scale-local', id: 'MEM-AI-OS-1' }),
    ]))
    expect(plan.skillPlan.executionPlan.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'skill', id: 'security-review', required: true }),
      expect.objectContaining({ kind: 'verification', id: 'browser-run' }),
    ]))
    expect(plan.adaptiveWorkflow.requiredBehaviors).toContain('run security review')
    expect(plan.roi.modules.map(module => module.module)).toEqual(expect.arrayContaining([
      'context-compiler',
      'memory-provider-runtime',
      'skill-routing-engine',
      'progressive-governance',
    ]))
  })

  it('creates a dry-run execution report from the unified plan', async () => {
    const projectDir = makeDir('scale-ai-os-run-project-')
    const scaleDir = makeDir('scale-ai-os-run-scale-')

    const report = await createAiOsRun({
      projectDir,
      scaleDir,
      taskId: 'TASK-AI-OS-RUN',
      task: 'Review auth token handling and verify browser callback flow',
      level: 'L',
      files: ['src/auth/token.ts', 'src/ui/callback.tsx'],
      budget: 2400,
      mode: 'dry-run',
    })

    expect(report.mode).toBe('dry-run')
    expect(report.dryRun).toBe(true)
    expect(report.status).toBe('ready')
    expect(report.plan.task.taskId).toBe('TASK-AI-OS-RUN')
    expect(report.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'runtime-plan', status: 'passed' }),
      expect.objectContaining({ id: 'context-compiler', status: 'passed' }),
      expect.objectContaining({ id: 'memory-provider-recall', status: 'passed' }),
      expect.objectContaining({ id: 'skill-evidence', status: 'planned' }),
      expect.objectContaining({ id: 'runtime-evidence', status: 'planned' }),
    ]))
    expect(report.steps.some(step => step.kind === 'skill' && step.required)).toBe(true)
    expect(report.evidence.required).toEqual(expect.arrayContaining([
      'context-compiler',
      'memory-provider-recall',
      'skill-routing-engine',
      'runtime-evidence',
    ]))
    expect(report.failureLearning.candidates).toEqual([])
    expect(report.artifacts.runReport).toContain('TASK-AI-OS-RUN')
    expect(existsSync(report.artifacts.runReport)).toBe(true)
    expect(report.nextActions).toEqual(expect.arrayContaining([
      expect.stringContaining('Execute required skill'),
    ]))
  })

  it('runs guarded verification commands into runtime evidence', async () => {
    const projectDir = makeDir('scale-ai-os-guarded-project-')
    const scaleDir = makeDir('scale-ai-os-guarded-scale-')

    const report = await createAiOsRun({
      projectDir,
      scaleDir,
      taskId: 'TASK-AI-OS-GUARDED',
      task: 'Verify guarded AI OS execution evidence',
      level: 'M',
      files: ['src/runtime/AiOsRuntime.ts'],
      budget: 2400,
      mode: 'guarded',
      verificationCommands: ['node -e "process.stdout.write(\'ok\')"'],
    })

    expect(report.mode).toBe('guarded')
    expect(report.dryRun).toBe(false)
    expect(report.status).toBe('ready')
    expect(report.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'runtime-evidence', status: 'passed' }),
      expect.objectContaining({ id: 'verify-command:1', status: 'passed', kind: 'evidence' }),
    ]))
    expect(report.evidence.produced).toContain('runtime-evidence')
    expect(report.verification.commands).toEqual([
      expect.objectContaining({ command: 'node -e "process.stdout.write(\'ok\')"', status: 'passed', exitCode: 0 }),
    ])
    expect(report.verification.commands[0].evidenceId).toMatch(/^RTE-/)
    expect(report.failureLearning.candidates).toEqual([])
  }, 120_000)

  it('blocks guarded runs and creates a failure learning candidate when verification fails', async () => {
    const projectDir = makeDir('scale-ai-os-guarded-fail-project-')
    const scaleDir = makeDir('scale-ai-os-guarded-fail-scale-')

    const report = await createAiOsRun({
      projectDir,
      scaleDir,
      taskId: 'TASK-AI-OS-GUARDED-FAIL',
      task: 'Verify guarded AI OS execution failure learning',
      level: 'M',
      files: ['src/runtime/AiOsRuntime.ts'],
      budget: 2400,
      mode: 'guarded',
      verificationCommands: ['node -e "process.exit(7)"'],
    })

    expect(report.status).toBe('blocked')
    expect(report.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'runtime-evidence', status: 'blocked' }),
      expect.objectContaining({ id: 'verify-command:1', status: 'blocked' }),
    ]))
    expect(report.verification.commands[0]).toEqual(expect.objectContaining({ status: 'failed', exitCode: 7 }))
    expect(report.failureLearning.status).toBe('candidate-created')
    expect(report.failureLearning.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: 'failed-step',
        promotable: false,
      }),
    ]))
  }, 120_000)

  it('summarizes persisted AI OS run reports for dashboard views', async () => {
    const projectDir = makeDir('scale-ai-os-dashboard-project-')
    const scaleDir = makeDir('scale-ai-os-dashboard-scale-')

    await createAiOsRun({
      projectDir,
      scaleDir,
      taskId: 'TASK-AI-OS-DASH-READY',
      task: 'Verify ready dashboard run',
      level: 'M',
      files: ['src/runtime/AiOsRuntime.ts'],
      mode: 'guarded',
      verificationCommands: ['node -v'],
    })
    await createAiOsRun({
      projectDir,
      scaleDir,
      taskId: 'TASK-AI-OS-DASH-BLOCKED',
      task: 'Verify blocked dashboard run',
      level: 'M',
      files: ['src/runtime/AiOsRuntime.ts'],
      mode: 'guarded',
      verificationCommands: ['node definitely-missing-scale-dashboard-file.js'],
    })

    const dashboard = createAiOsDashboard({ projectDir, scaleDir })

    expect(dashboard.summary).toMatchObject({
      totalRuns: 2,
      readyRuns: 1,
      blockedRuns: 1,
      verificationCommands: 2,
      failedVerificationCommands: 1,
      failureLearningCandidates: 1,
    })
    expect(dashboard.health.status).toBe('attention')
    expect(dashboard.latestRuns.map(run => run.taskId)).toEqual([
      'TASK-AI-OS-DASH-BLOCKED',
      'TASK-AI-OS-DASH-READY',
    ])
    expect(dashboard.recommendations).toEqual(expect.arrayContaining([
      expect.stringContaining('Resolve blocked AI OS run'),
    ]))
  }, 120_000)

  it('benchmarks fixed AI OS scenarios with context, memory, skill, and dashboard metrics', async () => {
    const projectDir = makeDir('scale-ai-os-benchmark-project-')
    const scaleDir = makeDir('scale-ai-os-benchmark-scale-')

    await createAiOsRun({
      projectDir,
      scaleDir,
      taskId: 'TASK-AI-OS-BENCH-RUN',
      task: 'Verify benchmark dashboard input',
      level: 'M',
      files: ['src/runtime/AiOsRuntime.ts'],
      mode: 'guarded',
      verificationCommands: ['node -v'],
    })

    const benchmark = await createAiOsBenchmark({ projectDir, scaleDir })

    expect(benchmark.summary.scenarios).toBeGreaterThanOrEqual(3)
    expect(benchmark.summary.totalEstimatedTokens).toBeGreaterThanOrEqual(0)
    expect(benchmark.summary.totalSkillSteps).toBeGreaterThan(0)
    expect(benchmark.summary.governanceModes.length).toBeGreaterThan(0)
    expect(benchmark.scenarios).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'docs-governance',
        metrics: expect.objectContaining({
          skillSteps: expect.any(Number),
          memoryItems: expect.any(Number),
        }),
      }),
      expect.objectContaining({ id: 'security-code-change' }),
      expect.objectContaining({ id: 'browser-ui-flow' }),
    ]))
    expect(benchmark.dashboard.summary.totalRuns).toBe(1)
    expect(benchmark.artifacts.benchmarkReport).toContain('benchmarks')
    expect(existsSync(benchmark.artifacts.benchmarkReport)).toBe(true)
    expect(benchmark.recommendations).toEqual(expect.arrayContaining([
      expect.stringContaining('Use benchmark deltas'),
    ]))
  }, 120_000)

  it('creates an idempotent AI OS migration report for runtime state directories', () => {
    const projectDir = makeDir('scale-ai-os-migrate-project-')
    const scaleDir = makeDir('scale-ai-os-migrate-scale-')

    const first = createAiOsMigration({ projectDir, scaleDir })
    const second = createAiOsMigration({ projectDir, scaleDir })

    expect(first.status).toBe('migrated')
    expect(first.created).toEqual(expect.arrayContaining([
      expect.stringContaining('ai-os/runs'),
      expect.stringContaining('ai-os/benchmarks'),
    ]))
    expect(first.files.migrationReport).toContain('migration.json')
    expect(existsSync(first.files.migrationReport)).toBe(true)
    expect(second.status).toBe('compatible')
    expect(second.created).toEqual([])
    expect(second.warnings).toEqual([])
  })

  it('doctors AI OS runtime readiness from migration, runs, dashboard, and benchmark evidence', async () => {
    const projectDir = makeDir('scale-ai-os-doctor-project-')
    const scaleDir = makeDir('scale-ai-os-doctor-scale-')

    const beforeMigration = createAiOsDoctor({ projectDir, scaleDir })

    expect(beforeMigration.status).toBe('blocked')
    expect(beforeMigration.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'ai-os-runtime-dirs', status: 'blocked' }),
    ]))
    expect(beforeMigration.nextActions).toEqual(expect.arrayContaining([
      expect.stringContaining('scale ai-os migrate'),
    ]))

    createAiOsMigration({ projectDir, scaleDir })
    await createAiOsRun({
      projectDir,
      scaleDir,
      taskId: 'TASK-AI-OS-DOCTOR',
      task: 'Verify AI OS doctor readiness',
      level: 'M',
      files: ['src/runtime/AiOsRuntime.ts'],
      mode: 'guarded',
      verificationCommands: ['node -v'],
    })
    await createAiOsBenchmark({ projectDir, scaleDir })

    const ready = createAiOsDoctor({ projectDir, scaleDir, benchmarkMaxAgeHours: 24 })

    expect(ready.status).toBe('ready')
    expect(ready.dashboard.health.status).toBe('healthy')
    expect(ready.summary).toMatchObject({
      totalChecks: 4,
      passedChecks: 4,
      warningChecks: 0,
      blockedChecks: 0,
    })
    expect(ready.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'ai-os-runtime-dirs', status: 'passed' }),
      expect.objectContaining({ id: 'ai-os-run-history', status: 'passed' }),
      expect.objectContaining({ id: 'ai-os-dashboard-health', status: 'passed' }),
      expect.objectContaining({ id: 'ai-os-benchmark', status: 'passed' }),
    ]))
    expect(ready.nextActions).toContain('AI OS beta runtime is ready for guarded project tasks.')
  }, 120_000)

  it('adopts AI OS runtime through migrate, first dry-run, benchmark, and doctor phases', async () => {
    const projectDir = makeDir('scale-ai-os-adopt-project-')
    const scaleDir = makeDir('scale-ai-os-adopt-scale-')

    const report = await createAiOsAdoption({
      projectDir,
      scaleDir,
      taskId: 'TASK-AI-OS-ADOPT',
      task: 'Adopt AI OS runtime for a new project',
      level: 'M',
      files: ['src/runtime/AiOsRuntime.ts'],
      budget: 2400,
      lang: 'en',
    })

    expect(report.status).toBe('ready')
    expect(report.phases.map(phase => phase.id)).toEqual([
      'migrate',
      'first-run',
      'benchmark',
      'doctor',
    ])
    expect(report.phases.every(phase => phase.status === 'passed')).toBe(true)
    expect(report.migration.status).toBe('migrated')
    expect(report.run.mode).toBe('dry-run')
    expect(report.benchmark.summary.scenarios).toBeGreaterThanOrEqual(3)
    expect(report.doctor.status).toBe('ready')
    expect(report.artifacts.migrationReport).toContain('migration.json')
    expect(report.artifacts.runReport).toContain('runs')
    expect(report.artifacts.benchmarkReport).toContain('benchmarks')
    expect(existsSync(report.artifacts.adoptionReport)).toBe(true)
    expect(report.nextActions).toContain('AI OS runtime adoption is complete; use `scale ai-os run --mode guarded` for governed work.')
  }, 120_000)

  it('reports AI OS closed-loop status and missing evidence', async () => {
    const projectDir = makeDir('scale-ai-os-status-project-')
    const scaleDir = makeDir('scale-ai-os-status-scale-')

    const empty = createAiOsStatus({ projectDir, scaleDir, lang: 'en' })

    expect(empty.status).toBe('blocked')
    expect(empty.summary).toMatchObject({
      total: 7,
      ready: 0,
      warning: 0,
      blocked: 7,
    })
    expect(empty.checks.map(check => check.id)).toEqual([
      'runtime-dirs',
      'plan-evidence',
      'run-evidence',
      'verification-evidence',
      'dashboard-health',
      'benchmark-evidence',
      'adoption-evidence',
    ])
    expect(empty.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'run-evidence', status: 'blocked' }),
      expect.objectContaining({ id: 'benchmark-evidence', status: 'blocked' }),
    ]))
    expect(empty.nextActions).toEqual(expect.arrayContaining([
      expect.stringContaining('scale ai-os adopt'),
    ]))

    await createAiOsAdoption({
      projectDir,
      scaleDir,
      taskId: 'TASK-AI-OS-STATUS',
      task: 'Adopt AI OS runtime before status check',
      level: 'M',
      files: ['src/runtime/AiOsRuntime.ts'],
      budget: 2400,
      lang: 'en',
    })
    await createAiOsRun({
      projectDir,
      scaleDir,
      taskId: 'TASK-AI-OS-STATUS-GUARDED',
      task: 'Verify status sees guarded evidence',
      level: 'M',
      files: ['src/runtime/AiOsRuntime.ts'],
      mode: 'guarded',
      verificationCommands: ['node -v'],
    })

    const ready = createAiOsStatus({ projectDir, scaleDir, lang: 'en' })

    expect(ready.status).toBe('ready')
    expect(ready.summary.blocked).toBe(0)
    expect(ready.checks.every(check => check.status === 'ready')).toBe(true)
    expect(ready.checks.find(check => check.id === 'verification-evidence')?.evidence).toEqual(expect.arrayContaining([
      expect.stringContaining('TASK-AI-OS-STATUS-GUARDED'),
    ]))
    expect(ready.nextActions).toContain('AI OS closed loop is ready for guarded project work.')
  }, 120_000)
})
