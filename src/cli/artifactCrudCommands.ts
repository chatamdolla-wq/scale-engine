// SCALE Engine — Artifact CRUD Commands
import { defineCommand } from 'citty'
import { getEngine } from './engineBootstrap.js'

export const createCommand = defineCommand({
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
    const { INITIAL_STATES } = await import('../artifact/fsmDefinitions.js')
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

export const listCommand = defineCommand({
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

export const showCommand = defineCommand({
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

export const suggestCommand = defineCommand({
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

    const availableTxs = def.transitions.filter((t) => t.from === artifact.status)

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

export const createPRDCommand = defineCommand({
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

    const spec = await store.create({
      type: 'Spec',
      title: args.title,
      payload: { description: args.specs ?? '', ambiguityScore: 0.3 },
      initialStatus: 'DRAFT',
      createdBy: { kind: 'human', userId: process.env.USER ?? 'cli' },
    })

    const plan = await store.create({
      type: 'Plan',
      title: `${args.title} - Implementation Plan`,
      payload: { design: args.plans ?? '' },
      parents: [spec.id],
      initialStatus: 'DRAFT',
      createdBy: { kind: 'human', userId: process.env.USER ?? 'cli' },
    })

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
