// SCALE Engine — Evolve and Doctor Commands
import { defineCommand } from 'citty'
import { getEngine, SCALE_DIR } from './engineBootstrap.js'
import { LessonExtractor, RuleProposer, HookGenerator, EvolutionEngine } from '../evolution/EvolutionEngine.js'
import { Doctor } from '../api/doctor.js'
import { inspectEnvironment, renderEnvironmentDoctor } from '../env/EnvironmentDoctor.js'

function runEnvironmentDoctor(json: unknown) {
  const report = inspectEnvironment()
  if (json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log(renderEnvironmentDoctor(report))
  }
  process.exitCode = report.ok ? 0 : 1
}

export const evolveCommand = defineCommand({
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

export const doctorCommand = defineCommand({
  meta: { name: 'doctor', description: 'Diagnose SCALE Engine health' },
  args: {
    scope: { type: 'positional', required: false, description: 'Optional diagnostic scope: env' },
    dir: { type: 'string', default: '.', description: 'Project directory' },
    json: { type: 'boolean', default: false, description: 'Output as JSON' },
  },
  async run({ args }) {
    const scope = String(args.scope ?? '').trim().toLowerCase()
    if (scope === 'env' || scope === 'environment') {
      runEnvironmentDoctor(args.json)
      return
    }
    if (scope) {
      console.error(`Unknown doctor scope: ${scope}. Supported scope: env.`)
      process.exitCode = 1
      return
    }
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
