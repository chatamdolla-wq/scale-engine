#!/usr/bin/env node
// SCALE Engine — CLI 入口 (W6 完整实现)
// 所有 Hook 调用入口: session/gate/create/list/transition/context

import { defineCommand, runMain } from 'citty'
import { EventBus } from '../core/eventBus.js'
import { SQLiteArtifactStore } from '../artifact/sqliteStore.js'
import { FSM } from '../artifact/fsm.js'
import { registerAllFSMs, INITIAL_STATES } from '../artifact/fsmDefinitions.js'
import type { TaskPayload } from '../artifact/types.js'
import { Gateway } from '../guardrails/Gateway.js'
import { BruteRetryDetector, PrematureDoneDetector, BlameShiftDetector } from '../guardrails/detectors.js'
import { DangerousCommandDetector, SecretLeakDetector, RoleGateDetector, ScopeCreepDetector, BUILT_IN_ROLES } from '../guardrails/advancedDetectors.js'
import { SQLiteKnowledgeBase } from '../knowledge/SQLiteKnowledgeBase.js'
import { ContextBuilder } from '../context/ContextBuilder.js'
import { FSMAgentBridge, type FSMContextSnapshot } from '../fsm/FSMAgentBridge.js'
import { CapabilityRegistry } from '../capabilities/CapabilityRegistry.js'
import { SkillRegistry } from '../skills/SkillRegistry.js'
import { registerCoreSkills } from '../skills/coreSkills.js'
import { registerExternalSkills } from '../skills/ExternalSkills.js'
import { createSkillPlan, evaluateSkillGate, loadSkillRoutingPolicy, skillPlanMarkdown } from '../skills/routing/index.js'
import { createAdapter, SUPPORTED_AGENTS } from '../adapters/index.js'
import { LessonExtractor, RuleProposer, HookGenerator, EvolutionEngine } from '../evolution/EvolutionEngine.js'
import { Doctor } from './doctor.js'
import { quickStart, detectPlatform } from './quickstart.js'
import { SkillDiscovery } from '../skills/SkillDiscovery.js'
import { inspectRequiredWorkflowSkills, inspectWorkflowSkills } from '../skills/SkillDoctor.js'
import {
  evaluateSkillInstallSafety,
  listSkillRepositoryEntries,
  recommendSkillWorkflow,
  renderSkillRepositoryMarkdown,
} from '../skills/SkillRepository.js'
import { listLeadershipPresets, renderLeadershipPresetsMarkdown } from '../agents/LeadershipPresets.js'
import { listWorkflowPresets, getPresetsByScenario } from '../workflows/presets.js'
import { EvidenceStore } from '../workflow/EvidenceStore.js'
import { OutOfScopeStore } from '../workflow/OutOfScopeStore.js'
import { ReviewStore } from '../workflow/ReviewStore.js'
import { WorkflowEngine } from '../workflow/WorkflowEngine.js'
import {
  resolveVerificationTargets,
  type ResolvedVerificationTargets,
  type VerificationEngineeringStandardsGateMode,
  type VerificationPolicy,
} from '../workflow/VerificationProfile.js'
import { writeGovernanceTemplates, type GovernanceMode } from '../workflow/GovernanceTemplates.js'
import { computeGovernanceDrift } from '../workflow/GovernanceLock.js'
import {
  baselineEngineeringStandards,
  doctorEngineeringStandards,
  scanEngineeringStandards,
  settleEngineeringStandards,
  type EngineeringStandardFinding,
  type EngineeringStandardsSummary,
} from '../workflow/EngineeringStandards.js'
import { doctorResourceAssets, scanResourceAssets, settleResourceAssets } from '../workflow/ResourceGovernance.js'
import {
  analyzeContextGovernance,
  renderContextGrillPrompt,
  writeContextGovernanceTemplates,
} from '../workflow/ContextGovernance.js'
import {
  createDiagnosticLoop,
  renderDiagnosticLoopMarkdown,
  validateDiagnosticLoop,
} from '../workflow/DiagnosticLoop.js'
import {
  createTddSlice,
  evaluateTddSlice,
  renderTddSliceMarkdown,
  type TddCommandEvidence,
} from '../workflow/TddLoop.js'
import { nextWorkflowOpenTask, removeWorkflowOpenTask, toolEvidenceRunCompletesOpenTask } from '../workflow/WorkflowOpenTasks.js'
import { TaskMetricsStore } from '../workflow/TaskMetricsStore.js'
import {
  appendContextGrillArtifact,
  appendDiagnosticLoopArtifact,
  appendTddSliceArtifact,
  checkTaskArtifactCompleteness,
  type TaskArtifactLevel,
} from '../workflow/TaskArtifactScaffolder.js'
import { WorkflowArtifactWriter } from '../workflow/WorkflowArtifactWriter.js'
import { inspectToolCapabilities } from '../tools/ToolCapabilityRegistry.js'
import { evaluateToolEvidenceGate } from '../tools/ToolEvidenceGate.js'
import { ToolEvidenceStore } from '../tools/ToolEvidenceStore.js'
import { ToolOrchestrator } from '../tools/ToolOrchestrator.js'
import { loadToolPolicy, toolPolicyTemplate, type ResolvedToolPolicy, type ToolOrchestrationMode } from '../tools/ToolPolicy.js'
import {
  doctorHtmlArtifacts,
  renderHtmlArtifact,
  resolveHtmlArtifactForOpen,
  settleHtmlArtifacts,
} from '../output/HTMLArtifactLayer.js'
import {
  cleanupWorkspaceLifecycle,
  inspectWorkspaceLifecycle,
  type WorkspaceCleanupResult,
  type WorkspaceLifecycleReport,
} from '../workflow/WorkspaceLifecycle.js'
import {
  RuntimeEvidenceLedger,
  SessionLedger,
  doctorRuntimeEvidence,
  evaluateFinalReportReadiness,
  type RuntimeEvidenceKind,
  type RuntimeEvidenceStatus,
  type RuntimeSessionStatus,
} from '../runtime/index.js'
import {
  MemoryFabric,
  doctorMemoryFabric,
  renderContextPackMarkdown,
  renderMemoryLearningCandidateMarkdown,
  settleMemoryLearning,
} from '../memory/index.js'
import {
  resolveWorkspaceTopology,
  workspaceTopologyPath,
  workspaceTopologyTemplate,
  type WorkspaceTopologyKind,
} from '../workflow/WorkspaceTopology.js'
import type { GateResult, GateStage } from '../workflow/types.js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { SCALE_ENGINE_VERSION } from '../version.js'

// ============================================================================
// Engine bootstrap (单例 + lazy init)
// ============================================================================

const SCALE_DIR = process.env.SCALE_DIR ?? '.scale'
const PROJECT_DIR = process.env.SCALE_PROJECT_DIR ?? process.cwd()
const DB_PATH = join(SCALE_DIR, 'scale.db')

function governanceModeFromScenario(scenario: string): GovernanceMode {
  if (scenario === 'critical') return 'critical'
  if (scenario === 'sandbox') return 'minimal'
  return 'standard'
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === '' || value === 'true' || value === '1'
}

function commandEvidence(command: string, exitCode: unknown, summary: unknown): TddCommandEvidence | undefined {
  if (exitCode === undefined || exitCode === null || exitCode === '') return undefined
  const parsed = Number.parseInt(String(exitCode), 10)
  if (Number.isNaN(parsed)) return undefined
  return {
    command,
    exitCode: parsed,
    outputSummary: summary ? String(summary) : `Command exited ${parsed}`,
  }
}

type PreflightProfile = 'quick' | 'full' | 'ci'

function normalizePreflightProfile(value: unknown): PreflightProfile {
  const normalized = String(value ?? 'quick').trim().toLowerCase()
  if (normalized === 'full' || normalized === 'ci') return normalized
  return 'quick'
}

function gatesForPreflightProfile(profile: PreflightProfile): GateStage[] {
  if (profile === 'quick') return ['G3', 'G0', 'G4', 'G5']
  return ['G3', 'G0', 'G4', 'G5', 'G6', 'G7']
}

function shouldSkipPreflightCommandTargets(
  resolved: ResolvedVerificationTargets,
  args: Record<string, unknown>,
): boolean {
  if (!resolved.matrix) return false
  const requestedService = String(args.service ?? '').trim()
  if (requestedService && requestedService !== 'all') return false

  const hasCommandOverrides = [
    args['build-cmd'],
    args['lint-cmd'],
    args['test-cmd'],
    args['coverage-cmd'],
  ].some(value => typeof value === 'string' && value.trim().length > 0)
  if (hasCommandOverrides) return false

  const profile = resolved.matrix.profiles?.[resolved.profileName]
  const hasProfileCommands = Object.values(profile?.commands ?? {})
    .some(value => typeof value === 'string' && value.trim().length > 0)
  const hasServices = (resolved.matrix.services ?? []).length > 0
  return !hasServices && !hasProfileCommands
}

interface EngineeringStandardsGateStatus {
  mode: VerificationEngineeringStandardsGateMode
  checked: boolean
  blocked: boolean
  ok: boolean
  findings: EngineeringStandardFinding[]
  summary?: EngineeringStandardsSummary
  standardsImpactPath?: string
}

function evaluateEngineeringStandardsGate(options: {
  policy: VerificationPolicy
  projectDir?: string
  scaleDir?: string
  taskId?: string
  artifactsDir?: string
  settle?: boolean
}): EngineeringStandardsGateStatus {
  const mode = normalizeEngineeringStandardsGateMode(options.policy.engineeringStandardsGate)
  if (mode === 'off') {
    return {
      mode,
      checked: false,
      blocked: false,
      ok: true,
      findings: [],
    }
  }

  const settlement = options.settle && options.artifactsDir
    ? settleEngineeringStandards({
        projectDir: options.projectDir ?? PROJECT_DIR,
        scaleDir: options.scaleDir ?? SCALE_DIR,
        taskId: options.taskId,
        artifactsDir: options.artifactsDir,
      })
    : undefined
  const doctor = settlement?.doctor ?? doctorEngineeringStandards({
    projectDir: options.projectDir ?? PROJECT_DIR,
    scaleDir: options.scaleDir ?? SCALE_DIR,
  })

  return {
    mode,
    checked: true,
    blocked: mode === 'block' && !doctor.ok,
    ok: doctor.ok,
    findings: doctor.findings,
    summary: doctor.scan.summary,
    standardsImpactPath: settlement?.standardsImpactPath,
  }
}

function normalizeEngineeringStandardsGateMode(value: unknown): VerificationEngineeringStandardsGateMode {
  return value === 'off' || value === 'block' ? value : 'warn'
}

let _engine: ReturnType<typeof createEngine> | null = null

function getEngine() {
  if (!_engine) _engine = createEngine()
  return _engine
}

function createEngine() {
  ensureDir(SCALE_DIR)
  const eventBus = new EventBus({ eventsDir: join(SCALE_DIR, 'events') })
  const store = new SQLiteArtifactStore(eventBus, {
    dbPath: DB_PATH,
    artifactsDir: join(SCALE_DIR, 'artifacts'),
  })
  const fsm = new FSM(store, eventBus)
  registerAllFSMs(fsm)

  const gateway = new Gateway(eventBus)
  const roleGate = new RoleGateDetector()

  // Register all detectors (9 total)
  gateway.registerDetector(new DangerousCommandDetector(), 'preTool')
  gateway.registerDetector(new SecretLeakDetector(), 'preTool')
  gateway.registerDetector(roleGate, 'preTool')
  gateway.registerDetector(new BruteRetryDetector(), 'preTool')
  gateway.registerDetector(new ScopeCreepDetector(), 'preTool')
  gateway.registerDetector(new PrematureDoneDetector(), 'beforeStop')
  gateway.registerDetector(new BlameShiftDetector(), 'postTool')

  const kb = new SQLiteKnowledgeBase(eventBus, { dbPath: join(SCALE_DIR, 'knowledge.db') })
  const ctx = new ContextBuilder(store, kb, eventBus)
  const fsmAgentBridge = new FSMAgentBridge(fsm, store)
  const capabilityRegistry = new CapabilityRegistry(eventBus)
  const skillRegistry = new SkillRegistry(eventBus)
  registerCoreSkills(skillRegistry)
  registerExternalSkills(skillRegistry, eventBus)
  const workflowEngine = new WorkflowEngine({
    eventBus,
    capabilityRegistry,
    skillRegistry,
    scaleDir: SCALE_DIR,
  })

  return { eventBus, store, fsm, gateway, roleGate, kb, ctx, fsmAgentBridge, workflowEngine }
}

function resolveScaleDirForProject(projectDir: string): string {
  return isAbsolute(SCALE_DIR) ? SCALE_DIR : join(projectDir, SCALE_DIR)
}

function createVerificationWorkflowEngine(scaleDir: string): WorkflowEngine {
  ensureDir(scaleDir)
  const eventBus = new EventBus({ eventsDir: join(scaleDir, 'events') })
  const capabilityRegistry = new CapabilityRegistry(eventBus)
  const skillRegistry = new SkillRegistry(eventBus)
  registerCoreSkills(skillRegistry)
  registerExternalSkills(skillRegistry, eventBus)
  return new WorkflowEngine({
    eventBus,
    capabilityRegistry,
    skillRegistry,
    scaleDir,
  })
}

// ============================================================================
// session commands
// ============================================================================

const sessionStart = defineCommand({
  meta: { name: 'start', description: 'Start a new session' },
  args: {
    agent: { type: 'string', default: 'claude-code' },
    'session-id': { type: 'string', required: true },
  },
  async run({ args }) {
    const { eventBus } = getEngine()
    eventBus.emit('session.started', {
      agent: args.agent,
      sessionId: args['session-id'],
      startedAt: Date.now(),
    }, { sessionId: args['session-id'] })
    console.log(JSON.stringify({ ok: true, sessionId: args['session-id'], agent: args.agent }))
  },
})

const sessionEnd = defineCommand({
  meta: { name: 'end', description: 'End current session' },
  args: {
    'session-id': { type: 'string', required: true },
  },
  async run({ args }) {
    const { eventBus } = getEngine()
    eventBus.emit('session.ended', {
      sessionId: args['session-id'],
      endedAt: Date.now(),
    }, { sessionId: args['session-id'] })
    console.log(JSON.stringify({ ok: true, sessionId: args['session-id'] }))
  },
})

const session = defineCommand({
  meta: { name: 'session', description: 'Session lifecycle' },
  subCommands: { start: sessionStart, end: sessionEnd },
})

// ============================================================================
// gate commands (Hook 入口)
// ============================================================================

const gatePreTool = defineCommand({
  meta: { name: 'pre-tool', description: 'Pre-tool gate check' },
  args: {
    tool: { type: 'positional', required: true },
    'args-json': { type: 'string', default: '{}' },
    'session-id': { type: 'string', required: true },
  },
  async run({ args }) {
    const { gateway } = getEngine()
    let toolArgs: Record<string, unknown> = {}
    try { toolArgs = JSON.parse(args['args-json']) } catch { /* empty */ }
    const decision = await gateway.preTool({
      sessionId: args['session-id'],
      tool: args.tool,
      args: toolArgs,
    })
    if (!decision.allow) {
      // 输出到 stderr 让 AI 看到原因
      process.stderr.write(decision.reason ?? 'Blocked by SCALE guardrail')
      if (decision.suggestion) process.stderr.write(`\nSuggestion: ${decision.suggestion}`)
      process.exit(2)
    }
    // 静默通过（不输出 → 不消耗 token）
  },
})

const gatePostTool = defineCommand({
  meta: { name: 'post-tool', description: 'Post-tool event recording' },
  args: {
    tool: { type: 'positional', required: true },
    'args-json': { type: 'string', default: '{}' },
    'output-json': { type: 'string', default: '' },
    'exit-code': { type: 'string', default: '0' },
    'session-id': { type: 'string', required: true },
  },
  async run({ args }) {
    const { gateway } = getEngine()
    let toolArgs: Record<string, unknown> = {}
    try { toolArgs = JSON.parse(args['args-json']) } catch { /* empty */ }
    await gateway.postTool({
      sessionId: args['session-id'],
      tool: args.tool,
      args: toolArgs,
      exitCode: parseInt(args['exit-code'], 10),
      output: args['output-json'],
    })
    // 静默（不消耗 token）
  },
})

const gateBeforeStop = defineCommand({
  meta: { name: 'before-stop', description: 'Before-stop gate check' },
  args: { 'session-id': { type: 'string', required: true } },
  async run({ args }) {
    const { gateway } = getEngine()
    const decision = await gateway.beforeStop({ sessionId: args['session-id'] })
    if (!decision.allow) {
      process.stderr.write(decision.reason ?? 'Cannot stop yet')
      if (decision.suggestion) process.stderr.write(`\nSuggestion: ${decision.suggestion}`)
      process.exit(2)
    }
  },
})

const gate = defineCommand({
  meta: { name: 'gate', description: 'Guardrail gate commands' },
  subCommands: { 'pre-tool': gatePreTool, 'post-tool': gatePostTool, 'before-stop': gateBeforeStop },
})

// ============================================================================
// artifact CRUD
// ============================================================================

const create = defineCommand({
  meta: { name: 'create', description: 'Create an artifact' },
  args: {
    type: { type: 'positional', required: true },
    title: { type: 'positional', required: true },
    parent: { type: 'string' },
    payload: { type: 'string', default: '{}' },
  },
  async run({ args }) {
    const { store } = getEngine()
    let payload: Record<string, unknown> = {}
    try { payload = JSON.parse(args.payload) } catch { /* empty */ }
    const artifact = await store.create({
      type: args.type as never,
      title: args.title,
      payload,
      parents: args.parent ? [args.parent] : [],
      initialStatus: INITIAL_STATES[args.type as keyof typeof INITIAL_STATES] ?? 'DRAFT',
      createdBy: { kind: 'human', userId: process.env.USER ?? 'cli' },
    })
    console.log(JSON.stringify(artifact, null, 2))
  },
})

const list = defineCommand({
  meta: { name: 'list', description: 'List artifacts' },
  args: { type: { type: 'string' }, status: { type: 'string' }, limit: { type: 'string', default: '20' } },
  async run({ args }) {
    const { store } = getEngine()
    const items = await store.query({
      type: args.type as never,
      status: args.status,
      limit: parseInt(args.limit, 10),
    })
    console.log(JSON.stringify(items, null, 2))
  },
})

const show = defineCommand({
  meta: { name: 'show', description: 'Show artifact details' },
  args: { id: { type: 'positional', required: true } },
  async run({ args }) {
    const { store } = getEngine()
    const artifact = await store.get(args.id)
    if (!artifact) {
      console.error(`Artifact not found: ${args.id}`)
      process.exit(1)
    }
    console.log(JSON.stringify(artifact, null, 2))
  },
})

// ============================================================================
// suggest command — 降低用户认知负担
// ============================================================================

const suggest = defineCommand({
  meta: { name: 'suggest', description: 'Show available actions for an artifact' },
  args: {
    id: { type: 'positional', required: true },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const { store, fsm } = getEngine()
    const artifact = await store.get(args.id)
    if (!artifact) {
      console.error(`Artifact not found: ${args.id}`)
      process.exit(1)
    }

    const def = fsm.getDefinition(artifact.type)
    if (!def) {
      console.error(`No FSM registered for type: ${artifact.type}`)
      process.exit(1)
    }

    // 获取当前状态可用的 transitions
    const availableTxs = def.transitions.filter((t) => t.from === artifact.status)

    // 对每个 action 检查 guards
    const suggestions = await Promise.all(
      availableTxs.map(async (tx) => {
        const guardCheck = await fsm.canTransition(args.id, tx.action)
        return {
          action: tx.action,
          to: tx.to,
          guards: (tx.guards ?? []).map((g) => g.name),
          guardMessages: (tx.guards ?? []).map((g) => g.errorMessage),
          canExecute: guardCheck.allowed,
          blockedBy: guardCheck.blockedBy,
        }
      })
    )

    if (args.json) {
      console.log(JSON.stringify({
        id: artifact.id,
        type: artifact.type,
        currentStatus: artifact.status,
        isTerminal: def.terminal.includes(artifact.status as never),
        suggestions,
      }, null, 2))
    } else {
      // 人类友好的输出
      console.log(`\n📊 ${artifact.id} (${artifact.type})`)
      console.log(`   Current status: ${artifact.status}`)
      if (def.terminal.includes(artifact.status as never)) {
        console.log(`   ⚠️  Terminal state — no further transitions available`)
      }
      console.log('')
      console.log('Available actions:')
      console.log('──────────────────────────────────────────────────')

      if (suggestions.length === 0) {
        console.log('  No actions available from this state.')
      } else {
        for (const s of suggestions) {
          const status = s.canExecute ? '✅' : '❌'
          console.log(`  ${status} ${s.action} → ${s.to}`)
          if (s.guards.length > 0) {
            for (const g of s.guardMessages) {
              console.log(`      Guard: ${g}`)
            }
          }
          if (s.blockedBy && s.blockedBy.length > 0) {
            for (const b of s.blockedBy) {
              console.log(`      ❌ ${b.message}`)
            }
          }
        }
      }
      console.log('──────────────────────────────────────────────────')
      console.log('\nUsage: scale transition <id> <action> --reason "..."')
    }
  },
})

// ============================================================================
// create-prd command — 自动创建 Spec+Plan+Tasks 层级
// ============================================================================

const createPRD = defineCommand({
  meta: { name: 'create-prd', description: 'Create PRD hierarchy (Spec → Plan → Tasks)' },
  args: {
    title: { type: 'positional', required: true },
    specs: { type: 'string', description: 'Spec description' },
    plans: { type: 'string', description: 'Plan design' },
    tasks: { type: 'string', description: 'Task list (comma-separated)' },
    'session-id': { type: 'string', required: false },
  },
  async run({ args }) {
    const { store } = getEngine()

    // 1. 创建 Spec
    const spec = await store.create({
      type: 'Spec',
      title: args.title,
      payload: { description: args.specs ?? '', ambiguityScore: 0.3 },
      initialStatus: 'DRAFT',
      createdBy: { kind: 'human', userId: process.env.USER ?? 'cli' },
    })

    // 2. 创建 Plan
    const plan = await store.create({
      type: 'Plan',
      title: `${args.title} - Implementation Plan`,
      payload: { design: args.plans ?? '' },
      parents: [spec.id],
      initialStatus: 'DRAFT',
      createdBy: { kind: 'human', userId: process.env.USER ?? 'cli' },
    })

    // 3. 批量创建 Tasks
    const taskList = (args.tasks ?? '').split(',').map((t) => t.trim()).filter((t) => t.length > 0)
    const tasks: Array<{ id: string; title: string }> = []

    for (const taskTitle of taskList) {
      const task = await store.create({
        type: 'Task',
        title: taskTitle,
        payload: { description: taskTitle, filesInvolved: [], dependsOn: [], requiredRole: 'implementer', requiredCapabilities: [] },
        parents: [plan.id],
        initialStatus: 'TODO',
        createdBy: { kind: 'human', userId: process.env.USER ?? 'cli' },
      })
      tasks.push({ id: task.id, title: task.title })
    }

    // 输出层级树
    console.log('\n✅ PRD hierarchy created:')
    console.log(`\nSpec: ${spec.id} (DRAFT)`)
    console.log(`  └─ Plan: ${plan.id} (DRAFT)`)
    for (const task of tasks) {
      console.log(`      └─ Task: ${task.id} (TODO) - ${task.title}`)
    }
    console.log('\nNext steps:')
    console.log('  1. scale transition spec submit')
    console.log('  2. scale transition spec review')
    console.log('  3. scale transition spec approve (requires ambiguity ≤ 0.2)')
    console.log('  4. scale transition plan approve')
    console.log('  5. scale transition task-* ready (for each task)')
  },
})

// ============================================================================
// FSM transition
// ============================================================================

const transition = defineCommand({
  meta: { name: 'transition', description: 'Transition artifact state' },
  args: {
    id: { type: 'positional', required: true },
    action: { type: 'positional', required: true },
    reason: { type: 'string' },
  },
  async run({ args }) {
    const { fsm } = getEngine()
    const result = await fsm.transition(args.id, args.action, {
      actor: { kind: 'human', userId: process.env.USER ?? 'cli' },
      reason: args.reason,
    })
    console.log(JSON.stringify(result, null, 2))
    if (!result.success) process.exit(1)
  },
})

// ============================================================================
// verify-task command — 代码质量验证（防止虚假完成）
// ============================================================================

const verifyTask = defineCommand({
  meta: { name: 'verify-task', description: 'Verify task code quality (build/lint/test)' },
  args: {
    id: { type: 'positional', required: true },
    'build-cmd': { type: 'string', default: 'npm run build', description: 'Build command' },
    'lint-cmd': { type: 'string', default: 'npm run lint', description: 'Lint command' },
    'test-cmd': { type: 'string', default: 'npm test', description: 'Test command' },
    'skip-build': { type: 'boolean', default: false, description: 'Skip build check' },
    'skip-lint': { type: 'boolean', default: false, description: 'Skip lint check' },
    'skip-test': { type: 'boolean', default: false, description: 'Skip test check' },
    json: { type: 'boolean', default: false, description: 'Output as JSON' },
  },
  async run({ args }) {
    const { store, eventBus } = getEngine()
    const artifact = await store.get(args.id)
    if (!artifact || artifact.type !== 'Task') {
      console.error(`Task not found: ${args.id}`)
      process.exit(1)
    }

    const results = {
      buildStatus: 'pending' as 'pending' | 'success' | 'failed',
      buildExitCode: undefined as number | undefined,
      lintStatus: 'pending' as 'pending' | 'success' | 'failed',
      testPassed: undefined as boolean | undefined,
      testCoverage: undefined as number | undefined,
    }

    // Helper: run command and capture exit code
    const runCmd = async (cmd: string): Promise<{ exitCode: number; output: string }> => {
      const { spawn } = await import('node:child_process')
      return new Promise((resolve) => {
        const child = spawn(cmd, [], { shell: true, stdio: 'pipe' })
        let output = ''
        child.stdout?.on('data', (d) => (output += d))
        child.stderr?.on('data', (d) => (output += d))
        child.on('close', (code) => resolve({ exitCode: code ?? 1, output }))
      })
    }

    // Run build
    if (!args['skip-build']) {
      if (!args.json) console.log('\n🔨 Running build...')
      const build = await runCmd(args['build-cmd'])
      results.buildStatus = build.exitCode === 0 ? 'success' : 'failed'
      results.buildExitCode = build.exitCode
      if (!args.json) {
        if (build.exitCode === 0) {
          console.log('   ✅ Build passed')
        } else {
          console.log('   ❌ Build failed (exit code:', build.exitCode, ')')
          console.log('   Output:', build.output.slice(0, 500))
        }
      }
    }

    // Run lint
    if (!args['skip-lint']) {
      if (!args.json) console.log('\n🔍 Running lint...')
      const lint = await runCmd(args['lint-cmd'])
      results.lintStatus = lint.exitCode === 0 ? 'success' : 'failed'
      if (!args.json) {
        if (lint.exitCode === 0) {
          console.log('   ✅ Lint passed')
        } else {
          console.log('   ❌ Lint failed (exit code:', lint.exitCode, ')')
          console.log('   Output:', lint.output.slice(0, 500))
        }
      }
    }

    // Run tests
    if (!args['skip-test']) {
      if (!args.json) console.log('\n🧪 Running tests...')
      const test = await runCmd(args['test-cmd'])
      results.testPassed = test.exitCode === 0
      // Try to extract coverage from output (Jest format)
      const coverageMatch = test.output.match(/All files[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|\s*(\d+\.?\d*)/)
      if (coverageMatch) results.testCoverage = parseFloat(coverageMatch[1])
      if (!args.json) {
        if (test.exitCode === 0) {
          console.log('   ✅ Tests passed')
          if (results.testCoverage) console.log('   Coverage:', results.testCoverage, '%')
        } else {
          console.log('   ❌ Tests failed (exit code:', test.exitCode, ')')
          console.log('   Output:', test.output.slice(0, 500))
        }
      }
    }

    // Update Task payload
    const currentPayload = artifact.payload as Record<string, unknown>
    const updated = await store.update(args.id, {
      payload: { ...currentPayload, ...results },
    })

    // Emit event
    eventBus.emit('artifact.updated', {
      artifactId: args.id,
      changes: { payload: results },
      reason: 'verify-task',
    }, { sessionId: 'cli' })

    // Output
    if (args.json) {
      console.log(JSON.stringify({ taskId: args.id, results, artifact: updated }, null, 2))
    } else {
      console.log('\n📊 Verification results:')
      console.log('──────────────────────────────────────────────────')
      console.log(`  Build:  ${results.buildStatus === 'success' ? '✅' : results.buildStatus === 'failed' ? '❌' : '⏭️'} ${results.buildStatus}`)
      if (results.buildExitCode !== undefined) console.log(`          Exit code: ${results.buildExitCode}`)
      console.log(`  Lint:   ${results.lintStatus === 'success' ? '✅' : results.lintStatus === 'failed' ? '❌' : '⏭️'} ${results.lintStatus}`)
      console.log(`  Tests:  ${results.testPassed === true ? '✅' : results.testPassed === false ? '❌' : '⏭️'} ${results.testPassed === undefined ? 'skipped' : results.testPassed ? 'passed' : 'failed'}`)
      if (results.testCoverage !== undefined) console.log(`          Coverage: ${results.testCoverage}%`)
      console.log('──────────────────────────────────────────────────')

      const allPassed = (results.buildStatus === 'success' || args['skip-build'])
        && (results.lintStatus === 'success' || args['skip-lint'])
        && (results.testPassed === true || args['skip-test'])

      if (allPassed) {
        console.log('\n✅ All checks passed! Task can now be completed.')
        console.log(`\nNext: scale transition ${args.id} complete --reason "Verified"`)
      } else {
        console.log('\n❌ Some checks failed. Fix issues before completing task.')
        process.exit(1)
      }
    }
  },
})

// ============================================================================
// role management
// ============================================================================

const roleActivate = defineCommand({
  meta: { name: 'activate', description: 'Activate a role' },
  args: { role: { type: 'positional', required: true } },
  async run({ args }) {
    const { roleGate, eventBus } = getEngine()
    const roleDef = BUILT_IN_ROLES[args.role]
    if (!roleDef) {
      console.error(`Unknown role: ${args.role}. Available: ${Object.keys(BUILT_IN_ROLES).join(', ')}`)
      process.exit(1)
    }
    roleGate.setRole(roleDef)
    eventBus.emit('role.activated', { roleId: args.role })
    console.log(JSON.stringify({ ok: true, role: roleDef }))
  },
})

const roleShow = defineCommand({
  meta: { name: 'show', description: 'Show current role' },
  args: {},
  async run() {
    const { roleGate } = getEngine()
    console.log(JSON.stringify(roleGate.getRole(), null, 2))
  },
})

const role = defineCommand({
  meta: { name: 'role', description: 'Role management' },
  subCommands: { activate: roleActivate, show: roleShow },
})

// ============================================================================
// context
// ============================================================================

const contextBuild = defineCommand({
  meta: { name: 'build', description: 'Build context for current task' },
  args: {
    'session-id': { type: 'string', required: true },
    'artifact-id': { type: 'string' },
    role: { type: 'string' },
  },
  async run({ args }) {
    const { ctx } = getEngine()
    const result = await ctx.build({
      sessionId: args['session-id'],
      roleId: args.role,
      currentArtifactId: args['artifact-id'],
    })
    console.log(JSON.stringify(result, null, 2))
  },
})

const contextStatus = defineCommand({
  meta: { name: 'status', description: 'Show session context status' },
  args: {
    'session-id': { type: 'string', required: true },
  },
  async run({ args }) {
    const { ctx, roleGate } = getEngine()
    const status = await ctx.getStatus(args['session-id'], roleGate)
    console.log(JSON.stringify(status, null, 2))
  },
})

const contextInject = defineCommand({
  meta: { name: 'inject', description: 'Inject FSM context for SessionStart hook' },
  args: {
    'session-id': { type: 'string', required: true },
  },
  async run({ args }) {
    const { eventBus, kb, fsmAgentBridge } = getEngine()

    // Get FSM context for all session artifacts
    const fsmContext = await fsmAgentBridge.getSessionContext(args['session-id'], eventBus)

    // Recall relevant lessons based on artifact types
    const artifactTypes = fsmContext.artifacts.map(a => a.artifactType)
    if (artifactTypes.length > 0) {
      const lessons = await kb.recall({ type: 'lesson', limit: 5 })
      fsmContext.recalledLessons = lessons.map(l => `${l.id}: ${l.title} (${l.tags.join(',')})`)
    }

    // Output formatted context for Agent to read
    const output = {
      sessionId: fsmContext.sessionId,
      generatedAt: fsmContext.generatedAt,
      artifacts: fsmContext.artifacts.map(a => ({
        id: a.artifactId,
        type: a.artifactType,
        status: a.currentStatus,
        allowedActions: a.allowedTransitions,
        blocked: a.blockingReasons.length > 0 ? a.blockingReasons : null,
      })),
      lessons: fsmContext.recalledLessons,
      recommendations: fsmContext.recommendations,
      // Human-readable summary
      summary: formatContextSummary(fsmContext),
    }

    console.log(JSON.stringify(output, null, 2))
  },
})

function formatContextSummary(ctx: { artifacts: FSMContextSnapshot[]; recommendations: string[] }): string {
  const lines: string[] = []

  if (ctx.artifacts.length === 0) {
    lines.push('No active artifacts for this session.')
  } else {
    lines.push(`Active artifacts: ${ctx.artifacts.length}`)
    for (const a of ctx.artifacts) {
      const blocked = a.blockingReasons.length > 0 ? ' [BLOCKED]' : ''
      lines.push(`  ${a.artifactId} (${a.artifactType}): ${a.currentStatus}${blocked}`)
    }
  }

  if (ctx.recommendations.length > 0) {
    lines.push('Recommendations:')
    for (const r of ctx.recommendations) {
      lines.push(`  ${r}`)
    }
  }

  return lines.join('\n')
}

const contextGlossary = defineCommand({
  meta: { name: 'glossary', description: 'Show project domain glossary (借鉴 mattpocock/skills CONTEXT.md)' },
  args: {
    json: { type: 'boolean', default: false, description: 'JSON output' },
  },
  run({ args }) {
    const glossaryPath = join(SCALE_DIR, 'GLOSSARY.md')
    if (!existsSync(glossaryPath)) {
      if (args.json) console.log(JSON.stringify({ ok: false, message: 'GLOSSARY.md not found in SCALE_DIR. Run scale init to generate it.' }))
      else console.log('GLOSSARY.md not found. Run scale init to generate it.')
      return
    }
    const content = readFileSync(glossaryPath, 'utf-8')
    // Parse terms: **Term**: definition
    const termMatch = /\*\*(\w[^*]+)\*\*\s*:\s*(.+)/g
    const terms: Record<string, string> = {}
    let m: RegExpExecArray | null
    while ((m = termMatch.exec(content)) !== null) {
      terms[m[1].trim()] = m[2].trim().replace(/_Avoid_/, 'Avoid:')
    }
    // Parse relationships
    const relSection = content.split('## Relationships')[1]?.split('## ')[0] ?? ''
    const relationships = relSection.split('\n').filter((l: string) => l.trim().startsWith('- ')).map((l: string) => l.replace(/^- /, '').trim())

    if (args.json) {
      console.log(JSON.stringify({ ok: true, terms, relationships, count: Object.keys(terms).length }))
    } else {
      console.log('=== SCALE Engine Domain Glossary ===\n')
      console.log(`Terms (${Object.keys(terms).length}):\n`)
      for (const [term, def] of Object.entries(terms)) {
        console.log(`  **${term}**: ${def}`)
      }
      if (relationships.length > 0) {
        console.log(`\nRelationships (${relationships.length}):`)
        for (const rel of relationships) {
          console.log(`  - ${rel}`)
        }
      }
    }
  },
})

const contextInit = defineCommand({
  meta: { name: 'init', description: 'Create CONTEXT.md and CONTEXT-MAP.md starter templates' },
  args: {
    dir: { type: 'string', default: PROJECT_DIR, description: 'Project directory' },
    name: { type: 'string', description: 'Project display name' },
    force: { type: 'boolean', default: false, description: 'Overwrite existing templates' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const result = writeContextGovernanceTemplates({
      projectDir: resolve(String(args.dir ?? PROJECT_DIR)),
      projectName: args.name ? String(args.name) : undefined,
      force: isTruthyFlag(args.force),
    })
    if (args.json) {
      console.log(JSON.stringify(result, null, 2))
      return
    }
    console.log('\nSCALE Context Templates')
    for (const file of result.created) console.log(`  [CREATED] ${file}`)
    for (const file of result.skipped) console.log(`  [SKIPPED] ${file}`)
  },
})

const contextGrill = defineCommand({
  meta: { name: 'grill', description: 'Check project context docs and generate request-specific grill questions' },
  args: {
    dir: { type: 'string', default: PROJECT_DIR, description: 'Project directory' },
    'task-id': { type: 'string', description: 'Task id for workflow state and artifact linkage' },
    task: { type: 'string', required: true, description: 'Task or requirement description' },
    files: { type: 'string', description: 'Comma-separated changed or target files' },
    'artifact-dir': { type: 'string', description: 'Task artifact directory where explore.md should be updated' },
    write: { type: 'boolean', default: false, description: 'Append context grill output to the task explore artifact' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const projectDir = resolve(String(args.dir ?? PROJECT_DIR))
    const taskId = String(args['task-id'] ?? `context-${Date.now()}`)
    const changedFiles = parseCommaList(args.files)
    const report = analyzeContextGovernance({
      projectDir,
      request: String(args.task ?? ''),
      changedFiles,
    })
    const artifactPath = isTruthyFlag(args.write)
      ? appendContextGrillArtifact({
          projectDir,
          artifactsDir: args['artifact-dir'] ? String(args['artifact-dir']) : undefined,
          report,
        }) ?? undefined
      : undefined
    if (args['task-id'] || artifactPath) {
      const writer = new WorkflowArtifactWriter(SCALE_DIR)
      const current = writer.readCurrentState()
      const currentOpenTasks = current?.taskId === taskId ? current.openTasks : []
      writer.updateCurrentState({
        taskId,
        phase: 'explore',
        artifactsDir: args['artifact-dir'] ? String(args['artifact-dir']).replace(/\\/g, '/') : undefined,
        exploredFiles: changedFiles,
        fileCount: changedFiles.length,
        mainContradiction: report.findings[0]?.message ?? 'context governance ready',
        openTasks: removeWorkflowOpenTask(currentOpenTasks, 'context-grill'),
      })
    }
    if (args.json) {
      console.log(JSON.stringify({ ...report, artifactPath }, null, 2))
      return
    }
    console.log(renderContextGrillPrompt(report))
    if (artifactPath) console.log(`\nArtifact: ${artifactPath}`)
  },
})


const context = defineCommand({
  meta: { name: 'context', description: 'Context assembly' },
  subCommands: { build: contextBuild, status: contextStatus, inject: contextInject, glossary: contextGlossary, init: contextInit, grill: contextGrill },
})

// ============================================================================
// diagnose command - evidence-first debugging loop
// ============================================================================

const diagnosePlanCommand = defineCommand({
  meta: { name: 'plan', description: 'Create a reproducible diagnostic loop before fixing a bug' },
  args: {
    'task-id': { type: 'string', required: true },
    symptom: { type: 'string', required: true },
    repro: { type: 'string', description: 'Command that reproduces the current failure' },
    'expected-failure': { type: 'string', description: 'Expected failing behavior or assertion' },
    files: { type: 'string', description: 'Comma-separated changed or suspicious files' },
    verify: { type: 'string', description: 'Comma-separated verification commands after the fix' },
    'artifact-dir': { type: 'string', description: 'Task artifact directory where plan.md should be updated' },
    write: { type: 'boolean', default: false, description: 'Append diagnostic loop output to the task plan artifact' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const changedFiles = parseCommaList(args.files)
    const loop = createDiagnosticLoop({
      taskId: String(args['task-id']),
      symptom: String(args.symptom),
      reproductionCommand: args.repro ? String(args.repro) : undefined,
      expectedFailure: args['expected-failure'] ? String(args['expected-failure']) : undefined,
      changedFiles,
      verificationCommands: parseCommaList(args.verify),
    })
    const validation = validateDiagnosticLoop(loop)
    const artifactPath = isTruthyFlag(args.write)
      ? appendDiagnosticLoopArtifact({
          projectDir: PROJECT_DIR,
          artifactsDir: args['artifact-dir'] ? String(args['artifact-dir']) : undefined,
          loop,
          validation,
        }) ?? undefined
      : undefined
    if (artifactPath || args['artifact-dir']) {
      const writer = new WorkflowArtifactWriter(SCALE_DIR)
      const current = writer.readCurrentState()
      const currentOpenTasks = current?.taskId === loop.taskId ? current.openTasks : []
      writer.updateCurrentState({
        taskId: loop.taskId,
        phase: 'plan',
        artifactsDir: args['artifact-dir'] ? String(args['artifact-dir']).replace(/\\/g, '/') : undefined,
        filesModified: changedFiles,
        openTasks: validation.ready
          ? removeWorkflowOpenTask(currentOpenTasks.filter(task => task.trim().startsWith('scale ')), 'diagnostic-loop')
          : uniqueStrings([
              ...currentOpenTasks,
              ...validation.blockers,
            ]),
      })
    }
    if (args.json) {
      console.log(JSON.stringify({ loop, validation, artifactPath }, null, 2))
      return
    }
    console.log(renderDiagnosticLoopMarkdown(loop))
    if (!validation.ready) {
      console.log('\nBlockers:')
      for (const blocker of validation.blockers) console.log(`  - ${blocker}`)
    }
    if (artifactPath) console.log(`\nArtifact: ${artifactPath}`)
  },
})

const diagnose = defineCommand({
  meta: { name: 'diagnose', description: 'Evidence-first debugging workflows' },
  subCommands: { plan: diagnosePlanCommand },
})

// ============================================================================
// tdd command - vertical slice RED/GREEN/REFACTOR loop
// ============================================================================

const tddSliceCommand = defineCommand({
  meta: { name: 'slice', description: 'Create and evaluate a TDD vertical slice' },
  args: {
    'task-id': { type: 'string', required: true },
    behavior: { type: 'string', required: true },
    'public-interface': { type: 'string', required: true },
    'failing-test': { type: 'string', required: true },
    'test-file': { type: 'string', required: true },
    'impl-files': { type: 'string', required: true },
    'red-exit-code': { type: 'string', description: 'Exit code from the RED command' },
    'red-summary': { type: 'string', description: 'Short RED output summary' },
    'green-exit-code': { type: 'string', description: 'Exit code from the GREEN command' },
    'green-summary': { type: 'string', description: 'Short GREEN output summary' },
    'refactor-exit-code': { type: 'string', description: 'Exit code from the REFACTOR command' },
    'refactor-summary': { type: 'string', description: 'Short REFACTOR output summary' },
    'artifact-dir': { type: 'string', description: 'Task artifact directory where verification.md should be updated' },
    write: { type: 'boolean', default: false, description: 'Append TDD slice output to the task verification artifact' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const failingTest = String(args['failing-test'])
    const slice = createTddSlice({
      taskId: String(args['task-id']),
      behavior: String(args.behavior),
      publicInterface: String(args['public-interface']),
      failingTestCommand: failingTest,
      testFile: String(args['test-file']),
      implementationFiles: parseCommaList(args['impl-files']),
      redEvidence: commandEvidence(failingTest, args['red-exit-code'], args['red-summary']),
      greenEvidence: commandEvidence(failingTest, args['green-exit-code'], args['green-summary']),
      refactorEvidence: commandEvidence(failingTest, args['refactor-exit-code'], args['refactor-summary']),
    })
    const evaluation = evaluateTddSlice(slice)
    const artifactPath = isTruthyFlag(args.write)
      ? appendTddSliceArtifact({
          projectDir: PROJECT_DIR,
          artifactsDir: args['artifact-dir'] ? String(args['artifact-dir']) : undefined,
          slice,
        }) ?? undefined
      : undefined
    let tddStatePath: string | undefined
    if (slice.redEvidence && slice.greenEvidence && slice.refactorEvidence) {
      const writer = new WorkflowArtifactWriter(SCALE_DIR)
      writer.writeTDDEvidence({
        timestamp: new Date().toISOString(),
        taskId: slice.taskId,
        red: slice.redEvidence.exitCode !== 0,
        green: slice.greenEvidence.exitCode === 0,
        refactor: slice.refactorEvidence.exitCode === 0,
        testFirst: slice.redEvidence.exitCode !== 0,
        testFile: slice.testFile,
        implFile: slice.implementationFiles[0] ?? '',
      })
      writer.updateCurrentState({
        taskId: slice.taskId,
        phase: 'verify',
        artifactsDir: args['artifact-dir'] ? String(args['artifact-dir']).replace(/\\/g, '/') : undefined,
        filesModified: slice.implementationFiles,
        openTasks: removeWorkflowOpenTask(writer.readCurrentState()?.openTasks, 'tdd-slice'),
      })
      tddStatePath = join(writer.getStateDir(), `tdd-${slice.taskId}.json`)
    }
    if (args.json) {
      console.log(JSON.stringify({ slice, evaluation, artifactPath, tddStatePath }, null, 2))
      return
    }
    console.log(renderTddSliceMarkdown(slice))
    if (evaluation.blockers.length > 0) {
      console.log('\nBlockers:')
      for (const blocker of evaluation.blockers) console.log(`  - ${blocker}`)
    }
    if (artifactPath) console.log(`\nArtifact: ${artifactPath}`)
    if (tddStatePath) console.log(`TDD state: ${tddStatePath}`)
  },
})

const tdd = defineCommand({
  meta: { name: 'tdd', description: 'TDD vertical slice workflows' },
  subCommands: { slice: tddSliceCommand },
})

// ============================================================================
// stats
// ============================================================================

const stats = defineCommand({
  meta: { name: 'stats', description: 'Show engine stats' },
  args: {},
  async run() {
    const { store, eventBus } = getEngine()
    const s = store.stats()
    const events = await eventBus.query({ limit: 1000 })
    console.log(JSON.stringify({ ...s, eventCount: events.length }, null, 2))
  },
})

const metricsList = defineCommand({
  meta: { name: 'list', description: 'List M/L task workflow metrics' },
  args: {
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const store = new TaskMetricsStore(SCALE_DIR)
    const records = store.list()
    const summary = store.summarize()
    if (args.json) {
      console.log(JSON.stringify({ summary, records }, null, 2))
      return
    }
    console.log('\nWorkflow Metrics')
    console.log(`  Total tasks: ${summary.total}`)
    console.log(`  First-pass verification rate: ${(summary.firstPassRate * 100).toFixed(1)}%`)
    console.log(`  Average fix iterations: ${summary.averageFixIterations.toFixed(2)}`)
    console.log(`  Artifact completeness: ${(summary.artifactCompletenessRate * 100).toFixed(1)}%`)
    for (const record of records.slice(-10)) {
      console.log(`  - ${record.date} ${record.level} ${record.taskName}: ${record.finalGateStatus}`)
    }
  },
})

const metrics = defineCommand({
  meta: { name: 'metrics', description: 'Inspect workflow task metrics' },
  subCommands: { list: metricsList },
})

function normalizeTaskArtifactLevel(value: unknown): TaskArtifactLevel {
  const normalized = String(value ?? 'M').trim().toUpperCase()
  if (normalized === 'S' || normalized === 'M' || normalized === 'L' || normalized === 'CRITICAL') {
    return normalized
  }
  throw new Error(`Invalid task level "${String(value)}"; expected S, M, L, or CRITICAL.`)
}

const taskArtifactsCheck = defineCommand({
  meta: { name: 'check', description: 'Check task artifact completeness' },
  args: {
    dir: { type: 'string', description: 'Task artifact directory; defaults to .scale/state/current.json artifactsDir' },
    level: { type: 'string', description: 'Task level: S, M, L, or CRITICAL; defaults to current state level or M' },
    'warn-only': { type: 'boolean', default: false, description: 'Return zero even when artifacts are incomplete' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const state = new WorkflowArtifactWriter(SCALE_DIR).readCurrentState()
    let level: TaskArtifactLevel
    try {
      level = normalizeTaskArtifactLevel(args.level ?? state?.level ?? 'M')
    } catch (e) {
      console.error((e as Error).message)
      process.exit(1)
    }
    const result = checkTaskArtifactCompleteness({
      projectDir: PROJECT_DIR,
      artifactsDir: args.dir ?? state?.artifactsDir,
      level,
      skillRequiredArtifacts: state?.requiredSkillArtifacts,
    })

    if (args.json) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      console.log(`\nTask Artifacts: ${result.complete ? 'COMPLETE' : 'INCOMPLETE'}`)
      if (result.artifactsDir) console.log(`  Directory: ${result.artifactsDir}`)
      console.log(`  Required: ${result.required.join(', ') || 'none'}`)
      for (const file of result.missing) console.log(`  [MISSING] ${file}`)
      for (const item of result.incomplete) console.log(`  [INCOMPLETE] ${item.file}: ${item.reason}`)
    }

    if (!result.complete && !args['warn-only']) process.exitCode = 1
  },
})

const taskArtifacts = defineCommand({
  meta: { name: 'task-artifacts', description: 'Inspect task artifact completeness' },
  subCommands: { check: taskArtifactsCheck },
})

function printWorkspaceLifecycle(report: WorkspaceLifecycleReport): void {
  console.log('\nSCALE Workspace Lifecycle')
  console.log(`  Topology: ${report.topology.topology}${report.topology.configured ? '' : ' (default)'}`)
  console.log(`  Root: ${report.root.path}`)
  console.log(`  Branch: ${report.root.branch ?? '(detached)'}`)
  console.log(`  Linked worktree: ${report.root.isLinkedWorktree ? 'yes' : 'no'}`)
  console.log(`  Root status: ${report.root.clean ? 'clean' : 'dirty'}`)
  if (!report.root.clean) {
    console.log(`    staged=${report.root.staged} unstaged=${report.root.unstaged} untracked=${report.root.untracked}`)
  }

  if (report.childRepositories.length) {
    console.log('\n  Child repositories:')
    for (const child of report.childRepositories) {
      console.log(`    ${child.clean ? '[CLEAN]' : '[DIRTY]'} ${child.relativePath} (${child.kind}) branch=${child.branch ?? '(detached)'}`)
      if (!child.clean) console.log(`      staged=${child.staged} unstaged=${child.unstaged} untracked=${child.untracked}`)
    }
  } else {
    console.log('\n  Child repositories: none')
  }

  console.log(`\n  Cleanup candidate: ${report.finish.canCleanup ? 'yes' : 'no'}`)
  for (const blocker of report.finish.blockers) console.log(`  [BLOCKER] ${blocker}`)
  for (const warning of report.finish.warnings) console.log(`  [WARN] ${warning}`)
  for (const action of report.finish.nextActions) console.log(`  [NEXT] ${action}`)
}

function compactList(values: string[], limit = 5): string {
  if (values.length <= limit) return values.join(', ')
  return `${values.slice(0, limit).join(', ')} (+${values.length - limit} more)`
}

function printWorkspaceSummary(report: WorkspaceLifecycleReport): void {
  const dirtyChildren = report.childRepositories
    .filter(child => !child.clean)
    .map(child => child.relativePath)
  const unpushedChildren = report.childRepositories
    .filter(child => child.ahead > 0 || (report.topology.finishPolicy.requirePushedBranches && report.topology.topology === 'moe' && !child.upstream && Boolean(child.branch)))
    .map(child => child.relativePath)
  const noUpstreamChildren = report.childRepositories
    .filter(child => !child.upstream && Boolean(child.branch))
    .map(child => child.relativePath)
  const rootStatus = report.root.clean
    ? 'clean'
    : `dirty (staged=${report.root.staged}, unstaged=${report.root.unstaged}, untracked=${report.root.untracked})`
  const status = report.finish.blockers.length > 0 ? 'BLOCKED' : 'READY'

  console.log('\nSCALE Workspace Summary')
  console.log(`  Status: ${status}`)
  console.log(`  Topology: ${report.topology.topology}${report.topology.configured ? '' : ' (default)'}`)
  console.log(`  Root: ${rootStatus}`)
  console.log(`  Children: ${report.childRepositories.length} total, ${dirtyChildren.length} dirty, ${unpushedChildren.length} unpushed, ${noUpstreamChildren.length} no upstream`)

  if (dirtyChildren.length > 0) console.log(`  Dirty child repositories: ${compactList(dirtyChildren)}`)
  if (unpushedChildren.length > 0) console.log(`  Unpushed child repositories: ${compactList(unpushedChildren)}`)

  if (report.finish.blockers.length > 0) {
    console.log('\n  Blockers:')
    for (const blocker of report.finish.blockers.slice(0, 8)) console.log(`    - ${blocker}`)
    if (report.finish.blockers.length > 8) console.log(`    - ... ${report.finish.blockers.length - 8} more blocker(s)`)
  }

  if (report.finish.warnings.length > 0) {
    console.log(`\n  Warnings: ${report.finish.warnings.length} warning(s); run scale workspace finish --json for details`)
  }

  console.log('\n  Next:')
  const nextActions = report.finish.blockers.length > 0
    ? report.finish.nextActions
    : ['Proceed with scale ship <task-id> or cleanup when the branch policy is satisfied']
  for (const action of nextActions.slice(0, 3)) console.log(`    - ${action}`)
  console.log('    - Run scale workspace finish --json for full details')
}

function printWorkspaceTopology(topology: ReturnType<typeof resolveWorkspaceTopology>, written?: string | null): void {
  console.log('\nSCALE Workspace Topology')
  console.log(`  Topology: ${topology.topology}${topology.configured ? '' : ' (default)'}`)
  console.log(`  Config: ${topology.configPath}`)
  if (written) console.log(`  Written: ${written}`)
  console.log('\n  Repositories:')
  for (const repo of topology.repositories) {
    console.log(`    - ${repo.name}: ${repo.path} (${repo.role}) required=${repo.required !== false ? 'yes' : 'no'}`)
  }
  for (const warning of topology.warnings) console.log(`  [WARN] ${warning}`)
}

function printWorkspaceCleanup(result: WorkspaceCleanupResult): void {
  printWorkspaceLifecycle(result.report)
  console.log('\n  Cleanup plan:')
  console.log(`    Mode: ${result.mode}`)
  console.log(`    Target: ${result.targetPath}`)
  console.log(`    Can apply: ${result.canApply ? 'yes' : 'no'}`)
  console.log(`    Applied: ${result.applied ? 'yes' : 'no'}`)
  console.log(`    Confirmation token: ${result.confirmationToken ?? '(unavailable)'}`)
  for (const command of result.commands) console.log(`    Command: ${command}`)
  for (const blocker of result.blockers) console.log(`  [BLOCKER] ${blocker}`)
  for (const warning of result.warnings) console.log(`  [WARN] ${warning}`)
}

const workspaceStatus = defineCommand({
  meta: { name: 'status', description: 'Inspect root worktree and child repository lifecycle state' },
  args: {
    dir: { type: 'string', description: 'Repository or worktree directory; defaults to current project directory' },
    summary: { type: 'boolean', default: false, description: 'Print concise human summary instead of the full repository listing' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const report = await inspectWorkspaceLifecycle({ projectDir: args.dir ?? PROJECT_DIR })

    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
    } else if (isTruthyFlag(args.summary)) {
      printWorkspaceSummary(report)
    } else {
      printWorkspaceLifecycle(report)
    }

    if (report.finish.blockers.length > 0) process.exitCode = 1
  },
})

const workspaceMap = defineCommand({
  meta: { name: 'map', description: 'Resolve or write explicit workspace topology for single, monorepo, polyrepo, submodule, or MOE projects' },
  args: {
    dir: { type: 'string', description: 'Project directory; defaults to current project directory' },
    topology: { type: 'string', default: 'moe', description: 'Starter topology for --write (single/monorepo/polyrepo/submodule-workspace/moe)' },
    write: { type: 'boolean', default: false, description: 'Create .scale/workspace.json when it does not exist' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const projectDir = resolve(args.dir ?? PROJECT_DIR)
    const target = workspaceTopologyPath(projectDir)
    let written: string | null = null

    if (isTruthyFlag(args.write) && !existsSync(target)) {
      ensureDir(join(projectDir, '.scale'))
      writeFileSync(target, workspaceTopologyTemplate({
        topology: normalizeWorkspaceTopologyKind(args.topology),
      }), 'utf-8')
      written = target
    }

    const topology = resolveWorkspaceTopology({ projectDir })
    const result = { ...topology, written }

    if (args.json) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      printWorkspaceTopology(topology, written)
    }
  },
})

const workspaceFinish = defineCommand({
  meta: { name: 'finish', description: 'Check whether a temporary worktree can be safely finished or cleaned up' },
  args: {
    dir: { type: 'string', description: 'Repository or worktree directory; defaults to current project directory' },
    summary: { type: 'boolean', default: false, description: 'Print concise human summary instead of the full repository listing' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const report = await inspectWorkspaceLifecycle({ projectDir: args.dir ?? PROJECT_DIR })
    const result = {
      root: report.root,
      childRepositories: report.childRepositories,
      topology: report.topology,
      finish: report.finish,
    }

    if (args.json) {
      console.log(JSON.stringify(result, null, 2))
    } else if (isTruthyFlag(args.summary)) {
      printWorkspaceSummary(report)
    } else {
      printWorkspaceLifecycle(report)
    }

    if (report.finish.blockers.length > 0) process.exitCode = 1
  },
})

const workspaceCleanup = defineCommand({
  meta: { name: 'cleanup', description: 'Dry-run or apply safe removal of a linked temporary worktree' },
  args: {
    dir: { type: 'string', description: 'Linked worktree directory; defaults to current project directory' },
    'dry-run': { type: 'boolean', default: false, description: 'Preview cleanup; this is the default unless --apply is set' },
    apply: { type: 'boolean', default: false, description: 'Actually run git worktree remove after safety checks' },
    confirm: { type: 'string', description: 'Required confirmation token for --apply, usually the worktree branch name' },
    summary: { type: 'boolean', default: false, description: 'Print concise human summary before the cleanup plan' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const result = await cleanupWorkspaceLifecycle({
      projectDir: args.dir ?? PROJECT_DIR,
      apply: isTruthyFlag(args.apply),
      confirm: args.confirm,
    })

    if (args.json) {
      console.log(JSON.stringify(result, null, 2))
    } else if (isTruthyFlag(args.summary)) {
      printWorkspaceSummary(result.report)
      console.log('\n  Cleanup:')
      console.log(`    Mode: ${result.mode}`)
      console.log(`    Can apply: ${result.canApply ? 'yes' : 'no'}`)
      console.log(`    Applied: ${result.applied ? 'yes' : 'no'}`)
      console.log(`    Confirmation token: ${result.confirmationToken ?? '(unavailable)'}`)
    } else {
      printWorkspaceCleanup(result)
    }

    if (!result.canApply || (isTruthyFlag(args.apply) && !result.applied)) process.exitCode = 1
  },
})

const workspace = defineCommand({
  meta: { name: 'workspace', description: 'Inspect worktree, branch, and child repository lifecycle safety' },
  subCommands: {
    map: workspaceMap,
    status: workspaceStatus,
    finish: workspaceFinish,
    cleanup: workspaceCleanup,
  },
})

function normalizeWorkspaceTopologyKind(value: unknown): WorkspaceTopologyKind {
  const normalized = String(value ?? 'moe').trim()
  if (
    normalized === 'single'
    || normalized === 'monorepo'
    || normalized === 'polyrepo'
    || normalized === 'submodule-workspace'
    || normalized === 'moe'
  ) {
    return normalized
  }
  return 'moe'
}

const preflight = defineCommand({
  meta: { name: 'preflight', description: 'Run service-aware verification without a task artifact' },
  args: {
    dir: { type: 'string', default: PROJECT_DIR, description: 'Project directory' },
    'build-cmd': { type: 'string', description: 'Override build command' },
    'lint-cmd': { type: 'string', description: 'Override lint command' },
    'test-cmd': { type: 'string', description: 'Override test command' },
    'coverage-cmd': { type: 'string', description: 'Override coverage command' },
    profile: { type: 'string', description: 'Verification profile from .scale/verification.json' },
    'preflight-profile': { type: 'string', default: 'quick', description: 'Gate intensity profile (quick/full/ci); quick skips coverage and security' },
    service: { type: 'string', description: 'Service name from .scale/verification.json; use all for required services' },
    'tdd-evidence': { type: 'string', description: 'Path to JSON TDD evidence with red/green/refactor/testFirst=true' },
    'tdd-strict': { type: 'boolean', default: false, description: 'Require TDD evidence before other gates' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const projectDir = resolve(String(args.dir ?? PROJECT_DIR))
    const scaleDir = resolveScaleDirForProject(projectDir)
    const workflowEngine = createVerificationWorkflowEngine(scaleDir)
    const preflightProfile = normalizePreflightProfile(args['preflight-profile'])
    const resolved = resolveVerificationTargets({
      projectDir,
      scaleDir,
      profile: args.profile,
      service: args.service,
    })
    let gateStages = gatesForPreflightProfile(preflightProfile)
    if (resolved.targets.some(target => target.config.smoke)) {
      gateStages = ['G8']
    }
    const commandTargetsSkipped = shouldSkipPreflightCommandTargets(resolved, args)
    if (commandTargetsSkipped) {
      resolved.warnings.push('No verification services or profile commands configured; command gates skipped for this governance-only project.')
    }
    const engineeringStandards = evaluateEngineeringStandardsGate({
      policy: resolved.policy,
      projectDir,
      scaleDir,
    })

    const targetResults: Array<{
      service?: string
      cwd: string
      gates: GateResult[]
      passed: boolean
    }> = []

    if (!args.json) {
      console.log('\nSCALE Preflight')
      for (const warning of resolved.warnings) console.log(`  [WARN] ${warning}`)
      console.log(`  Profile: ${resolved.profileName}`)
      console.log(`  Preflight profile: ${preflightProfile}`)
      console.log(`  Gates: ${gateStages.join(', ')}`)
      if (engineeringStandards.checked) {
        const status = engineeringStandards.blocked ? 'BLOCKED' : engineeringStandards.ok ? 'OK' : 'WARN'
        console.log(`  Engineering standards: ${status} (${engineeringStandards.mode})`)
      } else {
        console.log('  Engineering standards: skipped')
      }
    }

    for (const target of commandTargetsSkipped ? [] : resolved.targets) {
      if (!args.json) {
        const label = target.service ? `${target.service.name} (${target.service.path})` : 'root'
        console.log(`\n  Target: ${label}`)
      }
      const gates = await workflowEngine.verify({
        cwd: target.config.cwd,
        build: args['build-cmd'] ?? target.config.build,
        lint: args['lint-cmd'] ?? target.config.lint,
        test: args['test-cmd'] ?? target.config.test,
        coverage: args['coverage-cmd'] ?? target.config.coverage,
        smoke: target.config.smoke,
        tddEvidence: args['tdd-evidence'],
        tddStrict: isTruthyFlag(args['tdd-strict']),
        gates: gateStages,
      })
      const passed = gates.every(gate => gate.passed)
      targetResults.push({
        service: target.service?.name,
        cwd: target.config.cwd ?? projectDir,
        gates,
        passed,
      })

      if (!args.json) {
        for (const gate of gates) {
          console.log(`    ${gate.passed ? '[PASS]' : '[FAIL]'} ${gate.gate}: ${gate.evidence.slice(0, 80)}`)
          for (const blocker of gate.blockers) console.log(`      [BLOCKER] ${blocker.slice(0, 120)}`)
        }
      }
    }

    const passed = (targetResults.length === 0 || targetResults.every(target => target.passed)) &&
      !engineeringStandards.blocked
    const result = {
      phase: 'PREFLIGHT',
      profile: resolved.profileName,
      preflightProfile,
      gates: gateStages,
      services: targetResults.map(target => target.service).filter(Boolean),
      policy: resolved.policy,
      engineeringStandards,
      targets: targetResults,
      commandTargetsSkipped,
      passed,
    }

    if (args.json) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      console.log(`\nPREFLIGHT: ${passed ? 'PASSED' : 'FAILED'}\n`)
    }
    if (!passed) process.exitCode = 1
  },
})

const status = defineCommand({
  meta: { name: 'status', description: 'Show current SCALE workflow status' },
  args: {
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const { store } = getEngine()
    const evidenceStore = new EvidenceStore(SCALE_DIR)
    const reviewStore = new ReviewStore(SCALE_DIR)
    const [specs, plans, tasks, releases] = await Promise.all([
      store.query({ type: 'Spec', limit: 1 }),
      store.query({ type: 'Plan', limit: 1 }),
      store.query({ type: 'Task', limit: 1 }),
      store.query({ type: 'Release', limit: 1 }),
    ])
    const latestEvidence = evidenceStore.listGateResults(5)
    const latestReviews = reviewStore.listReviews(5)
    const latestTask = tasks[0]
    const taskPayload = latestTask?.payload as { verificationEvidenceIds?: string[]; reviewEvidenceIds?: string[]; reviewPassed?: boolean; reviewedAt?: number; verifiedAt?: number; testPassed?: boolean; lintStatus?: string; testCoverage?: number } | undefined
    const workflowState = new WorkflowArtifactWriter(SCALE_DIR).readCurrentState()
    const currentOpenTasks = workflowState?.openTasks ?? []
    const nextOpenTask = nextWorkflowOpenTask(currentOpenTasks)

    const blockers: string[] = []
    const latestBlockingEvidence = latestEvidence.find(record => !record.passed)
    const latestBlockingReview = latestReviews.find(record => !record.passed)
    if (latestBlockingEvidence) blockers.push(`${latestBlockingEvidence.gate}: ${latestBlockingEvidence.blockers.join('; ') || latestBlockingEvidence.status}`)
    if (latestBlockingReview) blockers.push(`Review ${latestBlockingReview.id}: ${latestBlockingReview.summary.critical} critical, ${latestBlockingReview.summary.high} high`)
    if (latestTask && (!taskPayload?.verificationEvidenceIds || taskPayload.verificationEvidenceIds.length === 0)) {
      blockers.push(`Task ${latestTask.id} has no persisted verification evidence`)
    }
    if (latestTask?.status === 'COMPLETED' && (!taskPayload?.reviewEvidenceIds || taskPayload.reviewEvidenceIds.length === 0)) {
      blockers.push(`Task ${latestTask.id} has no persisted review evidence`)
    }

    const nextCommand = (() => {
      if (nextOpenTask?.kind === 'command') return nextOpenTask.value
      if (nextOpenTask?.kind === 'blocker') return `Resolve workflow blocker: ${nextOpenTask.value}`
      if (!specs[0]) return 'scale define "<feature>" --description "<what to build>"'
      if (!plans[0]) return `scale plan ${specs[0].id}`
      if (!latestTask) return `scale build ${plans[0].id}`
      if (!taskPayload?.verificationEvidenceIds?.length) return `scale verify ${latestTask.id}`
      if (latestTask.status !== 'COMPLETED') return `scale verify ${latestTask.id}`
      if (!taskPayload.reviewEvidenceIds?.length || taskPayload.reviewPassed !== true) return `scale review ${latestTask.id}`
      if (!releases[0]) return `scale ship ${latestTask.id}`
      return 'scale evidence list'
    })()

    const result = {
      artifacts: {
        latestSpec: specs[0] ? { id: specs[0].id, status: specs[0].status, title: specs[0].title } : null,
        latestPlan: plans[0] ? { id: plans[0].id, status: plans[0].status, title: plans[0].title } : null,
        latestTask: latestTask ? {
          id: latestTask.id,
          status: latestTask.status,
          title: latestTask.title,
          lintStatus: taskPayload?.lintStatus,
          testPassed: taskPayload?.testPassed,
          testCoverage: taskPayload?.testCoverage,
          evidenceIds: taskPayload?.verificationEvidenceIds ?? [],
          reviewPassed: taskPayload?.reviewPassed,
          reviewEvidenceIds: taskPayload?.reviewEvidenceIds ?? [],
        } : null,
      },
      recentEvidence: latestEvidence.map(record => ({
        id: record.id,
        gate: record.gate,
        status: record.status,
        passed: record.passed,
        blockers: record.blockers,
        createdAt: record.createdAt,
      })),
      recentReviews: latestReviews.map(record => ({
        id: record.id,
        taskId: record.taskId,
        passed: record.passed,
        summary: record.summary,
        createdAt: record.createdAt,
      })),
      workflowState: workflowState ? {
        taskId: workflowState.taskId,
        level: workflowState.level,
        phase: workflowState.phase,
        artifactsDir: workflowState.artifactsDir,
        openTasks: workflowState.openTasks ?? [],
        skillIntents: workflowState.skillIntents,
      } : null,
      blockers,
      nextCommand,
    }

    if (args.json) {
      console.log(JSON.stringify(result, null, 2))
      return
    }

    console.log('\nSCALE Status')
    console.log('Artifacts:')
    console.log(`  Spec: ${result.artifacts.latestSpec ? `${result.artifacts.latestSpec.id} (${result.artifacts.latestSpec.status})` : 'none'}`)
    console.log(`  Plan: ${result.artifacts.latestPlan ? `${result.artifacts.latestPlan.id} (${result.artifacts.latestPlan.status})` : 'none'}`)
    console.log(`  Task: ${result.artifacts.latestTask ? `${result.artifacts.latestTask.id} (${result.artifacts.latestTask.status})` : 'none'}`)

    if (result.artifacts.latestTask?.evidenceIds.length) {
      console.log(`  Task evidence: ${result.artifacts.latestTask.evidenceIds.join(', ')}`)
    }

    console.log('\nRecent Evidence:')
    if (result.recentEvidence.length === 0) {
      console.log('  none')
    } else {
      for (const record of result.recentEvidence) {
        console.log(`  ${record.id} ${record.gate} ${record.passed ? 'PASS' : record.status}`)
      }
    }

    if (blockers.length > 0) {
      console.log('\nBlockers:')
      for (const blocker of blockers) console.log(`  - ${blocker}`)
    }

    if ((result.workflowState?.openTasks.length ?? 0) > 0) {
      console.log('\nOpen Tasks:')
      for (const task of result.workflowState!.openTasks) console.log(`  - ${task}`)
    }

    console.log(`\nNext: ${nextCommand}`)
  },
})

// ============================================================================
// init command
// ============================================================================

const init = defineCommand({
  meta: { name: 'init', description: 'Initialize SCALE Engine in current project (one-click install)' },
  args: {
    agent: { type: 'string', default: '', description: `Agent type (${SUPPORTED_AGENTS.join('/')}) - auto-detected if not specified` },
    dir: { type: 'string', default: '.', description: 'Project directory' },
    json: { type: 'boolean', default: false, description: 'Output initialization result as JSON' },
    scenario: { type: 'string', default: 'standard', description: 'Scenario mode (sandbox/standard/critical)' },
    'governance-pack': {
      type: 'string',
      default: 'standard',
      description: 'Governance template pack (standard/project-scaffold/moe-workspace/resource-governance/go-service-matrix/node-library/frontend-app)',
    },
    quick: { type: 'boolean', default: false, description: 'Quick start with auto-detection' },
    interactive: { type: 'boolean', default: false, description: 'Interactive configuration mode with prompts' },
    'coverage-threshold': { type: 'string', default: '80', description: 'Coverage threshold (default 80%)' },
    'retry-threshold': { type: 'string', default: '3', description: 'Brute retry threshold (default 3)' },
    'block-severity': { type: 'string', default: 'CRITICAL', description: 'Block severity level (CRITICAL/HIGH/MEDIUM)' },
  },
  async run({ args }) {
    // Interactive configuration mode
    if (args.interactive) {
      console.log('\n🔧 SCALE Engine Interactive Configuration\n')
      console.log('=' .repeat(50))

      // Step 1: Detect and suggest agent platform
      const detection = detectPlatform(args.dir)
      console.log('\n📋 Step 1: Agent Platform Selection')
      console.log(`   Detected suggestions: ${detection.suggestions.join(', ') || 'none'}`)

      const agentType = args.agent || detection.suggestions[0] || 'claude-code'
      console.log(`   Using: ${agentType}`)

      // Step 2: Scenario mode
      console.log('\n📋 Step 2: Scenario Mode')
      console.log('   sandbox    - No quality gates (POC/prototype)')
      console.log('   standard   - Default quality gates')
      console.log('   critical   - Hardened gates + manual approval')

      const scenarioMode = args.scenario as 'sandbox' | 'standard' | 'critical'
      console.log(`   Using: ${scenarioMode}`)

      // Step 3: Quality Gate Thresholds (quantified)
      console.log('\n📋 Step 3: Quality Gate Thresholds')
      const coverageThreshold = parseInt(args['coverage-threshold'], 10) || 80
      const retryThreshold = parseInt(args['retry-threshold'], 10) || 3
      const blockSeverity = args['block-severity'] || 'CRITICAL'

      console.log(`   Coverage threshold:   ${coverageThreshold}%`)
      console.log(`   Retry threshold:      ${retryThreshold} (brute retry block)`)
      console.log(`   Block severity:       ${blockSeverity}`)

      // Step 4: Write thresholds to .scale/thresholds.json
      const thresholdsPath = join(args.dir, '.scale', 'thresholds.json')
      ensureDir(join(args.dir, '.scale'))
      writeFileSync(thresholdsPath, JSON.stringify({
        coverage: { minimum: coverageThreshold, unit: 'percent' },
        retry: { bruteMaximum: retryThreshold, unit: 'count' },
        severity: { blockLevel: blockSeverity },
        gates: {
          G3_build: { required: scenarioMode !== 'sandbox', exitCode: 0 },
          G4_lint: { required: scenarioMode !== 'sandbox', exitCode: 0 },
          G5_tests: { required: scenarioMode !== 'sandbox', allPass: true },
          G6_coverage: { required: scenarioMode !== 'sandbox', minimum: coverageThreshold },
          G7_security: { required: scenarioMode === 'critical', noCritical: true },
        },
      }, null, 2))

      console.log(`\n   ✓ Thresholds written to: ${thresholdsPath}`)

      // Initialize with adapter
      const adapter = createAdapter(agentType)
      const result = await adapter.init({
        projectDir: args.dir,
        agentType: agentType as never,
        scenarioMode,
        thresholdsPath,
      })
      const projectName = args.dir.split(/[/\\]/).pop() || 'Project'
      const governance = writeGovernanceTemplates(args.dir, {
        mode: governanceModeFromScenario(scenarioMode),
        projectName,
        pack: args['governance-pack'],
      })
      result.created.push(...governance.created)
      result.skipped.push(...governance.skipped)

      console.log(`\n✅ SCALE Engine initialized for ${agentType} (interactive mode)`)
      console.log(`\n📁 Created:`)
      for (const f of result.created) console.log(`   + ${f}`)
      if (result.skipped.length > 0) {
        console.log(`\n⏭️  Skipped (already exist):`)
        for (const f of result.skipped) console.log(`   - ${f}`)
      }

      console.log(`\n🔧 Configuration Summary:`)
      console.log(`   Settings:      ${result.settingsPath}`)
      console.log(`   Knowledge:     ${result.knowledgeDocPath}`)
      console.log(`   Thresholds:    ${thresholdsPath}`)
      console.log(`   Data dir:      ${result.scaleDir}`)
      console.log(`   Scenario:      ${scenarioMode}`)

      console.log(`\n📋 Next steps:`)
      console.log(`   → scale doctor`)
      console.log(`   → scale create Spec "<feature name>"`)
      return
    }

    // One-click quick start mode
    if (!args.agent) {
      const qsResult = await quickStart(args.dir, { governancePack: args['governance-pack'] })
      if (args.json) {
        const detection = qsResult.success ? undefined : detectPlatform(args.dir)
        console.log(JSON.stringify({
          ok: qsResult.success,
          mode: qsResult.success && !qsResult.platform ? 'governance-only' : 'quick',
          platform: qsResult.platform,
          created: qsResult.created,
          skipped: qsResult.skipped,
          constraintsApplied: qsResult.constraintsApplied,
          capabilitiesEnabled: qsResult.capabilitiesEnabled,
          knowledgeGraph: qsResult.knowledgeGraph,
          nextSteps: qsResult.nextSteps,
          suggestions: detection?.suggestions ?? [],
        }, null, 2))
        return
      }
      if (qsResult.success) {
        if (!qsResult.platform) console.log(`\nSCALE governance templates initialized`)
        else
        console.log(`\n✅ SCALE Engine Quick Start completed for ${qsResult.platform}`)
        console.log(`\n📁 Created (${qsResult.created.length}):`)
        for (const f of qsResult.created) console.log(`   + ${f}`)
        if (qsResult.skipped.length > 0) {
          console.log(`\n⏭️  Skipped (${qsResult.skipped.length}):`)
          for (const f of qsResult.skipped) console.log(`   - ${f}`)
        }
        console.log(`\n🔒 Physical constraints applied: ${qsResult.constraintsApplied}`)
        console.log(`\n🚀 Capabilities enabled: ${qsResult.capabilitiesEnabled.join(', ')}`)
        console.log(`\n📋 Next steps:`)
        for (const step of qsResult.nextSteps) console.log(`   → ${step}`)
      } else {
        console.log(`\n⚠️  No agent platform detected`)
        const detection = detectPlatform(args.dir)
        console.log(`\n📋 Suggested platforms: ${detection.suggestions.join(', ')}`)
        console.log(`\n→ Run: scale init --agent <platform>`)
      }
      return
    }

    // Manual agent specification mode
    const adapter = createAdapter(args.agent)
    const result = await adapter.init({ projectDir: args.dir, agentType: args.agent as never, scenarioMode: args.scenario as 'sandbox' | 'standard' | 'critical' })
    const projectName = args.dir.split(/[/\\]/).pop() || 'Project'
    const governance = writeGovernanceTemplates(args.dir, {
      mode: governanceModeFromScenario(args.scenario),
      projectName,
      pack: args['governance-pack'],
    })
    result.created.push(...governance.created)
    result.skipped.push(...governance.skipped)
    if (args.json) {
      console.log(JSON.stringify({
        ok: true,
        mode: args.quick ? 'quick-agent' : 'manual',
        agent: args.agent,
        scenario: args.scenario,
        governancePack: args['governance-pack'],
        settingsPath: result.settingsPath,
        knowledgeDocPath: result.knowledgeDocPath,
        scaleDir: result.scaleDir,
        created: result.created,
        skipped: result.skipped,
        nextSteps: ['scale doctor', 'scale create Spec "<feature name>"'],
      }, null, 2))
      return
    }
    console.log(`\n✅ SCALE Engine initialized for ${args.agent} (scenario: ${args.scenario})`)
    console.log(`\n📁 Created:`)
    for (const f of result.created) console.log(`   + ${f}`)
    if (result.skipped.length > 0) {
      console.log(`\n⏭️  Skipped (already exist):`)
      for (const f of result.skipped) console.log(`   - ${f}`)
    }
    console.log(`\n🔧 Settings: ${result.settingsPath}`)
    console.log(`\n📖 Knowledge: ${result.knowledgeDocPath}`)
    console.log(`\n📂 Data dir:  ${result.scaleDir}`)
    console.log(`\n📋 Next steps:`)
    console.log(`   → scale doctor`)
    console.log(`   → scale create Spec "<feature name>"`)
  },
})

// ============================================================================
// governance command — Generated governance asset tooling
// ============================================================================

const governanceDiff = defineCommand({
  meta: { name: 'diff', description: 'Check generated governance files for drift' },
  args: {
    dir: { type: 'string', default: '.', description: 'Project directory' },
    json: { type: 'boolean', default: false, description: 'Print JSON output' },
  },
  run({ args }) {
    const report = computeGovernanceDrift(args.dir)
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
      return
    }
    if (!report.lockExists) {
      console.log('No governance lock found. Run: scale init --governance-pack <pack>')
      return
    }
    if (report.missing.length === 0 && report.changed.length === 0) {
      console.log('Governance generated files are clean.')
      return
    }
    for (const item of report.missing) console.log(`missing: ${item.path}`)
    for (const item of report.changed) console.log(`changed: ${item.path}`)
  },
})

const governance = defineCommand({
  meta: { name: 'governance', description: 'Governance template pack tools' },
  subCommands: { diff: governanceDiff },
})

// ============================================================================
// assets command - Resource lifecycle governance
// ============================================================================

const assetsScan = defineCommand({
  meta: { name: 'scan', description: 'Classify project docs, reports, media, scripts, and temporary outputs' },
  args: {
    dir: { type: 'string', default: '.', description: 'Project directory' },
    json: { type: 'boolean', default: false, description: 'Print JSON output' },
  },
  run({ args }) {
    const report = scanResourceAssets({ projectDir: args.dir })
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
      return
    }
    console.log('SCALE Asset Scan')
    console.log(`  Project: ${report.projectDir}`)
    console.log(`  Total resources: ${report.summary.total}`)
    console.log(`  Tracked forbidden: ${report.summary.trackedForbidden}`)
    console.log(`  Large tracked: ${report.summary.largeTracked}`)
    console.log(`  Expired: ${report.summary.expired}`)
    console.log('\nBy type:')
    for (const [type, count] of Object.entries(report.summary.byType)) {
      if (count > 0) console.log(`  ${type}: ${count}`)
    }
  },
})

const assetsDoctor = defineCommand({
  meta: { name: 'doctor', description: 'Find resource lifecycle and Git policy problems' },
  args: {
    dir: { type: 'string', default: '.', description: 'Project directory' },
    json: { type: 'boolean', default: false, description: 'Print JSON output' },
  },
  run({ args }) {
    const report = doctorResourceAssets({ projectDir: args.dir })
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
      return
    }
    console.log(`SCALE Asset Doctor: ${report.ok ? 'OK' : 'FAILED'}`)
    if (report.findings.length === 0) {
      console.log('  No resource lifecycle findings.')
      return
    }
    for (const finding of report.findings) {
      const path = finding.path ? ` ${finding.path}` : ''
      console.log(`  [${finding.severity.toUpperCase()}] ${finding.code}${path}: ${finding.message}`)
      if (finding.fix) console.log(`    fix: ${finding.fix}`)
    }
    if (!report.ok) process.exitCode = 1
  },
})

const assetsSettle = defineCommand({
  meta: { name: 'settle', description: 'Record resource lifecycle settlement evidence for a task' },
  args: {
    dir: { type: 'string', default: '.', description: 'Project directory' },
    'task-id': { type: 'string', description: 'Task id for the settlement record' },
    'artifact-dir': { type: 'string', description: 'Task artifact directory where resource-impact.md should be updated' },
    json: { type: 'boolean', default: false, description: 'Print JSON output' },
  },
  run({ args }) {
    const report = settleResourceAssets({
      projectDir: args.dir,
      taskId: args['task-id'],
      artifactsDir: args['artifact-dir'],
    })
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      console.log(`SCALE Asset Settlement: ${report.ok ? 'OK' : 'FAILED'}`)
      if (report.resourceImpactPath) console.log(`  Resource impact: ${report.resourceImpactPath}`)
      if (report.doctor.findings.length > 0) {
        for (const finding of report.doctor.findings) {
          const path = finding.path ? ` ${finding.path}` : ''
          console.log(`  [${finding.severity.toUpperCase()}] ${finding.code}${path}: ${finding.message}`)
        }
      }
    }
    if (!report.ok) process.exitCode = 1
  },
})

const assets = defineCommand({
  meta: { name: 'assets', description: 'Resource lifecycle governance for generated and maintained project assets' },
  subCommands: { scan: assetsScan, doctor: assetsDoctor, settle: assetsSettle },
})

// ============================================================================
// standards command - Engineering standards governance
// ============================================================================

function resolveChangedFilesArg(args: { dir?: string; changed?: boolean; 'changed-files'?: string }): string[] | undefined {
  const explicit = splitChangedFiles(args['changed-files'])
  if (explicit.length > 0) return explicit
  if (!args.changed) return undefined
  return readGitChangedFiles(args.dir ?? '.')
}

function splitChangedFiles(value?: string): string[] {
  if (!value) return []
  return value
    .split(/[\n,]/)
    .map(item => item.trim())
    .filter(Boolean)
}

function readGitChangedFiles(projectDir: string): string[] {
  const tracked = readGitPathList(projectDir, ['diff', '--name-only', '--diff-filter=ACMRTUXB', 'HEAD', '--'])
  const untracked = readGitPathList(projectDir, ['ls-files', '--others', '--exclude-standard'])
  return Array.from(new Set([...tracked, ...untracked]))
}

function readGitPathList(projectDir: string, args: string[]): string[] {
  try {
    return execFileSync('git', ['-C', projectDir, ...args], { encoding: 'utf-8' })
      .split(/\r?\n/)
      .map(item => item.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

const standardsScan = defineCommand({
  meta: { name: 'scan', description: 'Scan source files for engineering standard violations' },
  args: {
    dir: { type: 'string', default: '.', description: 'Project directory' },
    changed: { type: 'boolean', default: false, description: 'Scan changed Git files only' },
    'changed-files': { type: 'string', description: 'Comma or newline separated file list to scan' },
    json: { type: 'boolean', default: false, description: 'Print JSON output' },
  },
  run({ args }) {
    const report = scanEngineeringStandards({ projectDir: args.dir, changedFiles: resolveChangedFilesArg(args) })
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
      return
    }
    console.log('SCALE Standards Scan')
    console.log(`  Project: ${report.projectDir}`)
    console.log(`  Files scanned: ${report.summary.filesScanned}`)
    console.log(`  Findings: ${report.summary.totalFindings}`)
    console.log(`  Blocking findings: ${report.summary.blockingFindings}`)
    for (const finding of report.findings.slice(0, 20)) {
      const line = finding.line ? `:${finding.line}` : ''
      console.log(`  [${finding.severity.toUpperCase()}] ${finding.ruleId} ${finding.path}${line}: ${finding.message}`)
    }
    if (report.findings.length > 20) console.log(`  ... ${report.findings.length - 20} more finding(s)`)
  },
})

const standardsDoctor = defineCommand({
  meta: { name: 'doctor', description: 'Find blocking engineering standards problems' },
  args: {
    dir: { type: 'string', default: '.', description: 'Project directory' },
    changed: { type: 'boolean', default: false, description: 'Scan changed Git files only' },
    'changed-files': { type: 'string', description: 'Comma or newline separated file list to scan' },
    json: { type: 'boolean', default: false, description: 'Print JSON output' },
  },
  run({ args }) {
    const report = doctorEngineeringStandards({ projectDir: args.dir, changedFiles: resolveChangedFilesArg(args) })
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
      if (!report.ok) process.exitCode = 1
      return
    }
    console.log(`SCALE Standards Doctor: ${report.ok ? 'OK' : 'FAILED'}`)
    if (report.findings.length === 0) {
      console.log('  No engineering standards findings.')
      return
    }
    for (const finding of report.findings) {
      const line = finding.line ? `:${finding.line}` : ''
      console.log(`  [${finding.severity.toUpperCase()}] ${finding.ruleId} ${finding.path}${line}: ${finding.message}`)
      if (finding.fix) console.log(`    fix: ${finding.fix}`)
    }
    if (!report.ok) process.exitCode = 1
  },
})

const standardsSettle = defineCommand({
  meta: { name: 'settle', description: 'Record engineering standards settlement evidence for a task' },
  args: {
    dir: { type: 'string', default: '.', description: 'Project directory' },
    'task-id': { type: 'string', description: 'Task id for the settlement record' },
    'artifact-dir': { type: 'string', description: 'Task artifact directory where standards-impact.md should be updated' },
    changed: { type: 'boolean', default: false, description: 'Scan changed Git files only' },
    'changed-files': { type: 'string', description: 'Comma or newline separated file list to scan' },
    json: { type: 'boolean', default: false, description: 'Print JSON output' },
  },
  run({ args }) {
    const report = settleEngineeringStandards({
      projectDir: args.dir,
      taskId: args['task-id'],
      artifactsDir: args['artifact-dir'],
      changedFiles: resolveChangedFilesArg(args),
    })
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      console.log(`SCALE Standards Settlement: ${report.ok ? 'OK' : 'FAILED'}`)
      if (report.standardsImpactPath) console.log(`  Standards impact: ${report.standardsImpactPath}`)
      for (const finding of report.doctor.findings) {
        const line = finding.line ? `:${finding.line}` : ''
        console.log(`  [${finding.severity.toUpperCase()}] ${finding.ruleId} ${finding.path}${line}: ${finding.message}`)
      }
    }
    if (!report.ok) process.exitCode = 1
  },
})

const standardsBaseline = defineCommand({
  meta: { name: 'baseline', description: 'Generate a legacy standards baseline and classification report' },
  args: {
    dir: { type: 'string', default: '.', description: 'Project directory' },
    write: { type: 'boolean', default: false, description: 'Write .scale/engineering-standards-baseline.json' },
    'task-id': { type: 'string', description: 'Task id for the legacy debt report' },
    'artifact-dir': { type: 'string', description: 'Directory where standards-legacy-debt.md should be written' },
    reason: { type: 'string', default: 'legacy standards debt accepted for staged remediation', description: 'Reason recorded on generated baseline entries' },
    json: { type: 'boolean', default: false, description: 'Print JSON output' },
  },
  run({ args }) {
    const report = baselineEngineeringStandards({
      projectDir: args.dir,
      writeBaseline: args.write,
      taskId: args['task-id'],
      artifactsDir: args['artifact-dir'],
      reason: args.reason,
    })
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
      return
    }
    console.log(`Standards baseline: ${report.wroteBaseline ? 'written' : 'dry-run'}`)
    console.log(`  Baseline entries: ${report.baselineEntries.length}`)
    console.log(`  Blocking findings: ${report.debt.blockingFindings}`)
    console.log(`  Baseline path: ${report.baselinePath}`)
    if (report.legacyDebtPath) console.log(`  Legacy debt report: ${report.legacyDebtPath}`)
    if (!report.wroteBaseline) console.log('  Re-run with --write to update .scale/engineering-standards-baseline.json.')
  },
})

const standards = defineCommand({
  meta: { name: 'standards', description: 'Engineering standards governance for logs, security, architecture, database, and code quality' },
  subCommands: { scan: standardsScan, doctor: standardsDoctor, settle: standardsSettle, baseline: standardsBaseline },
})

// ============================================================================
// artifact command - Derived HTML artifacts for human review
// ============================================================================

const artifactRender = defineCommand({
  meta: { name: 'render', description: 'Render a task Markdown source set into a governed HTML artifact' },
  args: {
    dir: { type: 'string', default: '.', description: 'Project directory' },
    'task-id': { type: 'string', description: 'Task id under docs/worklog/tasks' },
    'artifact-dir': { type: 'string', description: 'Task artifact directory override' },
    type: { type: 'string', default: 'release-report', description: 'HTML artifact type' },
    source: { type: 'string', description: 'Comma or newline separated source Markdown files relative to the task directory' },
    theme: { type: 'string', default: 'auto', description: 'Theme mode: dark/light/auto' },
    lang: { type: 'string', default: 'zh', description: 'HTML language: zh/en' },
    title: { type: 'string', description: 'HTML document title override' },
    json: { type: 'boolean', default: false, description: 'Print JSON output' },
  },
  run({ args }) {
    const result = renderHtmlArtifact({
      projectDir: args.dir,
      taskId: args['task-id'],
      artifactDir: args['artifact-dir'],
      type: String(args.type ?? 'release-report'),
      sourcePaths: splitChangedFiles(typeof args.source === 'string' ? args.source : undefined),
      theme: normalizeThemeArg(args.theme),
      lang: normalizeLangArg(args.lang),
      title: typeof args.title === 'string' ? args.title : undefined,
    })
    if (args.json) {
      console.log(JSON.stringify(result, null, 2))
      return
    }
    console.log('SCALE HTML Artifact Render')
    console.log(`  Type: ${result.type}`)
    console.log(`  HTML: ${result.outputPath}`)
    console.log(`  Index: ${result.indexPath}`)
    console.log(`  Manifest: ${result.manifestPath}`)
    if (result.missingSources.length > 0) {
      console.log(`  Missing sources: ${result.missingSources.join(', ')}`)
    }
  },
})

const artifactDoctor = defineCommand({
  meta: { name: 'doctor', description: 'Check HTML artifacts for traceability, stale sources, remote assets, and secret-like content' },
  args: {
    dir: { type: 'string', default: '.', description: 'Project directory' },
    'task-id': { type: 'string', description: 'Task id under docs/worklog/tasks' },
    'artifact-dir': { type: 'string', description: 'Task artifact directory override' },
    type: { type: 'string', description: 'Optional HTML artifact type to check' },
    json: { type: 'boolean', default: false, description: 'Print JSON output' },
  },
  run({ args }) {
    const report = doctorHtmlArtifacts({
      projectDir: args.dir,
      taskId: args['task-id'],
      artifactDir: args['artifact-dir'],
      type: typeof args.type === 'string' ? args.type : undefined,
    })
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
      if (!report.ok) process.exitCode = 1
      return
    }
    console.log(`SCALE HTML Artifact Doctor: ${report.ok ? 'OK' : 'FAILED'}`)
    console.log(`  Manifest: ${report.manifestPath}`)
    console.log(`  Artifacts: ${report.artifacts.length}`)
    if (report.findings.length === 0) {
      console.log('  No HTML artifact findings.')
    } else {
      for (const finding of report.findings) {
        const path = finding.path ? ` ${finding.path}` : ''
        console.log(`  [${finding.severity.toUpperCase()}] ${finding.code}${path}: ${finding.message}`)
        if (finding.fix) console.log(`    fix: ${finding.fix}`)
      }
    }
    if (!report.ok) process.exitCode = 1
  },
})

const artifactSettle = defineCommand({
  meta: { name: 'settle', description: 'Record HTML artifact settlement evidence for a task' },
  args: {
    dir: { type: 'string', default: '.', description: 'Project directory' },
    'task-id': { type: 'string', description: 'Task id under docs/worklog/tasks' },
    'artifact-dir': { type: 'string', description: 'Task artifact directory override' },
    json: { type: 'boolean', default: false, description: 'Print JSON output' },
  },
  run({ args }) {
    const report = settleHtmlArtifacts({
      projectDir: args.dir,
      taskId: args['task-id'],
      artifactDir: args['artifact-dir'],
    })
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
      if (!report.ok) process.exitCode = 1
      return
    }
    console.log(`SCALE HTML Artifact Settlement: ${report.ok ? 'OK' : 'FAILED'}`)
    console.log(`  HTML impact: ${report.htmlImpactPath}`)
    for (const finding of report.doctor.findings) {
      const path = finding.path ? ` ${finding.path}` : ''
      console.log(`  [${finding.severity.toUpperCase()}] ${finding.code}${path}: ${finding.message}`)
    }
    if (!report.ok) process.exitCode = 1
  },
})

const artifactOpen = defineCommand({
  meta: { name: 'open', description: 'Open or print the local file URL for a rendered HTML artifact' },
  args: {
    dir: { type: 'string', default: '.', description: 'Project directory' },
    'task-id': { type: 'string', description: 'Task id under docs/worklog/tasks' },
    'artifact-dir': { type: 'string', description: 'Task artifact directory override' },
    type: { type: 'string', description: 'Optional HTML artifact type to open' },
    'print-only': { type: 'boolean', default: false, description: 'Only print the file URL without launching a browser' },
    json: { type: 'boolean', default: false, description: 'Print JSON output' },
  },
  run({ args }) {
    const path = resolveHtmlArtifactForOpen({
      projectDir: args.dir,
      taskId: args['task-id'],
      artifactDir: args['artifact-dir'],
      type: typeof args.type === 'string' ? args.type : undefined,
    })
    const url = pathToFileURL(path).toString()
    const exists = existsSync(path)
    if (!args['print-only'] && exists) launchLocalFile(path)
    const output = { ok: exists, path, url, launched: Boolean(!args['print-only'] && exists) }
    if (args.json) {
      console.log(JSON.stringify(output, null, 2))
      if (!exists) process.exitCode = 1
      return
    }
    if (!exists) {
      console.log(`HTML artifact not found: ${path}`)
      process.exitCode = 1
      return
    }
    console.log(url)
  },
})

const artifact = defineCommand({
  meta: { name: 'artifact', description: 'Derived HTML artifact rendering and safety checks' },
  subCommands: { render: artifactRender, doctor: artifactDoctor, settle: artifactSettle, open: artifactOpen },
})

function normalizeThemeArg(value: unknown): 'dark' | 'light' | 'auto' {
  const normalized = String(value ?? 'auto').trim().toLowerCase()
  if (normalized === 'dark' || normalized === 'light' || normalized === 'auto') return normalized
  return 'auto'
}

function normalizeLangArg(value: unknown): 'zh' | 'en' {
  return String(value ?? 'zh').trim().toLowerCase() === 'en' ? 'en' : 'zh'
}

function launchLocalFile(path: string): void {
  try {
    if (process.platform === 'win32') {
      execFileSync('cmd', ['/c', 'start', '', path], { stdio: 'ignore' })
    } else if (process.platform === 'darwin') {
      execFileSync('open', [path], { stdio: 'ignore' })
    } else {
      execFileSync('xdg-open', [path], { stdio: 'ignore' })
    }
  } catch {
    // Opening is convenience-only; artifact doctor/render remains the source of truth.
  }
}

// ============================================================================
// evolve command
// ============================================================================

const evolve = defineCommand({
  meta: { name: 'evolve', description: 'Run evolution cycle (Defect→Lesson→Rule→Hook)' },
  args: {},
  async run() {
    const { store, kb, eventBus } = getEngine()
    const extractor = new LessonExtractor(store, kb, eventBus)
    const proposer = new RuleProposer(kb, eventBus)
    const generator = new HookGenerator(eventBus)
    const engine = new EvolutionEngine(extractor, proposer, generator, eventBus, SCALE_DIR)
    const stats = await engine.runCycle()
    console.log(JSON.stringify(stats, null, 2))
  },
})

// ============================================================================
// doctor command
// ============================================================================

const doctor = defineCommand({
  meta: { name: 'doctor', description: 'Diagnose SCALE Engine health' },
  args: {
    dir: { type: 'string', default: '.', description: 'Project directory' },
    json: { type: 'boolean', default: false, description: 'Output as JSON' },
  },
  async run({ args }) {
    const doc = new Doctor(args.dir)
    const report = await doc.diagnose()
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      console.log(doc.formatReport(report))
    }
    process.exitCode = report.overall === 'broken' ? 1 : 0
  },
})

// ============================================================================
// workflow command — 列出/查看工作流预设
// ============================================================================

const workflowList = defineCommand({
  meta: { name: 'list', description: 'List all workflow presets' },
  args: {
    scenario: { type: 'string', description: 'Filter by scenario mode (sandbox/standard/critical)' },
    json: { type: 'boolean', default: false, description: 'Output workflow presets as JSON' },
  },
  async run({ args }) {
    const presets = args.scenario
      ? getPresetsByScenario(args.scenario as 'sandbox' | 'standard' | 'critical')
      : listWorkflowPresets()

    if (args.json) {
      console.log(JSON.stringify({
        ok: true,
        scenario: args.scenario ?? null,
        count: presets.length,
        presets: presets.map(preset => ({
          id: preset.id,
          name: preset.name,
          nameZh: preset.nameZh,
          description: preset.description,
          scenarioMode: preset.scenarioMode,
          requiredArtifacts: preset.requiredArtifacts,
          steps: preset.steps,
        })),
      }, null, 2))
      return
    }

    if (presets.length === 0) {
      console.log('No workflow presets found.')
      return
    }

    console.log('\n📋 SCALE Engine Workflow Presets')
    console.log('═══════════════════════════════════════════════════════')

    for (const preset of presets) {
      const modeEmoji = { sandbox: '🏖️', standard: '⚙️', critical: '🔒' }[preset.scenarioMode]
      const mandatorySteps = preset.steps.filter((s) => s.isMandatory).length
      const totalSteps = preset.steps.length

      console.log(`\n  ${preset.nameZh} (${preset.id})`)
      console.log(`  ${preset.description}`)
      console.log(`  Mode: ${modeEmoji} ${preset.scenarioMode} · Steps: ${mandatorySteps}/${totalSteps} mandatory`)

      if (preset.requiredArtifacts.length > 0) {
        console.log(`  Requires: ${preset.requiredArtifacts.map((a) => `${a.type}${a.status ? `(${a.status})` : ''}`).join(', ')}`)
      }

      // Show step summary
      for (const step of preset.steps) {
        const marker = step.isMandatory ? '●' : '○'
        const gate = step.verificationGate ? ` ⊓ ${step.verificationGate}` : ''
        console.log(`    ${marker} ${step.stepId}: ${step.action}${gate}`)
      }
    }

    console.log('\n═══════════════════════════════════════════════════════')
    console.log('\nUsage: scale workflow show <preset-id>')
  },
})

const workflow = defineCommand({
  meta: { name: 'workflow', description: 'Workflow preset management' },
  subCommands: { list: workflowList },
})

const evidenceList = defineCommand({
  meta: { name: 'list', description: 'List persisted gate evidence records' },
  args: {
    limit: { type: 'string', default: '20', description: 'Maximum number of records' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const store = new EvidenceStore(SCALE_DIR)
    const records = store.listGateResults(parseInt(args.limit, 10) || 20)
    if (args.json) {
      console.log(JSON.stringify(records, null, 2))
      return
    }
    if (records.length === 0) {
      console.log('No evidence records found.')
      return
    }
    console.log('\nSCALE Evidence Records')
    for (const record of records) {
      const status = record.passed ? 'PASS' : record.status
      const blockers = record.blockers.length > 0 ? ` blockers=${record.blockers.length}` : ''
      console.log(`  ${record.id}  ${record.gate}  ${status}  ${new Date(record.createdAt).toISOString()}${blockers}`)
    }
    console.log('\nUsage: scale evidence show <id>')
  },
})

const evidenceShow = defineCommand({
  meta: { name: 'show', description: 'Show a persisted gate evidence record' },
  args: {
    id: { type: 'positional', required: true },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const store = new EvidenceStore(SCALE_DIR)
    const record = store.getGateResult(args.id)
    if (!record) {
      console.error(`Evidence record not found: ${args.id}`)
      process.exit(1)
    }
    if (args.json) {
      console.log(JSON.stringify(record, null, 2))
      return
    }
    console.log(`\nEvidence: ${record.id}`)
    console.log(`Gate: ${record.gate}`)
    console.log(`Status: ${record.status}`)
    console.log(`Passed: ${record.passed}`)
    console.log(`Created: ${new Date(record.createdAt).toISOString()}`)
    console.log(`Duration: ${record.durationMs}ms`)
    if (record.blockers.length > 0) {
      console.log('\nBlockers:')
      for (const blocker of record.blockers) console.log(`  - ${blocker}`)
    }
    console.log('\nEvidence Items:')
    for (const item of record.evidenceItems) {
      const status = item.passed ? 'PASS' : 'FAIL'
      const target = item.command ?? item.path ?? ''
      console.log(`  - [${status}] ${item.label}${target ? ` (${target})` : ''}`)
      console.log(`    ${item.detail}`)
    }
  },
})

const evidence = defineCommand({
  meta: { name: 'evidence', description: 'Persisted gate evidence inspection' },
  subCommands: { list: evidenceList, show: evidenceShow },
})

// ============================================================================
// runtime command - session ledger + completion evidence
// ============================================================================

function normalizeRuntimeEvidenceKind(value: unknown): RuntimeEvidenceKind {
  const normalized = String(value ?? 'command').trim()
  const allowed: RuntimeEvidenceKind[] = ['command', 'gate', 'tool', 'skill', 'mcp', 'browser', 'desktop', 'manual', 'final-report']
  if (allowed.includes(normalized as RuntimeEvidenceKind)) return normalized as RuntimeEvidenceKind
  throw new Error(`Invalid runtime evidence kind "${normalized}"; expected ${allowed.join(', ')}.`)
}

function normalizeRuntimeEvidenceStatus(value: unknown): RuntimeEvidenceStatus {
  const normalized = String(value ?? '').trim()
  if (normalized === 'passed' || normalized === 'failed' || normalized === 'skipped') return normalized
  throw new Error(`Invalid runtime evidence status "${normalized}"; expected passed, failed, or skipped.`)
}

function normalizeRuntimeSessionStatus(value: unknown): RuntimeSessionStatus {
  const normalized = String(value ?? 'completed').trim()
  if (normalized === 'active' || normalized === 'completed' || normalized === 'failed' || normalized === 'abandoned') return normalized
  throw new Error(`Invalid runtime session status "${normalized}"; expected active, completed, failed, or abandoned.`)
}

const runtimeStart = defineCommand({
  meta: { name: 'start', description: 'Start a runtime session ledger' },
  args: {
    'session-id': { type: 'string', description: 'Session id; generated when omitted' },
    'task-id': { type: 'string', description: 'Task id linked to this session' },
    agent: { type: 'string', description: 'Agent name' },
    level: { type: 'string', default: 'M', description: 'Task level: S, M, L, or CRITICAL' },
    summary: { type: 'string', description: 'Short session summary' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const ledger = new SessionLedger({ projectDir: PROJECT_DIR, scaleDir: SCALE_DIR })
    const session = ledger.start({
      sessionId: args['session-id'],
      taskId: args['task-id'],
      agent: args.agent,
      level: normalizeTaskArtifactLevel(args.level),
      summary: args.summary,
    })
    if (args.json) {
      console.log(JSON.stringify(session, null, 2))
      return
    }
    console.log(`Runtime session started: ${session.sessionId}`)
    if (session.taskId) console.log(`  Task: ${session.taskId}`)
    if (session.level) console.log(`  Level: ${session.level}`)
    console.log(`  Events: ${ledger.sessionFile(session.sessionId)}`)
  },
})

const runtimeEnd = defineCommand({
  meta: { name: 'end', description: 'End the current or named runtime session' },
  args: {
    'session-id': { type: 'string', description: 'Session id; current session is used when omitted' },
    status: { type: 'string', default: 'completed', description: 'completed, failed, or abandoned' },
    summary: { type: 'string', description: 'Completion summary' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const ledger = new SessionLedger({ projectDir: PROJECT_DIR, scaleDir: SCALE_DIR })
    const sessionId = args['session-id'] ?? ledger.current()?.sessionId
    if (!sessionId) {
      console.error('No runtime session id provided and no current runtime session exists.')
      process.exit(1)
    }
    const session = ledger.end(sessionId, normalizeRuntimeSessionStatus(args.status), args.summary)
    if (args.json) {
      console.log(JSON.stringify(session, null, 2))
      return
    }
    console.log(`Runtime session ended: ${session.sessionId}`)
    console.log(`  Status: ${session.status}`)
  },
})

const runtimeRecord = defineCommand({
  meta: { name: 'record', description: 'Record command, gate, tool, browser, skill, or manual runtime evidence' },
  args: {
    'task-id': { type: 'string', description: 'Task id linked to this evidence' },
    'session-id': { type: 'string', description: 'Session id linked to this evidence' },
    kind: { type: 'string', default: 'command', description: 'command, gate, tool, skill, mcp, browser, desktop, manual, final-report' },
    title: { type: 'string', required: true, description: 'Evidence title' },
    status: { type: 'string', required: true, description: 'passed, failed, or skipped' },
    command: { type: 'string', description: 'Exact command or tool invocation, with secrets redacted by SCALE' },
    'exit-code': { type: 'string', description: 'Exit code when applicable' },
    summary: { type: 'string', required: true, description: 'Short output summary' },
    artifacts: { type: 'string', description: 'Comma-separated artifact paths' },
    'metadata-json': { type: 'string', default: '{}', description: 'Additional JSON metadata' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const current = new SessionLedger({ projectDir: PROJECT_DIR, scaleDir: SCALE_DIR }).current()
    let metadata: Record<string, unknown> = {}
    try {
      metadata = JSON.parse(String(args['metadata-json'] ?? '{}')) as Record<string, unknown>
    } catch {
      console.error('--metadata-json must be valid JSON.')
      process.exit(1)
    }
    const exitCode = args['exit-code'] === undefined || args['exit-code'] === ''
      ? undefined
      : Number.parseInt(String(args['exit-code']), 10)
    if (exitCode !== undefined && Number.isNaN(exitCode)) {
      console.error('--exit-code must be a number.')
      process.exit(1)
    }
    const ledger = new RuntimeEvidenceLedger({ projectDir: PROJECT_DIR, scaleDir: SCALE_DIR })
    const record = ledger.record({
      taskId: args['task-id'] ?? current?.taskId,
      sessionId: args['session-id'] ?? current?.sessionId,
      kind: normalizeRuntimeEvidenceKind(args.kind),
      title: args.title,
      status: normalizeRuntimeEvidenceStatus(args.status),
      command: args.command,
      exitCode,
      summary: args.summary,
      artifacts: parseCommaList(args.artifacts),
      metadata,
    })
    if (record.sessionId) {
      new SessionLedger({ projectDir: PROJECT_DIR, scaleDir: SCALE_DIR }).append(record.sessionId, {
        type: 'evidence.recorded',
        message: `${record.status}: ${record.title}`,
        data: {
          evidenceId: record.id,
          kind: record.kind,
          taskId: record.taskId,
        },
      })
    }
    if (args.json) {
      console.log(JSON.stringify(record, null, 2))
      return
    }
    console.log(`Runtime evidence recorded: ${record.id}`)
    console.log(`  Status: ${record.status}`)
    console.log(`  Kind: ${record.kind}`)
    if (record.redactionApplied) console.log('  Redaction: applied')
  },
})

const runtimeDoctor = defineCommand({
  meta: { name: 'doctor', description: 'Check runtime session and completion evidence' },
  args: {
    'task-id': { type: 'string', description: 'Task id to inspect' },
    'session-id': { type: 'string', description: 'Session id to inspect' },
    level: { type: 'string', default: 'M', description: 'Task level: S, M, L, or CRITICAL' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const report = doctorRuntimeEvidence({
      projectDir: PROJECT_DIR,
      scaleDir: SCALE_DIR,
      taskId: args['task-id'],
      sessionId: args['session-id'],
      level: normalizeTaskArtifactLevel(args.level),
    })
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
      if (report.blocked) process.exitCode = 1
      return
    }
    console.log('\nSCALE Runtime Doctor')
    console.log(`  Evidence: ${report.evidence.total} total, ${report.evidence.passed} passed, ${report.evidence.failed} failed, ${report.evidence.skipped} skipped`)
    for (const check of report.checks) {
      console.log(`  [${check.status.toUpperCase()}] ${check.name}: ${check.message}`)
      if (check.fix) console.log(`    Fix: ${check.fix}`)
    }
    if (report.blocked) process.exitCode = 1
  },
})

const runtimeFinalCheck = defineCommand({
  meta: { name: 'final-check', description: 'Block final delivery claims without passed runtime evidence' },
  args: {
    'task-id': { type: 'string', description: 'Task id to inspect' },
    'session-id': { type: 'string', description: 'Session id to inspect' },
    level: { type: 'string', default: 'M', description: 'Task level: S, M, L, or CRITICAL' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const readiness = evaluateFinalReportReadiness({
      projectDir: PROJECT_DIR,
      scaleDir: SCALE_DIR,
      taskId: args['task-id'],
      sessionId: args['session-id'],
      level: normalizeTaskArtifactLevel(args.level),
    })
    if (args.json) {
      console.log(JSON.stringify(readiness, null, 2))
      if (readiness.blocked) process.exitCode = 1
      return
    }
    console.log('\nSCALE Runtime Final Check')
    console.log(`  Ready: ${readiness.ready}`)
    for (const reason of readiness.reasons) console.log(`  [BLOCKER] ${reason}`)
    if (readiness.blocked) process.exitCode = 1
  },
})

const runtime = defineCommand({
  meta: { name: 'runtime', description: 'Runtime session ledger and completion evidence governance' },
  subCommands: {
    start: runtimeStart,
    end: runtimeEnd,
    record: runtimeRecord,
    doctor: runtimeDoctor,
    'final-check': runtimeFinalCheck,
  },
})

// ============================================================================
// memory command - runtime evidence + knowledge + graph context packs
// ============================================================================

function parseMemoryBudget(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number.parseInt(String(value), 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error('--budget must be a positive integer.')
  }
  return parsed
}

const memoryPack = defineCommand({
  meta: { name: 'pack', description: 'Build a compact context pack from runtime evidence, session events, knowledge, and graph status' },
  args: {
    task: { type: 'string', required: true, description: 'Current task or question' },
    'task-id': { type: 'string', description: 'Task id to scope evidence and session data' },
    'session-id': { type: 'string', description: 'Session id to scope session events' },
    level: { type: 'string', default: 'M', description: 'Task level: S, M, L, or CRITICAL' },
    files: { type: 'string', description: 'Comma-separated files or modules in scope' },
    budget: { type: 'string', description: 'Maximum estimated tokens for the context pack' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    let budgetTokens: number | undefined
    try {
      budgetTokens = parseMemoryBudget(args.budget)
    } catch (e) {
      console.error((e as Error).message)
      process.exit(1)
    }
    const { kb } = getEngine()
    const pack = await new MemoryFabric({
      projectDir: PROJECT_DIR,
      scaleDir: SCALE_DIR,
      knowledgeBase: kb,
    }).createContextPack({
      task: args.task,
      taskId: args['task-id'],
      sessionId: args['session-id'],
      level: normalizeTaskArtifactLevel(args.level),
      files: parseCommaList(args.files),
      budgetTokens,
    })
    if (args.json) {
      console.log(JSON.stringify(pack, null, 2))
      return
    }
    console.log(renderContextPackMarkdown(pack))
  },
})

const memoryDoctor = defineCommand({
  meta: { name: 'doctor', description: 'Check whether a task context pack is available and within token budget' },
  args: {
    task: { type: 'string', required: true, description: 'Current task or question' },
    'task-id': { type: 'string', description: 'Task id to scope evidence and session data' },
    'session-id': { type: 'string', description: 'Session id to scope session events' },
    level: { type: 'string', default: 'M', description: 'Task level: S, M, L, or CRITICAL' },
    files: { type: 'string', description: 'Comma-separated files or modules in scope' },
    budget: { type: 'string', description: 'Maximum estimated tokens for the context pack' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    let budgetTokens: number | undefined
    try {
      budgetTokens = parseMemoryBudget(args.budget)
    } catch (e) {
      console.error((e as Error).message)
      process.exit(1)
    }
    const { kb } = getEngine()
    const report = await doctorMemoryFabric({
      projectDir: PROJECT_DIR,
      scaleDir: SCALE_DIR,
      knowledgeBase: kb,
    }, {
      task: args.task,
      taskId: args['task-id'],
      sessionId: args['session-id'],
      level: normalizeTaskArtifactLevel(args.level),
      files: parseCommaList(args.files),
      budgetTokens,
    })
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
      if (!report.ok) process.exitCode = 1
      return
    }
    console.log('\nSCALE Memory Doctor')
    console.log(`  Budget: ${report.pack.budget.used}/${report.pack.budget.limit} estimated tokens`)
    for (const check of report.checks) {
      console.log(`  [${check.status.toUpperCase()}] ${check.name}: ${check.message}`)
    }
    if (!report.ok) process.exitCode = 1
  },
})

const memorySettle = defineCommand({
  meta: { name: 'settle', description: 'Settle runtime evidence into a reviewable memory learning candidate' },
  args: {
    task: { type: 'string', required: true, description: 'Current task or question' },
    'task-id': { type: 'string', description: 'Task id to scope evidence and session data' },
    'session-id': { type: 'string', description: 'Session id to scope session events' },
    level: { type: 'string', default: 'M', description: 'Task level: S, M, L, or CRITICAL' },
    files: { type: 'string', description: 'Comma-separated files or modules in scope' },
    budget: { type: 'string', description: 'Maximum estimated tokens for the context pack' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    let budgetTokens: number | undefined
    try {
      budgetTokens = parseMemoryBudget(args.budget)
    } catch (e) {
      console.error((e as Error).message)
      process.exit(1)
    }
    const { kb } = getEngine()
    const pack = await new MemoryFabric({
      projectDir: PROJECT_DIR,
      scaleDir: SCALE_DIR,
      knowledgeBase: kb,
    }).createContextPack({
      task: args.task,
      taskId: args['task-id'],
      sessionId: args['session-id'],
      level: normalizeTaskArtifactLevel(args.level),
      files: parseCommaList(args.files),
      budgetTokens,
    })
    const settlement = settleMemoryLearning({
      projectDir: PROJECT_DIR,
      scaleDir: SCALE_DIR,
      pack,
    })
    if (args.json) {
      console.log(JSON.stringify(settlement, null, 2))
      return
    }
    console.log(renderMemoryLearningCandidateMarkdown(settlement.candidate))
    console.log(`\nWrote: ${settlement.files.markdown}`)
  },
})

const memory = defineCommand({
  meta: { name: 'memory', description: 'Memory Fabric context packs and budget diagnostics' },
  subCommands: { pack: memoryPack, doctor: memoryDoctor, settle: memorySettle },
})

// ============================================================================
// out-of-scope command — 借鉴 mattpocock/skills 的 .out-of-scope/ 设计
// ============================================================================

const outOfScopeAdd = defineCommand({
  meta: { name: 'add', description: 'Record a rejected concept to the out-of-scope knowledge base' },
  args: {
    concept: { type: 'positional', required: true, description: 'kebab-case concept name' },
    title: { type: 'string', required: true, description: 'Human-readable title' },
    reason: { type: 'string', required: true, description: 'Why this was rejected' },
    'tech-context': { type: 'string', description: 'Technical constraints that led to rejection' },
    'prior-requests': { type: 'string', description: 'Comma-separated issue IDs or URLs' },
  },
  run({ args }) {
    ensureDir(SCALE_DIR)
    const store = new OutOfScopeStore(SCALE_DIR)
    const entry = store.add({
      concept: args.concept,
      title: args.title,
      reason: args.reason,
      technicalContext: args['tech-context'],
      priorRequests: args['prior-requests']?.split(',').map(s => s.trim()) ?? [],
    })
    console.log(JSON.stringify({ ok: true, concept: entry.concept, title: entry.title, priorRequests: entry.priorRequests.length }, null, 2))
  },
})

const outOfScopeCheck = defineCommand({
  meta: { name: 'check', description: 'Check if a concept matches any existing out-of-scope entry' },
  args: {
    concept: { type: 'positional', required: true, description: 'Concept name to check' },
    description: { type: 'string', description: 'Optional description for fuzzy matching' },
  },
  run({ args }) {
    ensureDir(SCALE_DIR)
    const store = new OutOfScopeStore(SCALE_DIR)
    const match = store.check(args.concept, args.description)
    if (match) {
      console.log(JSON.stringify({ ok: true, matched: true, concept: match.concept, title: match.title, reason: match.reason, priorRequests: match.priorRequests }, null, 2))
    } else {
      console.log(JSON.stringify({ ok: true, matched: false }, null, 2))
    }
  },
})

const outOfScopeList = defineCommand({
  meta: { name: 'list', description: 'List all out-of-scope entries' },
  run() {
    ensureDir(SCALE_DIR)
    const store = new OutOfScopeStore(SCALE_DIR)
    const entries = store.list()
    console.log(JSON.stringify({ ok: true, total: entries.length, entries: entries.map(e => ({ concept: e.concept, title: e.title, priorRequests: e.priorRequests.length, updatedAt: new Date(e.updatedAt).toISOString() })) }, null, 2))
  },
})

const outOfScopeRemove = defineCommand({
  meta: { name: 'remove', description: 'Remove an out-of-scope entry (concept reconsidered)' },
  args: {
    concept: { type: 'positional', required: true, description: 'Concept name to remove' },
  },
  run({ args }) {
    ensureDir(SCALE_DIR)
    const store = new OutOfScopeStore(SCALE_DIR)
    const removed = store.remove(args.concept)
    console.log(JSON.stringify({ ok: removed, concept: args.concept }, null, 2))
  },
})

const outOfScope = defineCommand({
  meta: { name: 'out-of-scope', description: 'Manage out-of-scope knowledge base (rejected concepts with institutional memory)' },
  subCommands: { add: outOfScopeAdd, check: outOfScopeCheck, list: outOfScopeList, remove: outOfScopeRemove },
})

// ============================================================================
// skill command — 技能发现
// ============================================================================

const skillScan = defineCommand({
  meta: { name: 'scan', description: 'Scan for installed skills' },
  args: {
    dir: { type: 'string', default: '.', description: 'Project directory' },
    json: { type: 'boolean', default: false, description: 'Output scan result as JSON' },
  },
  async run({ args }) {
    const discovery = new SkillDiscovery(args.dir)
    const platform = discovery.detectPlatform()
    if (!platform && args.json) {
      console.log(JSON.stringify({
        ok: false,
        platform: null,
        skills: [],
        message: 'No agent platform detected. Run `scale init` first.',
      }, null, 2))
      return
    }

    if (!platform) {
      console.log('\n⚠️  No agent platform detected. Run `scale init` first.')
      return
    }

    const result = discovery.scanSkills(platform)
    if (args.json) {
      console.log(JSON.stringify({
        ok: true,
        platform: result.platform,
        count: result.skills.length,
        skills: result.skills,
      }, null, 2))
      return
    }
    console.log(`\n🔍 Platform: ${result.platform}`)
    console.log(`📦 Skills found: ${result.skills.length}`)

    if (result.skills.length > 0) {
      for (const skill of result.skills) {
        const status = skill.enabled ? '✅' : '❌'
        const desc = skill.description ? ` — ${skill.description}` : ''
        console.log(`  ${status} ${skill.name}${desc}`)
      }
    } else {
      console.log('  No skills found in platform skills directory.')
    }
  },
})

const skillPlanCommand = defineCommand({
  meta: { name: 'plan', description: 'Create or refresh a task skill plan' },
  args: {
    'task-id': { type: 'positional', required: true },
    dir: { type: 'string', description: 'Task artifact directory; defaults to current state artifactsDir' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const { store } = getEngine()
    const task = await store.get(args['task-id'])
    if (!task || task.type !== 'Task') {
      console.error(`Task not found: ${args['task-id']}`)
      process.exit(1)
    }

    const payload = task.payload as TaskPayload
    const level = normalizeTaskArtifactLevel(payload.workflowLevel ?? 'M')
    const policy = loadSkillRoutingPolicy(PROJECT_DIR, SCALE_DIR)
    const plan = createSkillPlan({
      taskId: task.id,
      taskName: task.title,
      description: payload.description,
      level,
      services: payload.servicesTouched ?? [],
      files: payload.filesInvolved ?? [],
      policy,
    })
    const updatedPayload: TaskPayload = {
      ...payload,
      skillIntents: plan.intents.map(intent => intent.domain),
      skillRoutingMode: plan.mode,
      skillPlanRequired: plan.required,
      requiredSkills: plan.requiredSkills,
      recommendedSkills: plan.recommendedSkills,
      requiredSkillArtifacts: plan.requiredArtifacts,
      requiredSkillVerification: plan.requiredVerification,
    }
    await store.update(task.id, { payload: updatedPayload })

    const state = new WorkflowArtifactWriter(SCALE_DIR).readCurrentState()
    const artifactsDir = args.dir ?? (state?.taskId === task.id ? state.artifactsDir : undefined)
    let writtenPath: string | undefined
    if (artifactsDir) {
      const dir = resolve(PROJECT_DIR, artifactsDir)
      ensureDir(dir)
      writtenPath = join(dir, 'skill-plan.md')
      writeFileSync(writtenPath, skillPlanMarkdown(plan), 'utf-8')
    }
    new WorkflowArtifactWriter(SCALE_DIR).updateCurrentState({
      taskId: task.id,
      level,
      phase: 'plan',
      artifactsDir,
      skillIntents: plan.intents.map(intent => intent.domain),
      skillRoutingMode: plan.mode,
      skillPlanRequired: plan.required,
      skillPlanPath: writtenPath,
      requiredSkills: plan.requiredSkills,
      recommendedSkills: plan.recommendedSkills,
      requiredSkillArtifacts: plan.requiredArtifacts,
      requiredSkillVerification: plan.requiredVerification,
    })

    if (args.json) {
      console.log(JSON.stringify({ plan, writtenPath }, null, 2))
      return
    }
    console.log('\nSkill Plan')
    console.log(`  Task: ${task.id}`)
    console.log(`  Intents: ${plan.intents.map(intent => intent.domain).join(', ') || 'none'}`)
    console.log(`  Required skills: ${plan.requiredSkills.join(', ') || 'none'}`)
    console.log(`  Recommended skills: ${plan.recommendedSkills.join(', ') || 'none'}`)
    console.log(`  Required artifacts: ${plan.requiredArtifacts.join(', ') || 'none'}`)
    if (writtenPath) console.log(`  Written: ${writtenPath}`)
  },
})

const skillDoctorCommand = defineCommand({
  meta: { name: 'doctor', description: 'Check workflow skill installation status' },
  args: {
    dir: { type: 'string', default: '.', description: 'Project directory' },
    json: { type: 'boolean', default: false, description: 'Output skill doctor report as JSON' },
  },
  run({ args }) {
    const report = inspectWorkflowSkills({ projectDir: args.dir })
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
      return
    }
    console.log('\nSCALE Skill Doctor')
    console.log(`  Installed: ${report.installed}/${report.total}`)
    for (const skill of report.skills) {
      console.log(`  ${skill.installed ? '[OK]' : '[MISSING]'} ${skill.id}`)
      if (skill.detectedPath) console.log(`    path: ${skill.detectedPath}`)
      if (!skill.installed) console.log(`    install: ${skill.installCommand}`)
    }
    if (!report.ok) process.exitCode = 1
  },
})

const skillCheckCommand = defineCommand({
  meta: { name: 'check', description: 'Check required skill evidence artifacts' },
  args: {
    dir: { type: 'string', description: 'Task artifact directory; defaults to current state artifactsDir' },
    level: { type: 'string', description: 'Task level: S, M, L, or CRITICAL; defaults to current state level or M' },
    'require-installed': { type: 'boolean', default: false, description: 'Fail when required workflow skills are not installed locally' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const state = new WorkflowArtifactWriter(SCALE_DIR).readCurrentState()
    const level = normalizeTaskArtifactLevel(args.level ?? state?.level ?? 'M')
    const policy = loadSkillRoutingPolicy(PROJECT_DIR, SCALE_DIR)
    const result = evaluateSkillGate({
      projectDir: PROJECT_DIR,
      artifactsDir: args.dir ?? state?.artifactsDir,
      level,
      requiredArtifacts: state?.requiredSkillArtifacts,
      requiredSkills: state?.requiredSkills,
      mode: state?.skillRoutingMode ?? policy.policy.mode,
      enforceLevels: policy.policy.enforceLevels,
    })
    const skillInstallation = inspectRequiredWorkflowSkills(state?.requiredSkills ?? [], { projectDir: PROJECT_DIR })
    const requireInstalled = isTruthyFlag(args['require-installed'])
    const blocked = result.blocked || (requireInstalled && !skillInstallation.ok)
    const output = {
      ...result,
      complete: result.complete && (!requireInstalled || skillInstallation.ok),
      blocked,
      skillInstallation: {
        ...skillInstallation,
        checked: requireInstalled,
      },
    }

    if (args.json) {
      console.log(JSON.stringify(output, null, 2))
      return
    }
    console.log(`\nSkill Gate: ${output.complete ? 'COMPLETE' : 'INCOMPLETE'}`)
    console.log(`  Mode: ${output.mode}`)
    console.log(`  Required artifacts: ${output.required.join(', ') || 'none'}`)
    console.log(`  Required skills: ${skillInstallation.required.join(', ') || 'none'}`)
    for (const file of output.missing) console.log(`  [MISSING] ${file}`)
    for (const item of output.incomplete) console.log(`  [INCOMPLETE] ${item.file}: ${item.reason}`)
    if (requireInstalled && !skillInstallation.ok) {
      for (const skill of skillInstallation.skills.filter(skill => !skill.installed)) {
        console.log(`  [MISSING_SKILL] ${skill.id}: ${skill.installCommand}`)
      }
      for (const skill of skillInstallation.unknown) console.log(`  [UNKNOWN_SKILL] ${skill}`)
    }
    if (blocked) process.exitCode = 1
  },
})

const skillRepoCommand = defineCommand({
  meta: { name: 'repo', description: 'Show SCALE progressive skill repository guide' },
  args: {
    category: { type: 'string', description: 'Filter by category: ui/browser/desktop/testing/review/docs/agent-cli/role-library/discovery' },
    output: { type: 'string', alias: 'o', description: 'Write markdown guide to file' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    if (args.json) {
      console.log(JSON.stringify(listSkillRepositoryEntries(args.category ? { category: args.category as never } : undefined), null, 2))
      return
    }
    const markdown = renderSkillRepositoryMarkdown()
    if (args.output) {
      const outputPath = resolve(PROJECT_DIR, args.output)
      ensureDir(resolve(outputPath, '..'))
      writeFileSync(outputPath, markdown, 'utf-8')
      console.log(`[OK] Skill 仓库指南已生成: ${outputPath}`)
      return
    }
    console.log(markdown)
  },
})

const skillSafetyCommand = defineCommand({
  meta: { name: 'safety', description: 'Evaluate skill install command and source safety' },
  args: {
    source: { type: 'string', description: 'Skill source URL' },
    command: { type: 'string', description: 'Install command to review' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const report = evaluateSkillInstallSafety({
      sourceUrl: args.source,
      installCommand: args.command,
    })
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
      return
    }
    console.log('\nSCALE Skill Safety')
    console.log(`  Risk: ${report.risk}`)
    console.log(`  Blocked: ${report.blocked}`)
    for (const finding of report.findings) {
      console.log(`  [${finding.severity.toUpperCase()}] ${finding.rule}: ${finding.message}`)
    }
    console.log('  Required checks:')
    for (const check of report.requiredChecks) console.log(`  - ${check}`)
    if (report.blocked) process.exitCode = 1
  },
})

const skillRecommendCommand = defineCommand({
  meta: { name: 'recommend', description: 'Recommend a composable skill workflow for a task' },
  args: {
    task: { type: 'string', required: true, description: 'Task description' },
    phase: { type: 'string', description: 'Workflow phase' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const plan = recommendSkillWorkflow({
      description: args.task,
      phase: args.phase,
    })
    if (args.json) {
      console.log(JSON.stringify(plan, null, 2))
      return
    }
    console.log('\nSCALE Skill Recommendation')
    console.log(`  Primary: ${plan.primarySkills.join(', ') || 'none'}`)
    console.log(`  Supporting: ${plan.supportingSkills.join(', ') || 'none'}`)
    console.log(`  Safety required: ${plan.safetyRequired}`)
    console.log(`  Evidence: ${plan.requiredEvidence.join(', ') || 'none'}`)
    for (const reason of plan.rationale) console.log(`  - ${reason}`)
  },
})

const skill = defineCommand({
  meta: { name: 'skill', description: 'Skill discovery and management' },
  subCommands: {
    scan: skillScan,
    doctor: skillDoctorCommand,
    plan: skillPlanCommand,
    check: skillCheckCommand,
    repo: skillRepoCommand,
    safety: skillSafetyCommand,
    recommend: skillRecommendCommand,
  },
})

// ============================================================================
// tool command - Skills/MCP/CLI orchestration governance
// ============================================================================

function normalizeToolMode(value: unknown): ToolOrchestrationMode {
  const normalized = String(value ?? 'evidence-required')
  if (normalized === 'off' || normalized === 'advisory' || normalized === 'evidence-required' || normalized === 'block') return normalized
  return 'evidence-required'
}

function parseToolIds(value: unknown): string[] | undefined {
  const raw = String(value ?? '').trim()
  if (!raw) return undefined
  return raw.split(',').map(item => item.trim()).filter(Boolean)
}

function parseCommaList(value: unknown): string[] {
  return parseToolIds(value) ?? []
}

function createToolExecutionPlanFromArgs(args: Record<string, unknown>) {
  const projectDir = resolve(String(args.dir ?? PROJECT_DIR))
  const level = normalizeTaskArtifactLevel(args.level ?? 'M')
  const skillPolicy = loadSkillRoutingPolicy(projectDir, SCALE_DIR)
  const skillPlan = createSkillPlan({
    taskId: String(args['task-id'] ?? `TOOL-${Date.now()}`),
    taskName: String(args.task ?? 'Tool orchestration task'),
    description: String(args.task ?? ''),
    level,
    files: parseCommaList(args.files),
    services: parseCommaList(args.services),
    policy: skillPolicy,
  })
  const toolPolicy = loadToolPolicy(projectDir, SCALE_DIR)
  const toolIds = uniqueStrings([
    ...skillPlan.requiredSkills,
    ...skillPlan.recommendedSkills,
    ...Object.keys(toolPolicy.tools).filter(toolId => {
      const config = toolPolicy.tools[toolId]
      const domains = new Set(skillPlan.intents.map(intent => intent.domain))
      return config.enabled && (
        config.requiredFor.some(domain => domains.has(domain)) ||
        (config.recommendedFor ?? []).some(domain => domains.has(domain))
      )
    }),
  ])
  const capabilityReport = inspectToolCapabilities({
    projectDir,
    toolIds,
  })
  const orchestrator = new ToolOrchestrator({
    projectDir,
    policy: toolPolicy,
    capabilityReport,
    evidenceStore: new ToolEvidenceStore({ projectDir, scaleDir: SCALE_DIR }),
  })
  return {
    projectDir,
    skillPlan,
    orchestrator,
    plan: orchestrator.plan({ skillPlan }),
    capabilityReport,
  }
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items)]
}

const toolPolicyCommand = defineCommand({
  meta: { name: 'policy', description: 'Show resolved tool orchestration policy' },
  args: {
    dir: { type: 'string', default: '.', description: 'Project directory' },
    mode: { type: 'string', description: 'Render a starter policy mode instead of reading .scale/tools.json' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const policy: ResolvedToolPolicy = args.mode
      ? JSON.parse(toolPolicyTemplate(normalizeToolMode(args.mode))) as ResolvedToolPolicy
      : loadToolPolicy(args.dir, SCALE_DIR)
    if (args.json) {
      console.log(JSON.stringify(policy, null, 2))
      return
    }
    console.log('\nSCALE Tool Policy')
    console.log(`  Mode: ${policy.mode}`)
    console.log(`  Tools: ${Object.keys(policy.tools).length}`)
    for (const [id, config] of Object.entries(policy.tools)) {
      const state = config.enabled ? '[ON]' : '[OFF]'
      console.log(`  ${state} ${id}: requiredFor=${config.requiredFor.join(',') || 'none'}`)
    }
  },
})

const toolDoctorCommand = defineCommand({
  meta: { name: 'doctor', description: 'Check skill, MCP, and CLI tool availability' },
  args: {
    dir: { type: 'string', default: '.', description: 'Project directory' },
    tools: { type: 'string', description: 'Comma-separated tool ids to check' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const report = inspectToolCapabilities({
      projectDir: args.dir,
      toolIds: parseToolIds(args.tools),
    })
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      console.log('\nSCALE Tool Doctor')
      console.log(`  Installed: ${report.summary.installed}/${report.summary.total}`)
      for (const entry of report.tools) {
        console.log(`  ${entry.installed ? '[OK]' : '[MISSING]'} ${entry.id}`)
        if (entry.detectedPath) console.log(`    path: ${entry.detectedPath}`)
        if (entry.version) console.log(`    version: ${entry.version}`)
        if (entry.missingReason) console.log(`    reason: ${entry.missingReason}`)
      }
    }
    if (!report.ok) process.exitCode = 1
  },
})

const toolPlanCommand = defineCommand({
  meta: { name: 'plan', description: 'Create a tool execution plan from task intent' },
  args: {
    dir: { type: 'string', default: '.', description: 'Project directory' },
    'task-id': { type: 'string', required: true, description: 'Task id for evidence linkage' },
    task: { type: 'string', required: true, description: 'Task description' },
    level: { type: 'string', default: 'M', description: 'Task level: S, M, L, or CRITICAL' },
    files: { type: 'string', description: 'Comma-separated changed or target files' },
    services: { type: 'string', description: 'Comma-separated affected services' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const result = createToolExecutionPlanFromArgs(args)
    if (args.json) {
      console.log(JSON.stringify(result.plan, null, 2))
      return
    }
    console.log('\nSCALE Tool Plan')
    console.log(`  Task: ${result.plan.taskId}`)
    console.log(`  Mode: ${result.plan.mode}`)
    console.log(`  Steps: ${result.plan.steps.length}`)
    for (const step of result.plan.steps) {
      console.log(`  ${step.status === 'ready' ? '[READY]' : '[MISSING]'} ${step.toolId} (${step.adapter}) required=${step.required}`)
    }
    for (const blocker of result.plan.blockers) console.log(`  [BLOCKER] ${blocker}`)
    for (const warning of result.plan.warnings) console.log(`  [WARN] ${warning}`)
  },
})

const toolRunCommand = defineCommand({
  meta: { name: 'run', description: 'Run or dry-run a tool execution plan and write tool evidence' },
  args: {
    dir: { type: 'string', default: '.', description: 'Project directory' },
    'task-id': { type: 'string', required: true, description: 'Task id for evidence linkage' },
    task: { type: 'string', required: true, description: 'Task description' },
    level: { type: 'string', default: 'M', description: 'Task level: S, M, L, or CRITICAL' },
    files: { type: 'string', description: 'Comma-separated changed or target files' },
    services: { type: 'string', description: 'Comma-separated affected services' },
    'dry-run': { type: 'boolean', default: false, description: 'Plan and record skipped evidence without executing tools' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const result = createToolExecutionPlanFromArgs(args)
    const report = await result.orchestrator.run(result.plan, {
      dryRun: isTruthyFlag(args['dry-run']),
    })
    if (toolEvidenceRunCompletesOpenTask(report)) {
      const writer = new WorkflowArtifactWriter(SCALE_DIR)
      const current = writer.readCurrentState()
      if (current?.taskId === report.taskId) {
        writer.updateCurrentState({
          taskId: report.taskId,
          openTasks: removeWorkflowOpenTask(current.openTasks, 'tool-evidence'),
        })
      }
    }
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      console.log('\nSCALE Tool Run')
      console.log(`  Task: ${report.taskId}`)
      console.log(`  Dry-run: ${report.dryRun}`)
      console.log(`  Evidence: ${report.evidence.length}`)
      for (const record of report.evidence) {
        console.log(`  [${record.status.toUpperCase()}] ${record.tool} -> ${record.id}`)
      }
      for (const blocker of report.blockers) console.log(`  [BLOCKER] ${blocker}`)
      for (const warning of report.warnings) console.log(`  [WARN] ${warning}`)
    }
    if (!report.ok) process.exitCode = 1
  },
})

const toolEvidenceCommand = defineCommand({
  meta: { name: 'evidence', description: 'Check required tool execution evidence for a task' },
  args: {
    dir: { type: 'string', default: '.', description: 'Project directory' },
    'task-id': { type: 'string', required: true, description: 'Task id for evidence linkage' },
    task: { type: 'string', required: true, description: 'Task description' },
    level: { type: 'string', default: 'M', description: 'Task level: S, M, L, or CRITICAL' },
    files: { type: 'string', description: 'Comma-separated changed or target files' },
    services: { type: 'string', description: 'Comma-separated affected services' },
    mode: { type: 'string', description: 'Override tool gate mode: off, advisory, evidence-required, or block' },
    'allow-skipped': { type: 'boolean', default: false, description: 'Allow skipped/manual fallback evidence to satisfy required tools' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const result = createToolExecutionPlanFromArgs(args)
    const gate = evaluateToolEvidenceGate({
      projectDir: result.projectDir,
      level: normalizeTaskArtifactLevel(args.level ?? 'M'),
      plan: result.plan,
      evidenceStore: new ToolEvidenceStore({ projectDir: result.projectDir, scaleDir: SCALE_DIR }),
      mode: args.mode ? normalizeToolMode(args.mode) : result.plan.mode,
      allowSkipped: isTruthyFlag(args['allow-skipped']),
    })
    if (args.json) {
      console.log(JSON.stringify(gate, null, 2))
    } else {
      console.log('\nSCALE Tool Evidence Gate')
      console.log(`  Task: ${gate.taskId ?? args['task-id']}`)
      console.log(`  Mode: ${gate.mode}`)
      console.log(`  Complete: ${gate.complete}`)
      console.log(`  Required tools: ${gate.requiredTools.join(', ') || 'none'}`)
      for (const item of gate.missing) console.log(`  [MISSING] ${item.toolId}: ${item.reason}`)
      for (const item of gate.failed) console.log(`  [FAILED] ${item.toolId}: ${item.reason}`)
      for (const item of gate.skipped) console.log(`  [SKIPPED] ${item.toolId}: ${item.reason}`)
      for (const item of gate.passed) console.log(`  [PASS] ${item.toolId}: ${item.evidenceId ?? 'evidence'}`)
      for (const warning of gate.warnings) console.log(`  [WARN] ${warning}`)
    }
    if (gate.blocked) process.exitCode = 1
  },
})

const tool = defineCommand({
  meta: { name: 'tool', description: 'Skills, MCP, browser, desktop, and external CLI governance' },
  subCommands: { policy: toolPolicyCommand, doctor: toolDoctorCommand, plan: toolPlanCommand, run: toolRunCommand, evidence: toolEvidenceCommand },
})

// ============================================================================
// agent commands — Multi-Agent 协作系统 (Phase 9)
// ============================================================================

import { AgentPool } from '../agents/AgentPool.js'
import { PROFESSIONAL_AGENTS, getProfile, listProfiles } from '../agents/profiles.js'

const agentPool = new AgentPool()

const agentSpawn = defineCommand({
  meta: { name: 'spawn', description: 'Spawn a new agent instance' },
  args: {
    profile: { type: 'positional', required: true, description: 'Agent profile ID (e.g., frontend-agent)' },
  },
  async run({ args }) {
    const profile = getProfile(args.profile)
    if (!profile) {
      console.error(`Profile not found: ${args.profile}`)
      console.log(`Available profiles: ${listProfiles().join(', ')}`)
      process.exit(1)
    }
    const agent = agentPool.spawn(args.profile)
    console.log(JSON.stringify({ ok: true, agentId: agent.id, profile: agent.profile.name, status: agent.status }, null, 2))
  },
})

const agentList = defineCommand({
  meta: { name: 'list', description: 'List all agent instances' },
  args: {},
  async run() {
    const agents = agentPool.listAll()
    if (agents.length === 0) {
      console.log('No agent instances spawned.')
      return
    }
    console.log(`\n🤖 Agent Instances (${agents.length})`)
    console.log('──────────────────────────────────────────────')
    for (const a of agents) {
      const statusEmoji = { idle: '💤', running: '🔄', blocked: '🚫', completed: '✅', failed: '❌', recycled: '♻️' }[a.status]
      console.log(`  ${statusEmoji} ${a.id} (${a.profile.name})`)
      if (a.assignedTask) console.log(`     Task: ${a.assignedTask}`)
    }
  },
})

const agentProfiles = defineCommand({
  meta: { name: 'profiles', description: 'List available agent profiles' },
  args: {},
  async run() {
    console.log(`\n📋 Agent Profiles (${PROFESSIONAL_AGENTS.length})`)
    console.log('──────────────────────────────────────────────')
    for (const p of PROFESSIONAL_AGENTS) {
      const modelEmoji = { fast: '⚡', balanced: '⚖️', powerful: '🧠' }[p.preferredModel]
      console.log(`  ${modelEmoji} ${p.id} — ${p.name}`)
      console.log(`     Role: ${p.inheritsRole} · Domain: ${p.domain}`)
      console.log(`     Capabilities: ${p.capabilities.slice(0, 3).join(', ')}...`)
    }
  },
})

const agentLeaders = defineCommand({
  meta: { name: 'leaders', description: 'List SCALE leader presets such as CEO and CTO' },
  args: {
    output: { type: 'string', alias: 'o', description: 'Write markdown guide to file' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const presets = listLeadershipPresets()
    if (args.json) {
      console.log(JSON.stringify(presets, null, 2))
      return
    }
    const markdown = renderLeadershipPresetsMarkdown()
    if (args.output) {
      const outputPath = resolve(PROJECT_DIR, args.output)
      ensureDir(resolve(outputPath, '..'))
      writeFileSync(outputPath, markdown, 'utf-8')
      console.log(`[OK] 领导者角色指南已生成: ${outputPath}`)
      return
    }
    console.log(markdown)
  },
})

const agent = defineCommand({
  meta: { name: 'agent', description: 'Multi-Agent system management' },
  subCommands: { spawn: agentSpawn, list: agentList, profiles: agentProfiles, leaders: agentLeaders },
})

// ============================================================================
// team commands — 团队协作 (Phase 9)
// ============================================================================

const teamCreate = defineCommand({
  meta: { name: 'create', description: 'Create an agent team for a task' },
  args: {
    profiles: { type: 'string', required: true, description: 'Comma-separated profile IDs' },
    task: { type: 'string', description: 'Task description' },
  },
  async run({ args }) {
    const profileIds = args.profiles.split(',').map(p => p.trim())
    const agents = []
    for (const profileId of profileIds) {
      const profile = getProfile(profileId)
      if (!profile) {
        console.error(`Profile not found: ${profileId}`)
        process.exit(1)
      }
      agents.push(agentPool.spawn(profileId))
    }
    const teamId = `TEAM-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    console.log(JSON.stringify({
      ok: true,
      teamId,
      agents: agents.map(a => ({ id: a.id, profile: a.profile.name })),
      leader: agents[0].profile.name,
      description: args.task,
    }, null, 2))
  },
})

const teamStatus = defineCommand({
  meta: { name: 'status', description: 'Show team status' },
  args: {
    team: { type: 'positional', required: true, description: 'Team ID' },
  },
  async run({ args }) {
    // Simplified: show all agents in pool
    const agents = agentPool.listAll()
    const running = agents.filter(a => a.status === 'running').length
    const completed = agents.filter(a => a.status === 'completed').length
    console.log(JSON.stringify({
      teamId: args.team,
      total: agents.length,
      running,
      completed,
      failed: agents.filter(a => a.status === 'failed').length,
      agents: agents.map(a => ({ id: a.id, status: a.status })),
    }, null, 2))
  },
})

const team = defineCommand({
  meta: { name: 'team', description: 'Agent team orchestration' },
  subCommands: { create: teamCreate, status: teamStatus },
})

// ============================================================================
// Main
// ============================================================================

// ============================================================================
// Phase-Aligned Commands (v0.10.1) - agent-skills style
// ============================================================================

import * as phaseCommands from '../cli/phaseCommands.js'
import * as liteCommands from '../cli/liteCommands.js'
import * as vibeCommands from '../cli/vibeCommands.js'

const main = defineCommand({
  meta: { name: 'scale', version: SCALE_ENGINE_VERSION, description: `SCALE Engine v${SCALE_ENGINE_VERSION} CLI - hardened phase workflow gates, governance templates, platform adapters, skill routing, and verification automation` },
  subCommands: {
    // Lite Mode (agent-skills style interactive entry)
    lite: liteCommands.liteCommand,

    // Vibe Templates (one-click prompt workflow)
    vibe: vibeCommands.vibeCommand,
    'vibe-next': vibeCommands.vibeNextCommand,
    'vibe-index': vibeCommands.vibeIndexCommand,

    // Phase-Aligned Commands (agent-skills style)
    define: phaseCommands.phaseDefine,
    plan: phaseCommands.phasePlan,
    build: phaseCommands.phaseBuild,
    verify: phaseCommands.phaseVerify,
    review: phaseCommands.phaseReview,
    ship: phaseCommands.phaseShip,

    // Original commands (preserved)
    init,
    doctor,
    session,
    gate,
    create,
    list,
    show,
    suggest,
    transition,
    verifyTask,
    role,
    context,
    evolve,
    stats,
    preflight,
    governance,
    artifact,
    assets,
    standards,
    metrics,
    'task-artifacts': taskArtifacts,
    workspace,
    status,
    workflow,
    evidence,
    runtime,
    memory,
    diagnose,
    tdd,
    tool,
    skill,
    skills: skill,
    agent,
    team,
    'create-prd': createPRD,
    'out-of-scope': outOfScope,
  },
})

runMain(main)
