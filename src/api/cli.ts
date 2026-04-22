#!/usr/bin/env node
// SCALE Engine — CLI 入口 (W6 完整实现)
// 所有 Hook 调用入口: session/gate/create/list/transition/context

import { defineCommand, runMain } from 'citty'
import { EventBus } from '../core/eventBus.js'
import { SQLiteArtifactStore } from '../artifact/sqliteStore.js'
import { FSM } from '../artifact/fsm.js'
import { registerAllFSMs, INITIAL_STATES } from '../artifact/fsmDefinitions.js'
import { Gateway } from '../guardrails/Gateway.js'
import { BruteRetryDetector, PrematureDoneDetector, BlameShiftDetector } from '../guardrails/detectors.js'
import { DangerousCommandDetector, SecretLeakDetector, RoleGateDetector, BUILT_IN_ROLES } from '../guardrails/advancedDetectors.js'
import { KnowledgeBase } from '../knowledge/KnowledgeBase.js'
import { ContextBuilder } from '../context/ContextBuilder.js'
import { createAdapter } from '../adapters/ClaudeCodeAdapter.js'
import { LessonExtractor, RuleProposer, HookGenerator, EvolutionEngine } from '../evolution/EvolutionEngine.js'
import { Doctor } from './doctor.js'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
// Engine bootstrap (单例 + lazy init)
// ============================================================================

const SCALE_DIR = process.env.SCALE_DIR ?? '.scale'
const DB_PATH = join(SCALE_DIR, 'scale.db')

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
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

  // Register all detectors
  gateway.registerDetector(new DangerousCommandDetector(), 'preTool')
  gateway.registerDetector(new SecretLeakDetector(), 'preTool')
  gateway.registerDetector(roleGate, 'preTool')
  gateway.registerDetector(new BruteRetryDetector(), 'preTool')
  gateway.registerDetector(new PrematureDoneDetector(), 'beforeStop')
  gateway.registerDetector(new BlameShiftDetector(), 'postTool')

  const kb = new KnowledgeBase(eventBus)
  const ctx = new ContextBuilder(store, kb, eventBus)

  return { eventBus, store, fsm, gateway, roleGate, kb, ctx }
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

const context = defineCommand({
  meta: { name: 'context', description: 'Context assembly' },
  subCommands: { build: contextBuild, status: contextStatus },
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

// ============================================================================
// init command
// ============================================================================

const init = defineCommand({
  meta: { name: 'init', description: 'Initialize SCALE Engine in current project' },
  args: {
    agent: { type: 'string', default: 'claude-code', description: 'Agent type (claude-code)' },
    dir: { type: 'string', default: '.', description: 'Project directory' },
  },
  async run({ args }) {
    const adapter = createAdapter(args.agent)
    const result = await adapter.init({ projectDir: args.dir, agentType: args.agent as 'claude-code' })
    console.log(`\n✅ SCALE Engine initialized for ${args.agent}`)
    console.log(`\n📁 Created:`)
    for (const f of result.created) console.log(`   + ${f}`)
    if (result.skipped.length > 0) {
      console.log(`\n⏭️  Skipped (already exist):`)
      for (const f of result.skipped) console.log(`   - ${f}`)
    }
    console.log(`\n🔧 Settings: ${result.settingsPath}`)
    console.log(`📖 Knowledge: ${result.knowledgeDocPath}`)
    console.log(`📂 Data dir:  ${result.scaleDir}`)
  },
})

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
// Main
// ============================================================================

const main = defineCommand({
  meta: { name: 'scale', version: '0.4.0', description: 'SCALE Engine CLI — AI engineering scaffold' },
  subCommands: {
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
    'create-prd': createPRD,
  },
})

runMain(main)
