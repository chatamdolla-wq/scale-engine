import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import {
  buildContextPack,
  scanContextBudget,
  type ContextPack as BudgetedContextPack,
} from '../context/ContextBudget.js'
import {
  createGovernanceRoiReport,
  type GovernanceRoiReport,
} from '../governance/GovernanceRoi.js'
import {
  evaluateProgressiveGovernance,
  type GovernanceMode,
  type ProgressiveGovernanceReport,
} from '../governance/ProgressiveGovernance.js'
import type { IKnowledgeBase } from '../knowledge/KnowledgeBase.js'
import {
  MemoryFabric,
  recallMemoryProviders,
  type ContextPack as MemoryContextPack,
  type MemoryProviderRecallItem,
} from '../memory/index.js'
import {
  createSkillPlan,
  loadSkillRoutingPolicy,
  type SkillPlan,
  type SkillTaskLevel,
} from '../skills/routing/index.js'
import { runSafeCommand } from '../tools/SafeCommandRunner.js'
import { SCALE_ENGINE_VERSION } from '../version.js'
import { RuntimeEvidenceLedger } from './RuntimeEvidenceLedger.js'

export interface AiOsRuntimeInput {
  projectDir?: string
  scaleDir?: string
  taskId?: string
  task: string
  level?: SkillTaskLevel | string
  files?: string[]
  services?: string[]
  budget?: number
  requestedMode?: GovernanceMode
  memoryTopK?: number
  knowledgeBase?: Pick<IKnowledgeBase, 'recall' | 'recallByVector'>
}

export type AiOsRunMode = 'dry-run' | 'guarded'
export type AiOsRunStatus = 'ready' | 'blocked'
export type AiOsRunStepKind = 'plan' | 'context' | 'memory' | 'skill' | 'gate' | 'evidence' | 'learning'
export type AiOsRunStepStatus = 'passed' | 'planned' | 'blocked' | 'skipped'

export interface AiOsRunInput extends AiOsRuntimeInput {
  mode?: AiOsRunMode
  verificationCommands?: string[]
  commandTimeoutMs?: number
  allowShell?: boolean
}

export interface AiOsMemoryRuntimeSummary {
  providerOrder: string[]
  selectedProviders: string[]
  fallbackUsed: boolean
  items: MemoryProviderRecallItem[]
  warnings: string[]
  contextPack: MemoryContextPack
}

export interface AiOsAdaptiveWorkflow {
  strategy: 'risk-adaptive-runtime-v1'
  mode: GovernanceMode
  requiredBehaviors: string[]
  gates: string[]
  exitCriteria: string[]
}

export interface AiOsRuntimePlan {
  version: string
  generatedAt: string
  task: {
    taskId?: string
    task: string
    level: SkillTaskLevel
    files: string[]
    services: string[]
  }
  governance: ProgressiveGovernanceReport
  adaptiveWorkflow: AiOsAdaptiveWorkflow
  context: BudgetedContextPack
  memory: AiOsMemoryRuntimeSummary
  skillPlan: SkillPlan
  roi: GovernanceRoiReport
  recommendations: string[]
}

export interface AiOsRunStep {
  id: string
  kind: AiOsRunStepKind
  title: string
  status: AiOsRunStepStatus
  required: boolean
  summary: string
  evidence: string[]
  dependsOn?: string[]
}

export interface AiOsRunFailureLearningCandidate {
  id: string
  source: 'failed-step' | 'missing-evidence'
  title: string
  summary: string
  recommendedAction: 'resolve-before-promotion' | 'record-evidence'
  evidenceRefs: string[]
  promotable: boolean
}

export interface AiOsVerificationCommandReport {
  command: string
  status: 'passed' | 'failed'
  exitCode: number
  stdout: string
  stderr: string
  evidenceId: string
}

export interface AiOsRunReport {
  version: string
  generatedAt: string
  mode: AiOsRunMode
  dryRun: boolean
  status: AiOsRunStatus
  plan: AiOsRuntimePlan
  steps: AiOsRunStep[]
  evidence: {
    required: string[]
    produced: string[]
    pending: string[]
  }
  verification: {
    commands: AiOsVerificationCommandReport[]
    allPassed: boolean
  }
  failureLearning: {
    status: 'idle' | 'candidate-created'
    candidates: AiOsRunFailureLearningCandidate[]
  }
  artifacts: {
    runReport: string
  }
  nextActions: string[]
}

export interface AiOsDashboardInput {
  projectDir?: string
  scaleDir?: string
  limit?: number
}

export interface AiOsDashboardRunSummary {
  taskId?: string
  task: string
  mode: AiOsRunMode
  status: AiOsRunStatus
  generatedAt: string
  runReport: string
  verificationCommands: number
  failedVerificationCommands: number
  pendingEvidence: number
  failureLearningCandidates: number
}

export interface AiOsDashboardReport {
  version: string
  generatedAt: string
  runsDir: string
  summary: {
    totalRuns: number
    readyRuns: number
    blockedRuns: number
    dryRunRuns: number
    guardedRuns: number
    verificationCommands: number
    failedVerificationCommands: number
    pendingEvidence: number
    failureLearningCandidates: number
  }
  health: {
    status: 'empty' | 'healthy' | 'attention' | 'blocked'
    score: number
    reasons: string[]
  }
  latestRuns: AiOsDashboardRunSummary[]
  recommendations: string[]
  warnings: string[]
}

export interface AiOsBenchmarkInput {
  projectDir?: string
  scaleDir?: string
  budget?: number
}

export interface AiOsBenchmarkScenarioInput {
  id: string
  task: string
  level: SkillTaskLevel
  files: string[]
  services?: string[]
  budget?: number
}

export interface AiOsBenchmarkScenarioResult {
  id: string
  task: string
  level: SkillTaskLevel
  governanceMode: GovernanceMode
  metrics: {
    estimatedTokens: number
    budget: number
    estimatedTokenSavings: number
    memoryItems: number
    selectedProviders: string[]
    skillSteps: number
    requiredSkillSteps: number
    gates: number
    roiModules: number
  }
}

export interface AiOsBenchmarkReport {
  version: string
  generatedAt: string
  scenarios: AiOsBenchmarkScenarioResult[]
  summary: {
    scenarios: number
    totalEstimatedTokens: number
    totalBudget: number
    totalEstimatedTokenSavings: number
    totalMemoryItems: number
    totalSkillSteps: number
    requiredSkillSteps: number
    governanceModes: GovernanceMode[]
    averageTokenUtilization: number
  }
  dashboard: AiOsDashboardReport
  artifacts: {
    benchmarkReport: string
  }
  recommendations: string[]
}

export interface AiOsMigrationInput {
  projectDir?: string
  scaleDir?: string
}

export interface AiOsMigrationReport {
  version: string
  generatedAt: string
  status: 'migrated' | 'compatible'
  scaleRoot: string
  created: string[]
  existing: string[]
  files: {
    migrationReport: string
  }
  warnings: string[]
  nextActions: string[]
}

export interface AiOsDoctorInput {
  projectDir?: string
  scaleDir?: string
  benchmarkMaxAgeHours?: number
  lang?: 'zh' | 'en'
}

export type AiOsDoctorStatus = 'ready' | 'warning' | 'blocked'
export type AiOsDoctorCheckStatus = 'passed' | 'warning' | 'blocked'

export interface AiOsDoctorCheck {
  id: string
  title: string
  status: AiOsDoctorCheckStatus
  summary: string
  evidence: string[]
}

export interface AiOsDoctorReport {
  version: string
  generatedAt: string
  status: AiOsDoctorStatus
  projectDir: string
  scaleRoot: string
  dashboard: AiOsDashboardReport
  benchmark: {
    status: 'missing' | 'fresh' | 'stale' | 'invalid'
    reportPath: string
    generatedAt?: string
    ageHours?: number
    scenarios?: number
  }
  checks: AiOsDoctorCheck[]
  summary: {
    totalChecks: number
    passedChecks: number
    warningChecks: number
    blockedChecks: number
  }
  warnings: string[]
  nextActions: string[]
}

export interface AiOsAdoptionInput extends AiOsRuntimeInput {
  benchmarkMaxAgeHours?: number
  lang?: 'zh' | 'en'
}

export type AiOsAdoptionStatus = 'ready' | 'warning' | 'blocked'
export type AiOsAdoptionPhaseStatus = 'passed' | 'warning' | 'blocked'

export interface AiOsAdoptionPhase {
  id: 'migrate' | 'first-run' | 'benchmark' | 'doctor'
  status: AiOsAdoptionPhaseStatus
  summary: string
  evidence: string[]
}

export interface AiOsAdoptionReport {
  version: string
  generatedAt: string
  status: AiOsAdoptionStatus
  projectDir: string
  scaleRoot: string
  phases: AiOsAdoptionPhase[]
  migration: AiOsMigrationReport
  run: AiOsRunReport
  benchmark: AiOsBenchmarkReport
  doctor: AiOsDoctorReport
  artifacts: {
    migrationReport: string
    runReport: string
    benchmarkReport: string
    adoptionReport: string
  }
  warnings: string[]
  nextActions: string[]
}

export async function createAiOsPlan(input: AiOsRuntimeInput): Promise<AiOsRuntimePlan> {
  const projectDir = resolve(input.projectDir ?? process.cwd())
  const scaleDir = input.scaleDir ?? '.scale'
  const level = normalizeSkillTaskLevel(input.level)
  const files = input.files ?? []
  const services = input.services ?? []
  const taskId = input.taskId
  const budget = input.budget ?? 8_000

  const governance = evaluateProgressiveGovernance({
    task: input.task,
    changedFiles: files,
    requestedMode: input.requestedMode,
  })
  const contextBudget = scanContextBudget({ projectDir, scaleDir, maxTaskTokens: budget })
  const context = buildContextPack({
    projectDir,
    scaleDir,
    task: input.task,
    taskId,
    level,
    files,
    budget,
  })
  const memoryRecall = await recallMemoryProviders({
    projectDir,
    scaleDir,
    query: [input.task, files.join(' ')].filter(Boolean).join('\n'),
    task: input.task,
    files,
    limit: input.memoryTopK ?? 5,
  })
  const memoryPack = await new MemoryFabric({
    projectDir,
    scaleDir,
    knowledgeBase: input.knowledgeBase,
  }).createContextPack({
    task: input.task,
    taskId,
    level,
    files,
    budgetTokens: Math.max(1, Math.floor(budget / 2)),
    knowledgeTopK: input.memoryTopK,
  })
  const skillPolicy = loadSkillRoutingPolicy(projectDir, scaleDir)
  const skillPlan = createSkillPlan({
    taskId: taskId ?? `AIOS-${Date.now()}`,
    taskName: input.task,
    description: input.task,
    level,
    files,
    services,
    policy: skillPolicy,
  })
  const adaptiveWorkflow = createAdaptiveWorkflow(governance, skillPlan)
  const roi = createGovernanceRoiReport({
    taskId,
    contextBudget,
    contextPack: context,
    governance,
    memoryRecall,
    skillPlan,
  })

  return {
    version: SCALE_ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    task: {
      taskId,
      task: input.task,
      level,
      files,
      services,
    },
    governance,
    adaptiveWorkflow,
    context,
    memory: {
      providerOrder: memoryRecall.providerOrder,
      selectedProviders: memoryRecall.selectedProviders,
      fallbackUsed: memoryRecall.fallbackUsed,
      items: memoryRecall.items,
      warnings: memoryRecall.warnings,
      contextPack: memoryPack,
    },
    skillPlan,
    roi,
    recommendations: recommendations({ governance, context, memoryRecall, skillPlan }),
  }
}

export async function createAiOsRun(input: AiOsRunInput): Promise<AiOsRunReport> {
  const projectDir = resolve(input.projectDir ?? process.cwd())
  const scaleDir = input.scaleDir ?? '.scale'
  const mode = input.mode ?? 'dry-run'
  const plan = await createAiOsPlan({ ...input, projectDir, scaleDir })
  const generatedAt = new Date().toISOString()
  const runReportPath = resolveRunReportPath(projectDir, scaleDir, plan.task.taskId ?? `AIOS-RUN-${Date.now()}`)
  const steps = buildRunSteps(plan)
  const verification = await runGuardedVerification({
    projectDir,
    scaleDir,
    plan,
    steps,
    commands: input.verificationCommands ?? [],
    timeout: input.commandTimeoutMs,
    allowShell: input.allowShell,
    enabled: mode === 'guarded',
  })
  const failureCandidates = buildFailureLearningCandidates(plan, steps)
  const evidence = summarizeRunEvidence(steps)
  const status: AiOsRunStatus = steps.some(step => step.status === 'blocked') ? 'blocked' : 'ready'
  const report: AiOsRunReport = {
    version: SCALE_ENGINE_VERSION,
    generatedAt,
    mode,
    dryRun: mode === 'dry-run',
    status,
    plan,
    steps,
    evidence,
    verification,
    failureLearning: {
      status: failureCandidates.length > 0 ? 'candidate-created' : 'idle',
      candidates: failureCandidates,
    },
    artifacts: {
      runReport: runReportPath,
    },
    nextActions: buildRunNextActions(steps, mode),
  }
  writeAiOsRunReport(runReportPath, report)
  return report
}

export function createAiOsDashboard(input: AiOsDashboardInput = {}): AiOsDashboardReport {
  const projectDir = resolve(input.projectDir ?? process.cwd())
  const scaleDir = input.scaleDir ?? '.scale'
  const runsDir = resolveRunsDir(projectDir, scaleDir)
  const warnings: string[] = []
  const reports = readAiOsRunReports(runsDir, warnings)
  const latestRuns = reports
    .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt))
    .slice(0, input.limit ?? 10)
    .map(toDashboardRunSummary)
  const summary = {
    totalRuns: reports.length,
    readyRuns: reports.filter(report => report.status === 'ready').length,
    blockedRuns: reports.filter(report => report.status === 'blocked').length,
    dryRunRuns: reports.filter(report => report.mode === 'dry-run').length,
    guardedRuns: reports.filter(report => report.mode === 'guarded').length,
    verificationCommands: reports.reduce((sum, report) => sum + report.verification.commands.length, 0),
    failedVerificationCommands: reports.reduce((sum, report) => sum + report.verification.commands.filter(command => command.status === 'failed').length, 0),
    pendingEvidence: reports.reduce((sum, report) => sum + report.evidence.pending.length, 0),
    failureLearningCandidates: reports.reduce((sum, report) => sum + report.failureLearning.candidates.length, 0),
  }
  const health = summarizeDashboardHealth(summary)
  return {
    version: SCALE_ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    runsDir,
    summary,
    health,
    latestRuns,
    recommendations: dashboardRecommendations(summary),
    warnings,
  }
}

export async function createAiOsBenchmark(input: AiOsBenchmarkInput = {}): Promise<AiOsBenchmarkReport> {
  const projectDir = resolve(input.projectDir ?? process.cwd())
  const scaleDir = input.scaleDir ?? '.scale'
  const scenarios = defaultBenchmarkScenarios(input.budget)
  const results: AiOsBenchmarkScenarioResult[] = []

  for (const scenario of scenarios) {
    const plan = await createAiOsPlan({
      projectDir,
      scaleDir,
      taskId: `BENCH-${scenario.id}`,
      task: scenario.task,
      level: scenario.level,
      files: scenario.files,
      services: scenario.services,
      budget: scenario.budget,
    })
    results.push({
      id: scenario.id,
      task: scenario.task,
      level: scenario.level,
      governanceMode: plan.governance.effectiveMode,
      metrics: {
        estimatedTokens: plan.context.totalEstimatedTokens,
        budget: plan.context.task.budget,
        estimatedTokenSavings: plan.context.compiler?.estimatedTokenSavings ?? 0,
        memoryItems: plan.memory.items.length,
        selectedProviders: plan.memory.selectedProviders,
        skillSteps: plan.skillPlan.executionPlan.steps.length,
        requiredSkillSteps: plan.skillPlan.executionPlan.steps.filter(step => step.required).length,
        gates: plan.adaptiveWorkflow.gates.length,
        roiModules: plan.roi.modules.length,
      },
    })
  }

  const summary = summarizeBenchmark(results)
  const generatedAt = new Date().toISOString()
  const benchmarkReport = resolveBenchmarkReportPath(projectDir, scaleDir)
  const report: AiOsBenchmarkReport = {
    version: SCALE_ENGINE_VERSION,
    generatedAt,
    scenarios: results,
    summary,
    dashboard: createAiOsDashboard({ projectDir, scaleDir }),
    artifacts: {
      benchmarkReport,
    },
    recommendations: benchmarkRecommendations(summary),
  }
  writeAiOsBenchmarkReport(benchmarkReport, report)
  return report
}

export function createAiOsMigration(input: AiOsMigrationInput = {}): AiOsMigrationReport {
  const projectDir = resolve(input.projectDir ?? process.cwd())
  const scaleDir = input.scaleDir ?? '.scale'
  const scaleRoot = isAbsolute(scaleDir) ? scaleDir : join(projectDir, scaleDir)
  const requiredDirs = [
    join(scaleRoot, 'ai-os'),
    join(scaleRoot, 'ai-os', 'runs'),
    join(scaleRoot, 'ai-os', 'benchmarks'),
    join(scaleRoot, 'ai-os', 'migrations'),
  ]
  const created: string[] = []
  const existing: string[] = []
  for (const dir of requiredDirs) {
    if (existsSync(dir)) {
      existing.push(normalizeProjectPath(projectDir, dir))
      continue
    }
    mkdirSync(dir, { recursive: true })
    created.push(normalizeProjectPath(projectDir, dir))
  }
  const migrationReport = join(scaleRoot, 'ai-os', 'migrations', 'migration.json')
  const report: AiOsMigrationReport = {
    version: SCALE_ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    status: created.length > 0 ? 'migrated' : 'compatible',
    scaleRoot,
    created,
    existing,
    files: {
      migrationReport,
    },
    warnings: [],
    nextActions: created.length > 0
      ? ['Run `scale ai-os run --dry-run --json` to create the first AI OS runtime report.']
      : ['AI OS runtime directories are compatible; continue with run, dashboard, or benchmark commands.'],
  }
  writeFileSync(migrationReport, JSON.stringify(report, null, 2), 'utf-8')
  return report
}

export function createAiOsDoctor(input: AiOsDoctorInput = {}): AiOsDoctorReport {
  const projectDir = resolve(input.projectDir ?? process.cwd())
  const scaleDir = input.scaleDir ?? '.scale'
  const scaleRoot = resolveScaleRoot(projectDir, scaleDir)
  const benchmarkMaxAgeHours = input.benchmarkMaxAgeHours ?? 24
  const lang = input.lang ?? 'en'
  const warnings: string[] = []
  const dashboard = createAiOsDashboard({ projectDir, scaleDir })
  const benchmark = inspectBenchmarkReport(projectDir, scaleDir, benchmarkMaxAgeHours, warnings)
  const requiredDirs = [
    join(scaleRoot, 'ai-os'),
    join(scaleRoot, 'ai-os', 'runs'),
    join(scaleRoot, 'ai-os', 'benchmarks'),
    join(scaleRoot, 'ai-os', 'migrations'),
  ]
  const missingDirs = requiredDirs.filter(dir => !existsSync(dir)).map(dir => normalizeProjectPath(projectDir, dir))
  const checks: AiOsDoctorCheck[] = [
    {
      id: 'ai-os-runtime-dirs',
      title: 'AI OS runtime directories',
      status: missingDirs.length === 0 ? 'passed' : 'blocked',
      summary: missingDirs.length === 0
        ? 'Required AI OS runtime directories exist.'
        : `Missing AI OS runtime directories: ${missingDirs.join(', ')}.`,
      evidence: missingDirs.length === 0 ? requiredDirs.map(dir => normalizeProjectPath(projectDir, dir)) : missingDirs,
    },
    {
      id: 'ai-os-run-history',
      title: 'AI OS run history',
      status: dashboard.summary.totalRuns > 0 ? 'passed' : 'warning',
      summary: dashboard.summary.totalRuns > 0
        ? `${dashboard.summary.totalRuns} run report(s), ${dashboard.summary.guardedRuns} guarded.`
        : 'No AI OS run reports found yet.',
      evidence: dashboard.latestRuns.map(run => run.runReport),
    },
    {
      id: 'ai-os-dashboard-health',
      title: 'AI OS dashboard health',
      status: dashboard.health.status === 'blocked'
        ? 'blocked'
        : dashboard.health.status === 'healthy' ? 'passed' : 'warning',
      summary: `${dashboard.health.status} (${dashboard.health.score}): ${dashboard.health.reasons.join('; ')}`,
      evidence: dashboard.health.reasons,
    },
    {
      id: 'ai-os-benchmark',
      title: 'AI OS benchmark evidence',
      status: benchmark.status === 'fresh' ? 'passed' : benchmark.status === 'invalid' ? 'blocked' : 'warning',
      summary: summarizeBenchmarkDoctor(benchmark),
      evidence: [benchmark.reportPath],
    },
  ]
  const summary = {
    totalChecks: checks.length,
    passedChecks: checks.filter(check => check.status === 'passed').length,
    warningChecks: checks.filter(check => check.status === 'warning').length,
    blockedChecks: checks.filter(check => check.status === 'blocked').length,
  }
  const status: AiOsDoctorStatus = summary.blockedChecks > 0
    ? 'blocked'
    : summary.warningChecks > 0 ? 'warning' : 'ready'

  return {
    version: SCALE_ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    status,
    projectDir,
    scaleRoot,
    dashboard,
    benchmark,
    checks,
    summary,
    warnings: [...warnings, ...dashboard.warnings],
    nextActions: aiOsDoctorNextActions({ status, checks, dashboard, benchmark, lang }),
  }
}

export async function createAiOsAdoption(input: AiOsAdoptionInput): Promise<AiOsAdoptionReport> {
  const projectDir = resolve(input.projectDir ?? process.cwd())
  const scaleDir = input.scaleDir ?? '.scale'
  const scaleRoot = resolveScaleRoot(projectDir, scaleDir)
  const generatedAt = new Date().toISOString()
  const migration = createAiOsMigration({ projectDir, scaleDir })
  const run = await createAiOsRun({
    ...input,
    projectDir,
    scaleDir,
    taskId: input.taskId ?? `AIOS-ADOPT-${Date.now()}`,
    mode: 'dry-run',
  })
  const benchmark = await createAiOsBenchmark({
    projectDir,
    scaleDir,
    budget: input.budget,
  })
  const doctor = createAiOsDoctor({
    projectDir,
    scaleDir,
    benchmarkMaxAgeHours: input.benchmarkMaxAgeHours,
    lang: input.lang,
  })
  const phases: AiOsAdoptionPhase[] = [
    {
      id: 'migrate',
      status: migration.status === 'migrated' || migration.status === 'compatible' ? 'passed' : 'blocked',
      summary: migration.status === 'migrated'
        ? `Created ${migration.created.length} AI OS runtime path(s).`
        : 'AI OS runtime paths were already compatible.',
      evidence: [migration.files.migrationReport, ...migration.created, ...migration.existing],
    },
    {
      id: 'first-run',
      status: run.status === 'ready' ? 'passed' : 'blocked',
      summary: `Created first ${run.mode} AI OS run report with ${run.steps.length} step(s).`,
      evidence: [run.artifacts.runReport, ...run.evidence.produced],
    },
    {
      id: 'benchmark',
      status: benchmark.summary.scenarios > 0 ? 'passed' : 'blocked',
      summary: `Created AI OS benchmark report with ${benchmark.summary.scenarios} scenario(s).`,
      evidence: [benchmark.artifacts.benchmarkReport],
    },
    {
      id: 'doctor',
      status: doctor.status === 'ready' ? 'passed' : doctor.status === 'warning' ? 'warning' : 'blocked',
      summary: `AI OS doctor status is ${doctor.status}: ${doctor.summary.passedChecks}/${doctor.summary.totalChecks} checks passed.`,
      evidence: doctor.checks.flatMap(check => check.evidence),
    },
  ]
  const status: AiOsAdoptionStatus = phases.some(phase => phase.status === 'blocked')
    ? 'blocked'
    : phases.some(phase => phase.status === 'warning') ? 'warning' : 'ready'
  const adoptionReport = resolveAdoptionReportPath(projectDir, scaleDir)
  const report: AiOsAdoptionReport = {
    version: SCALE_ENGINE_VERSION,
    generatedAt,
    status,
    projectDir,
    scaleRoot,
    phases,
    migration,
    run,
    benchmark,
    doctor,
    artifacts: {
      migrationReport: migration.files.migrationReport,
      runReport: run.artifacts.runReport,
      benchmarkReport: benchmark.artifacts.benchmarkReport,
      adoptionReport,
    },
    warnings: [...migration.warnings, ...doctor.warnings],
    nextActions: aiOsAdoptionNextActions(status, input.lang ?? 'en'),
  }
  writeFileSync(adoptionReport, JSON.stringify(report, null, 2), 'utf-8')
  return report
}

function buildRunSteps(plan: AiOsRuntimePlan): AiOsRunStep[] {
  const steps = new Map<string, AiOsRunStep>()
  const upsert = (step: AiOsRunStep) => steps.set(step.id, step)

  upsert({
    id: 'runtime-plan',
    kind: 'plan',
    title: 'Create unified AI OS runtime plan',
    status: 'passed',
    required: true,
    summary: `Governance mode ${plan.governance.effectiveMode}; ${plan.skillPlan.executionPlan.steps.length} skill step(s).`,
    evidence: ['governance', 'context', 'memory', 'skillPlan', 'roi'],
  })
  upsert({
    id: 'context-compiler',
    kind: 'context',
    title: 'Compile task context',
    status: 'passed',
    required: true,
    summary: `${plan.context.totalEstimatedTokens}/${plan.context.task.budget} estimated tokens; saved ${plan.context.compiler?.estimatedTokenSavings ?? 0}.`,
    evidence: ['context.compiler', 'context.includedSections', 'context.omittedSections'],
    dependsOn: ['runtime-plan'],
  })
  upsert({
    id: 'memory-provider-recall',
    kind: 'memory',
    title: 'Recall provider-backed memory',
    status: 'passed',
    required: true,
    summary: `${plan.memory.items.length} recalled item(s); providers ${plan.memory.providerOrder.join(' -> ')}.`,
    evidence: ['memory.providerOrder', 'memory.selectedProviders', 'memory.items'],
    dependsOn: ['runtime-plan'],
  })

  for (const gate of plan.adaptiveWorkflow.gates) {
    if (steps.has(gate)) continue
    upsert({
      id: gate,
      kind: gate === 'runtime-evidence' ? 'evidence' : 'gate',
      title: `Satisfy ${gate} gate`,
      status: 'planned',
      required: true,
      summary: `Required by ${plan.adaptiveWorkflow.strategy} in ${plan.adaptiveWorkflow.mode} mode.`,
      evidence: [`gate.${gate}`],
      dependsOn: ['runtime-plan'],
    })
  }

  for (const skillStep of plan.skillPlan.executionPlan.steps) {
    upsert({
      id: `skill:${skillStep.id}`,
      kind: 'skill',
      title: `${skillStep.kind}: ${skillStep.id}`,
      status: 'planned',
      required: skillStep.required,
      summary: `${skillStep.reason} Fallback: ${skillStep.fallback}.`,
      evidence: [skillStep.evidenceRequired],
      dependsOn: ['skill-evidence'],
    })
  }

  upsert({
    id: 'failure-learning',
    kind: 'learning',
    title: 'Prepare failure learning settlement',
    status: 'planned',
    required: false,
    summary: 'Create lesson or rule candidates only when a gate, verification step, or evidence requirement fails.',
    evidence: ['failureLearning.candidates'],
    dependsOn: ['runtime-evidence'],
  })

  return [...steps.values()]
}

async function runGuardedVerification(options: {
  projectDir: string
  scaleDir: string
  plan: AiOsRuntimePlan
  steps: AiOsRunStep[]
  commands: string[]
  timeout?: number
  allowShell?: boolean
  enabled: boolean
}): Promise<AiOsRunReport['verification']> {
  if (!options.enabled || options.commands.length === 0) {
    return { commands: [], allPassed: options.commands.length === 0 }
  }

  const ledger = new RuntimeEvidenceLedger({
    projectDir: options.projectDir,
    scaleDir: options.scaleDir,
  })
  const reports: AiOsVerificationCommandReport[] = []

  for (const [index, command] of options.commands.entries()) {
    const stepId = `verify-command:${index + 1}`
    let result: { exitCode: number; stdout: string; stderr: string }
    try {
      result = await runSafeCommand(command, {
        cwd: options.projectDir,
        timeout: options.timeout ?? 120_000,
        allowShell: options.allowShell,
      })
    } catch (error) {
      result = {
        exitCode: 1,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
      }
    }
    const passed = result.exitCode === 0
    const evidence = ledger.record({
      taskId: options.plan.task.taskId,
      kind: 'command',
      title: `AI OS verification command ${index + 1}`,
      status: passed ? 'passed' : 'failed',
      command,
      exitCode: result.exitCode,
      summary: passed
        ? `Guarded verification command passed: ${command}`
        : `Guarded verification command failed with exit code ${result.exitCode}: ${command}`,
      metadata: {
        aiOsRun: true,
        stepId,
        stdoutPreview: truncate(result.stdout),
        stderrPreview: truncate(result.stderr),
      },
    })
    reports.push({
      command,
      status: passed ? 'passed' : 'failed',
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      evidenceId: evidence.id,
    })
    options.steps.push({
      id: stepId,
      kind: 'evidence',
      title: `Run verification command ${index + 1}`,
      status: passed ? 'passed' : 'blocked',
      required: true,
      summary: passed
        ? `Command passed and runtime evidence was recorded as ${evidence.id}.`
        : `Command failed and runtime evidence was recorded as ${evidence.id}.`,
      evidence: [evidence.id],
      dependsOn: ['runtime-evidence'],
    })
  }

  const runtimeEvidenceStep = options.steps.find(step => step.id === 'runtime-evidence')
  if (runtimeEvidenceStep) {
    const allPassed = reports.every(report => report.status === 'passed')
    runtimeEvidenceStep.status = allPassed ? 'passed' : 'blocked'
    runtimeEvidenceStep.summary = allPassed
      ? `${reports.length} guarded verification command(s) passed and were recorded as runtime evidence.`
      : `${reports.filter(report => report.status === 'failed').length}/${reports.length} guarded verification command(s) failed.`
    runtimeEvidenceStep.evidence = reports.map(report => report.evidenceId)
  }

  return {
    commands: reports,
    allPassed: reports.every(report => report.status === 'passed'),
  }
}

function summarizeRunEvidence(steps: AiOsRunStep[]): AiOsRunReport['evidence'] {
  const required = new Set<string>()
  const produced = new Set<string>()
  const pending = new Set<string>()
  for (const step of steps) {
    if (step.required) {
      for (const item of evidenceCategory(step)) required.add(item)
    }
    if (step.status === 'passed') {
      for (const item of evidenceCategory(step)) produced.add(item)
    } else if (step.required && step.status === 'planned') {
      for (const item of evidenceCategory(step)) pending.add(item)
    }
  }
  return {
    required: [...required],
    produced: [...produced],
    pending: [...pending],
  }
}

function evidenceCategory(step: AiOsRunStep): string[] {
  if (step.id === 'runtime-plan') return ['ai-os-plan']
  if (step.id === 'context-compiler') return ['context-compiler']
  if (step.id === 'memory-provider-recall') return ['memory-provider-recall']
  if (step.id === 'skill-evidence' || step.kind === 'skill') return ['skill-routing-engine']
  if (step.id === 'runtime-evidence' || step.kind === 'evidence') return ['runtime-evidence']
  if (step.kind === 'gate') return [`gate:${step.id}`]
  return [step.id]
}

function buildFailureLearningCandidates(
  plan: AiOsRuntimePlan,
  steps: AiOsRunStep[],
): AiOsRunFailureLearningCandidate[] {
  const hasBlockedVerification = steps.some(step => step.status === 'blocked' && step.id.startsWith('verify-command:'))
  const failed = steps.filter(step => step.status === 'blocked' && !(hasBlockedVerification && step.id === 'runtime-evidence'))
  return failed.map(step => ({
    id: `AIO-FLC-${safePathSegment(plan.task.taskId ?? step.id)}-${safePathSegment(step.id)}`,
    source: 'failed-step',
    title: `Failure learning candidate: ${step.title}`,
    summary: step.summary,
    recommendedAction: 'resolve-before-promotion',
    evidenceRefs: step.evidence,
    promotable: false,
  }))
}

function buildRunNextActions(steps: AiOsRunStep[], mode: AiOsRunMode): string[] {
  const actions: string[] = []
  for (const step of steps) {
    if (step.status !== 'planned' || !step.required) continue
    if (step.kind === 'skill') actions.push(`Execute required skill step "${step.title}" and attach evidence: ${step.evidence.join(', ')}.`)
    else if (step.kind === 'evidence') actions.push(`Record runtime evidence for "${step.id}" before claiming completion.`)
    else if (step.kind === 'gate') actions.push(`Satisfy gate "${step.id}" before ship.`)
  }
  if (mode === 'dry-run') actions.push('Re-run with guarded execution only after reviewing the dry-run report.')
  return actions
}

function resolveRunReportPath(projectDir: string, scaleDir: string, taskId: string): string {
  return join(resolveRunsDir(projectDir, scaleDir), `${safePathSegment(taskId)}.json`)
}

function writeAiOsRunReport(path: string, report: AiOsRunReport): void {
  const dir = dirname(path)
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(path, JSON.stringify(report, null, 2), 'utf-8')
}

function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120) || 'ai-os-run'
}

function truncate(value: string, max = 1000): string {
  return value.length > max ? `${value.slice(0, max)}...` : value
}

function normalizeProjectPath(projectDir: string, path: string): string {
  const normalizedProject = resolve(projectDir)
  const normalizedPath = resolve(path)
  if (normalizedPath.startsWith(normalizedProject)) {
    return normalizedPath.slice(normalizedProject.length + 1).replace(/\\/g, '/')
  }
  return normalizedPath.replace(/\\/g, '/')
}

function resolveScaleRoot(projectDir: string, scaleDir: string): string {
  return isAbsolute(scaleDir) ? scaleDir : join(projectDir, scaleDir)
}

function resolveRunsDir(projectDir: string, scaleDir: string): string {
  return join(resolveScaleRoot(projectDir, scaleDir), 'ai-os', 'runs')
}

function resolveBenchmarkReportPath(projectDir: string, scaleDir: string): string {
  return join(resolveScaleRoot(projectDir, scaleDir), 'ai-os', 'benchmarks', 'latest.json')
}

function resolveAdoptionReportPath(projectDir: string, scaleDir: string): string {
  return join(resolveScaleRoot(projectDir, scaleDir), 'ai-os', 'adoption.json')
}

function aiOsAdoptionNextActions(status: AiOsAdoptionStatus, lang: 'zh' | 'en'): string[] {
  if (lang === 'zh') {
    if (status === 'ready') return ['AI OS runtime 接入完成；后续真实任务使用 `scale ai-os run --mode guarded`。']
    if (status === 'warning') return ['AI OS runtime 已可用但仍有警告；先运行 `scale ai-os doctor --json --lang zh` 处理剩余项。']
    return ['AI OS runtime 接入被阻断；查看 adoption report 和 `scale ai-os doctor --json --lang zh` 的失败项。']
  }
  if (status === 'ready') return ['AI OS runtime adoption is complete; use `scale ai-os run --mode guarded` for governed work.']
  if (status === 'warning') return ['AI OS runtime is usable with warnings; run `scale ai-os doctor --json --lang en` and resolve remaining items.']
  return ['AI OS runtime adoption is blocked; inspect the adoption report and `scale ai-os doctor --json --lang en` failures.']
}

function inspectBenchmarkReport(
  projectDir: string,
  scaleDir: string,
  maxAgeHours: number,
  warnings: string[],
): AiOsDoctorReport['benchmark'] {
  const reportPath = resolveBenchmarkReportPath(projectDir, scaleDir)
  if (!existsSync(reportPath)) return { status: 'missing', reportPath }
  try {
    const parsed = JSON.parse(readFileSync(reportPath, 'utf-8')) as Partial<AiOsBenchmarkReport>
    if (!parsed.generatedAt || !parsed.summary || typeof parsed.summary.scenarios !== 'number') {
      warnings.push(`Invalid AI OS benchmark report: ${reportPath}`)
      return { status: 'invalid', reportPath }
    }
    const generatedAtMs = Date.parse(parsed.generatedAt)
    const ageHours = Number(((Date.now() - generatedAtMs) / 3_600_000).toFixed(2))
    const fileAgeHours = Number(((Date.now() - statSync(reportPath).mtimeMs) / 3_600_000).toFixed(2))
    const effectiveAgeHours = Number.isFinite(ageHours) ? ageHours : fileAgeHours
    return {
      status: effectiveAgeHours <= maxAgeHours ? 'fresh' : 'stale',
      reportPath,
      generatedAt: parsed.generatedAt,
      ageHours: effectiveAgeHours,
      scenarios: parsed.summary.scenarios,
    }
  } catch (error) {
    warnings.push(`Unreadable AI OS benchmark report: ${reportPath} (${error instanceof Error ? error.message : String(error)})`)
    return { status: 'invalid', reportPath }
  }
}

function summarizeBenchmarkDoctor(benchmark: AiOsDoctorReport['benchmark']): string {
  if (benchmark.status === 'missing') return 'No AI OS benchmark report found.'
  if (benchmark.status === 'invalid') return 'AI OS benchmark report is invalid or unreadable.'
  const age = benchmark.ageHours === undefined ? 'unknown age' : `${benchmark.ageHours}h old`
  return `${benchmark.scenarios ?? 0} benchmark scenario(s); ${age}; status ${benchmark.status}.`
}

function aiOsDoctorNextActions(input: {
  status: AiOsDoctorStatus
  checks: AiOsDoctorCheck[]
  dashboard: AiOsDashboardReport
  benchmark: AiOsDoctorReport['benchmark']
  lang: 'zh' | 'en'
}): string[] {
  if (input.lang === 'zh') return aiOsDoctorNextActionsZh(input)
  return aiOsDoctorNextActionsEn(input)
}

function aiOsDoctorNextActionsEn(input: {
  status: AiOsDoctorStatus
  checks: AiOsDoctorCheck[]
  dashboard: AiOsDashboardReport
  benchmark: AiOsDoctorReport['benchmark']
}): string[] {
  const actions: string[] = []
  if (input.checks.some(check => check.id === 'ai-os-runtime-dirs' && check.status === 'blocked')) {
    actions.push('Run `scale ai-os migrate --json` before using the AI OS beta runtime.')
  }
  if (input.dashboard.summary.totalRuns === 0) {
    actions.push('Run `scale ai-os run --dry-run --json` to create the first AI OS run report.')
  }
  if (input.dashboard.summary.blockedRuns > 0) {
    actions.push('Resolve blocked AI OS runs before claiming the project is ready.')
  }
  if (input.benchmark.status === 'missing' || input.benchmark.status === 'stale') {
    actions.push('Run `scale ai-os benchmark --json` before release or milestone review.')
  }
  if (input.status === 'ready') actions.push('AI OS beta runtime is ready for guarded project tasks.')
  return actions
}

function aiOsDoctorNextActionsZh(input: {
  status: AiOsDoctorStatus
  checks: AiOsDoctorCheck[]
  dashboard: AiOsDashboardReport
  benchmark: AiOsDoctorReport['benchmark']
}): string[] {
  const actions: string[] = []
  if (input.checks.some(check => check.id === 'ai-os-runtime-dirs' && check.status === 'blocked')) {
    actions.push('先运行 `scale ai-os migrate --json`，再接入 AI OS beta runtime。')
  }
  if (input.dashboard.summary.totalRuns === 0) {
    actions.push('运行 `scale ai-os run --dry-run --json` 生成第一份 AI OS 运行报告。')
  }
  if (input.dashboard.summary.blockedRuns > 0) {
    actions.push('先处理 blocked 的 AI OS run，再声明项目运行态就绪。')
  }
  if (input.benchmark.status === 'missing' || input.benchmark.status === 'stale') {
    actions.push('发版或阶段验收前运行 `scale ai-os benchmark --json`。')
  }
  if (input.status === 'ready') actions.push('AI OS beta runtime 已可用于 guarded 项目任务。')
  return actions
}

function writeAiOsBenchmarkReport(path: string, report: AiOsBenchmarkReport): void {
  const dir = dirname(path)
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(path, JSON.stringify(report, null, 2), 'utf-8')
}

function readAiOsRunReports(runsDir: string, warnings: string[]): AiOsRunReport[] {
  if (!existsSync(runsDir)) return []
  return readdirSync(runsDir)
    .filter(file => file.endsWith('.json'))
    .flatMap(file => {
      const path = join(runsDir, file)
      try {
        const parsed = JSON.parse(readFileSync(path, 'utf-8')) as AiOsRunReport
        if (!parsed || !parsed.plan || !parsed.evidence || !parsed.verification) {
          warnings.push(`Ignored invalid AI OS run report: ${path}`)
          return []
        }
        return [parsed]
      } catch (error) {
        warnings.push(`Ignored unreadable AI OS run report: ${path} (${error instanceof Error ? error.message : String(error)})`)
        return []
      }
    })
}

function toDashboardRunSummary(report: AiOsRunReport): AiOsDashboardRunSummary {
  return {
    taskId: report.plan.task.taskId,
    task: report.plan.task.task,
    mode: report.mode,
    status: report.status,
    generatedAt: report.generatedAt,
    runReport: report.artifacts.runReport,
    verificationCommands: report.verification.commands.length,
    failedVerificationCommands: report.verification.commands.filter(command => command.status === 'failed').length,
    pendingEvidence: report.evidence.pending.length,
    failureLearningCandidates: report.failureLearning.candidates.length,
  }
}

function summarizeDashboardHealth(summary: AiOsDashboardReport['summary']): AiOsDashboardReport['health'] {
  if (summary.totalRuns === 0) {
    return { status: 'empty', score: 0, reasons: ['No AI OS run reports found.'] }
  }
  const reasons: string[] = []
  if (summary.blockedRuns > 0) reasons.push(`${summary.blockedRuns} blocked AI OS run(s).`)
  if (summary.failedVerificationCommands > 0) reasons.push(`${summary.failedVerificationCommands} failed guarded verification command(s).`)
  if (summary.failureLearningCandidates > 0) reasons.push(`${summary.failureLearningCandidates} failure learning candidate(s) need review.`)
  const score = Math.max(0, Math.round(((summary.readyRuns / summary.totalRuns) * 100) - (summary.failedVerificationCommands * 10) - (summary.failureLearningCandidates * 5)))
  if (summary.blockedRuns === summary.totalRuns) return { status: 'blocked', score, reasons }
  if (reasons.length > 0) return { status: 'attention', score, reasons }
  return { status: 'healthy', score: 100, reasons: ['All AI OS runs are ready.'] }
}

function dashboardRecommendations(summary: AiOsDashboardReport['summary']): string[] {
  const recommendations: string[] = []
  if (summary.totalRuns === 0) {
    recommendations.push('Run `scale ai-os run --dry-run` to create the first AI OS execution report.')
    return recommendations
  }
  if (summary.blockedRuns > 0) recommendations.push('Resolve blocked AI OS run reports before promoting lessons or shipping.')
  if (summary.failedVerificationCommands > 0) recommendations.push('Inspect failed guarded verification runtime evidence and fix the underlying command or code issue.')
  if (summary.failureLearningCandidates > 0) recommendations.push('Review failure learning candidates before turning them into durable rules.')
  if (summary.guardedRuns === 0) recommendations.push('Add guarded verification runs for at least one representative task to validate evidence flow.')
  return recommendations
}

function defaultBenchmarkScenarios(budget = 8_000): AiOsBenchmarkScenarioInput[] {
  return [
    {
      id: 'docs-governance',
      task: 'Update bilingual governance documentation and keep README, docs map, and strategy aligned',
      level: 'M',
      files: ['README.md', 'README.en.md', 'docs/README.md', 'docs/AI_ENGINEERING_OS_POSITIONING.md'],
      services: ['docs'],
      budget,
    },
    {
      id: 'security-code-change',
      task: 'Harden auth token handling and verify runtime evidence for a security-sensitive code change',
      level: 'L',
      files: ['src/auth/token.ts', 'src/runtime/AiOsRuntime.ts', 'tests/runtime/aiOsRuntime.test.ts'],
      services: ['runtime', 'security'],
      budget,
    },
    {
      id: 'browser-ui-flow',
      task: 'Verify a browser callback UI flow with screenshots, runtime evidence, and guarded workflow gates',
      level: 'L',
      files: ['src/ui/callback.tsx', 'tests/api/aiOsCli.test.ts'],
      services: ['ui', 'browser'],
      budget,
    },
  ]
}

function summarizeBenchmark(results: AiOsBenchmarkScenarioResult[]): AiOsBenchmarkReport['summary'] {
  const totalBudget = results.reduce((sum, result) => sum + result.metrics.budget, 0)
  const totalEstimatedTokens = results.reduce((sum, result) => sum + result.metrics.estimatedTokens, 0)
  return {
    scenarios: results.length,
    totalEstimatedTokens,
    totalBudget,
    totalEstimatedTokenSavings: results.reduce((sum, result) => sum + result.metrics.estimatedTokenSavings, 0),
    totalMemoryItems: results.reduce((sum, result) => sum + result.metrics.memoryItems, 0),
    totalSkillSteps: results.reduce((sum, result) => sum + result.metrics.skillSteps, 0),
    requiredSkillSteps: results.reduce((sum, result) => sum + result.metrics.requiredSkillSteps, 0),
    governanceModes: [...new Set(results.map(result => result.governanceMode))],
    averageTokenUtilization: totalBudget > 0 ? Number((totalEstimatedTokens / totalBudget).toFixed(4)) : 0,
  }
}

function benchmarkRecommendations(summary: AiOsBenchmarkReport['summary']): string[] {
  const recommendations = ['Use benchmark deltas in release notes only after comparing the same scenario set across versions.']
  if (summary.totalSkillSteps === 0) recommendations.push('Skill routing did not produce steps; inspect skill policy detection.')
  if (summary.averageTokenUtilization > 0.9) recommendations.push('Context utilization is high; lower budgets or improve relevance filtering before scaling.')
  if (!summary.governanceModes.includes('critical') && !summary.governanceModes.includes('expanded')) {
    recommendations.push('Add at least one high-risk benchmark scenario before claiming adaptive governance coverage.')
  }
  return recommendations
}

function createAdaptiveWorkflow(governance: ProgressiveGovernanceReport, skillPlan: SkillPlan): AiOsAdaptiveWorkflow {
  const gates = new Set<string>()
  gates.add('context-compiler')
  gates.add('memory-provider-recall')
  if (skillPlan.required || skillPlan.executionPlan.steps.length > 0) gates.add('skill-evidence')
  gates.add('runtime-evidence')
  if (governance.effectiveMode === 'expanded' || governance.effectiveMode === 'critical') gates.add('impact-analysis')
  if (governance.effectiveMode === 'critical') gates.add('security-review')
  return {
    strategy: 'risk-adaptive-runtime-v1',
    mode: governance.effectiveMode,
    requiredBehaviors: governance.requiredBehaviors,
    gates: Array.from(gates),
    exitCriteria: [
      'Context compiler explains included and omitted sections.',
      'Memory recall records provider, score, and evidence paths.',
      'Skill plan lists required proof and fallback policy.',
      'Governance ROI states benefit and overhead before completion.',
    ],
  }
}

function recommendations(options: {
  governance: ProgressiveGovernanceReport
  context: BudgetedContextPack
  memoryRecall: Awaited<ReturnType<typeof recallMemoryProviders>>
  skillPlan: SkillPlan
}): string[] {
  const output: string[] = []
  if (options.context.compiler?.estimatedTokenSavings) {
    output.push(`Keep context compiler active; estimated savings ${options.context.compiler.estimatedTokenSavings} tokens for this task pack.`)
  }
  if (options.memoryRecall.items.length === 0) {
    output.push('No memory recall result found; continue with local evidence and settle reusable knowledge after verification.')
  }
  if (options.skillPlan.executionPlan.steps.length > 0) {
    output.push(`Follow ${options.skillPlan.executionPlan.steps.length} skill routing step(s) and record evidence before ship.`)
  }
  if (options.governance.effectiveMode === 'critical') {
    output.push('Critical workflow mode requires security review and rollback or disable strategy.')
  }
  return output
}

function normalizeSkillTaskLevel(value: unknown): SkillTaskLevel {
  const normalized = String(value ?? 'M').trim().toUpperCase()
  if (normalized === 'S' || normalized === 'M' || normalized === 'L' || normalized === 'CRITICAL') return normalized
  throw new Error(`Invalid task level "${String(value)}"; expected S, M, L, or CRITICAL.`)
}
