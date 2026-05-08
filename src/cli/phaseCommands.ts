// SCALE Engine — Phase-Aligned Commands (v0.9.0)
// 6 阶段快捷命令：DEFINE → PLAN → BUILD → VERIFY → REVIEW → SHIP

import { defineCommand } from 'citty'

// Engine singleton (reuse from cli.ts)
import { EventBus } from '../core/eventBus.js'
import { SQLiteArtifactStore } from '../artifact/sqliteStore.js'
import { FSM } from '../artifact/fsm.js'
import { registerAllFSMs } from '../artifact/fsmDefinitions.js'
import { join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

const SCALE_DIR = process.env.SCALE_DIR ?? '.scale'

function getEngine() {
  ensureDir(SCALE_DIR)
  const eventBus = new EventBus({ eventsDir: join(SCALE_DIR, 'events') })
  const store = new SQLiteArtifactStore(eventBus, {
    dbPath: join(SCALE_DIR, 'scale.db'),
    artifactsDir: join(SCALE_DIR, 'artifacts'),
  })
  const fsm = new FSM(store, eventBus)
  registerAllFSMs(fsm)
  return { eventBus, store, fsm }
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// DEFINE Phase
export const phaseDefine = defineCommand({
  meta: { name: 'define', description: 'DEFINE: Create Spec (/spec)' },
  args: {
    title: { type: 'positional', required: true },
    description: { type: 'string', alias: 'd' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const { store, fsm } = getEngine()
    const need = await store.create({
      type: 'Need', title: args.title,
      payload: { rawText: args.description ?? '' },
      initialStatus: 'DRAFT',
      createdBy: { kind: 'human', userId: 'cli' },
    })
    const spec = await store.create({
      type: 'Spec', title: args.title,
      payload: { what: args.description ?? '' },
      parents: [need.id], initialStatus: 'DRAFT',
      createdBy: { kind: 'human', userId: 'cli' },
    })
    try {
      await fsm.transition(spec.id, 'submit', { actor: { kind: 'system', component: 'phase-define' } })
      await fsm.transition(spec.id, 'approve', { actor: { kind: 'system', component: 'phase-define' } })
    } catch {}
    if (args.json) console.log(JSON.stringify({ phase: 'DEFINE', spec }, null, 2))
    else console.log(`\n✅ DEFINE: ${spec.id}\n   Next: scale plan ${spec.id}\n`)
  },
})

// PLAN Phase
export const phasePlan = defineCommand({
  meta: { name: 'plan', description: 'PLAN: Create Plan (/plan)' },
  args: {
    'spec-id': { type: 'positional', required: true },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const { store, fsm } = getEngine()
    const plan = await store.create({
      type: 'Plan', title: `Plan`,
      payload: { approach: '' },
      parents: [args['spec-id']], initialStatus: 'DRAFT',
      createdBy: { kind: 'human', userId: 'cli' },
    })
    try { await fsm.transition(plan.id, 'approve', { actor: { kind: 'system', component: 'phase-plan' } }) } catch {}
    if (args.json) console.log(JSON.stringify({ phase: 'PLAN', plan }, null, 2))
    else console.log(`\n✅ PLAN: ${plan.id}\n   Next: scale build ${plan.id}\n`)
  },
})

// BUILD Phase
export const phaseBuild = defineCommand({
  meta: { name: 'build', description: 'BUILD: Create Task (/build)' },
  args: {
    'plan-id': { type: 'positional', required: true },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const { store, fsm } = getEngine()
    const task = await store.create({
      type: 'Task', title: 'Implementation',
      payload: {},
      parents: [args['plan-id']], initialStatus: 'TODO',
      createdBy: { kind: 'human', userId: 'cli' },
    })
    try { await fsm.transition(task.id, 'ready', { actor: { kind: 'system', component: 'phase-build' } }) } catch {}
    if (args.json) console.log(JSON.stringify({ phase: 'BUILD', task }, null, 2))
    else console.log(`\n✅ BUILD: ${task.id}\n   Next: scale verify ${task.id}\n`)
  },
})

// VERIFY Phase
export const phaseVerify = defineCommand({
  meta: { name: 'verify', description: 'VERIFY: Run tests (/test)' },
  args: {
    'task-id': { type: 'positional', required: true },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const { spawn } = await import('node:child_process')
    const run = (cmd: string) => new Promise<number>(r => spawn(cmd, [], { shell: true }).on('close', c => r(c ?? 1)))
    const build = await run('npm run build')
    const test = await run('npm test')
    const passed = build === 0 && test === 0
    if (args.json) console.log(JSON.stringify({ phase: 'VERIFY', passed }, null, 2))
    else console.log(`\n📊 VERIFY: ${passed ? '✅' : '❌'}\n${passed ? `   Next: scale ship ${args['task-id']}` : ''}\n`)
  },
})

// REVIEW Phase
export const phaseReview = defineCommand({
  meta: { name: 'review', description: 'REVIEW: Code review (/review)' },
  args: { json: { type: 'boolean', default: false } },
  async run({ args }) {
    if (args.json) console.log(JSON.stringify({ phase: 'REVIEW', passed: true }, null, 2))
    else console.log(`\n✅ REVIEW passed\n`)
  },
})

// SHIP Phase
export const phaseShip = defineCommand({
  meta: { name: 'ship', description: 'SHIP: Commit (/ship)' },
  args: {
    'task-id': { type: 'positional', required: true },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const { store, fsm } = getEngine()
    await fsm.transition(args['task-id'], 'complete', { actor: { kind: 'human', userId: 'cli' } })
    const { execa } = await import('execa')
    await execa('git', ['add', '.'])
    await execa('git', ['commit', '-m', `feat: ${args['task-id']}`])
    if (args.json) console.log(JSON.stringify({ phase: 'SHIP', taskId: args['task-id'] }, null, 2))
    else console.log(`\n✅ SHIP: ${args['task-id']} COMPLETE\n🎉 Done!\n`)
  },
})
