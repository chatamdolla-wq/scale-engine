import { defineCommand } from 'citty'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { InstinctExtractor } from '../cortex/InstinctExtractor.js'
import { InstinctStore } from '../cortex/InstinctStore.js'
import { ReflexionEngine } from '../cortex/ReflexionEngine.js'
import { SessionInjector } from '../cortex/SessionInjector.js'
import { GovernanceMetricsCalculator } from '../cortex/GovernanceMetrics.js'
import { logger } from '../core/logger.js'

// ---------------------------------------------------------------------------
// scale cortex extract
// ---------------------------------------------------------------------------

export const cortexExtractCommand = defineCommand({
  meta: {
    name: 'extract',
    description: 'Extract instincts from observation logs — detect failure patterns and create learning entries',
  },
  args: {
    dir: { type: 'string', default: process.cwd(), description: 'Project directory' },
    'min-confidence': { type: 'string', default: '0.5', description: 'Minimum confidence threshold (0.3-0.9)' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const projectDir = String(args.dir ?? process.cwd())
    const scaleDir = join(projectDir, '.scale')
    const minConfidence = parseFloat(String(args['min-confidence'] ?? 0.5))

    const extractor = new InstinctExtractor(scaleDir)
    const store = new InstinctStore(join(scaleDir, 'instincts'))

    console.log('SCALE Cortex — Extracting Instincts\n')

    const observations = extractor.loadObservations()
    console.log(`  Observations loaded: ${observations.length}`)

    if (observations.length === 0) {
      console.log('  No observations found. Instincts are built from gate failure data.')
      console.log('  Run gates first, then re-run: scale cortex extract\n')
      return
    }

    const patterns = extractor.detectPatterns(observations)
    console.log(`  Patterns detected:  ${patterns.length}`)

    const instincts = extractor.extract(patterns)
    const filtered = instincts.filter(i => i.confidence >= minConfidence)

    console.log(`  Instincts extracted: ${instincts.length} (${filtered.length} ≥ ${minConfidence} confidence)\n`)

    let saved = 0
    for (const instinct of filtered) {
      store.save(instinct)
      saved++
    }

    console.log(`  Saved: ${saved} instincts to .scale/instincts/`)

    if (args.json) {
      console.log(JSON.stringify(filtered, null, 2))
      return
    }

    if (filtered.length > 0) {
      console.log('\n  Top instincts:')
      for (const i of filtered.slice(0, 5)) {
        console.log(`  [${(i.confidence * 100).toFixed(0)}%] ${i.domain}: ${i.trigger}`)
      }
    }
    console.log()
  },
})

// ---------------------------------------------------------------------------
// scale cortex inject
// ---------------------------------------------------------------------------

export const cortexInjectCommand = defineCommand({
  meta: {
    name: 'inject',
    description: 'Preview what SCALE Cortex would inject at SessionStart — high-confidence instincts',
  },
  args: {
    dir: { type: 'string', default: process.cwd(), description: 'Project directory' },
    minimal: { type: 'boolean', default: false, description: 'Show minimal (low-context) injection format' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const projectDir = String(args.dir ?? process.cwd())
    const scaleDir = join(projectDir, '.scale')
    const store = new InstinctStore(join(scaleDir, 'instincts'))
    const injector = new SessionInjector(store)

    const injection = args.minimal
      ? injector.buildMinimal()
      : injector.build()

    if (args.json) {
      console.log(JSON.stringify(injection, null, 2))
      return
    }

    console.log('SCALE Cortex — SessionStart Injection Preview\n')
    console.log(`  Instincts: ${injection.instinctCount}`)
    console.log(`  Character count: ${injection.content.length}\n`)
    console.log('─── Injection Content ───\n')
    console.log(injection.content || '(no high-confidence instincts to inject)')
    console.log()
  },
})

// ---------------------------------------------------------------------------
// scale cortex metrics
// ---------------------------------------------------------------------------

export const cortexMetricsCommand = defineCommand({
  meta: {
    name: 'metrics',
    description: 'Compute SCALE Cortex governance ROI — gate pass rates, instinct hit rates, cost savings',
  },
  args: {
    dir: { type: 'string', default: process.cwd(), description: 'Project directory' },
    days: { type: 'string', default: '30', description: 'Lookback period in days' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const projectDir = String(args.dir ?? process.cwd())
    const scaleDir = join(projectDir, '.scale')
    const store = new InstinctStore(join(scaleDir, 'instincts'))
    const calculator = new GovernanceMetricsCalculator(scaleDir)
    const days = parseInt(String(args.days ?? 30), 10)

    const instincts = store.loadAll()
    const metrics = calculator.compute(instincts, days)

    if (args.json) {
      console.log(JSON.stringify(metrics, null, 2))
      return
    }

    console.log(calculator.render(metrics))
  },
})

// ---------------------------------------------------------------------------
// scale cortex evolve
// ---------------------------------------------------------------------------

export const cortexEvolveCommand = defineCommand({
  meta: {
    name: 'evolve',
    description: 'Run full Cortex evolution cycle: reflect → extract → save high-confidence instincts',
  },
  args: {
    dir: { type: 'string', default: process.cwd(), description: 'Project directory' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const projectDir = String(args.dir ?? process.cwd())
    const scaleDir = join(projectDir, '.scale')

    const extractor = new InstinctExtractor(scaleDir)
    const store = new InstinctStore(join(scaleDir, 'instincts'))
    const reflector = new ReflexionEngine()

    console.log('SCALE Cortex — Evolution Cycle\n')

    // 1. Load observations
    const observations = extractor.loadObservations()
    console.log(`  1. Observations: ${observations.length}`)

    // 2. Reflect on failures
    const reflections = await reflector.reflectAll(observations)
    console.log(`  2. Reflections:  ${reflections.length}`)

    // 3. Extract patterns
    const patterns = extractor.detectPatterns(observations)
    console.log(`  3. Patterns:     ${patterns.length}`)

    // 4. Extract instincts
    const instincts = extractor.extract(patterns)
    console.log(`  4. Instincts:    ${instincts.length}`)

    // 5. Save high-confidence (0.7+) instincts
    const highConf = instincts.filter(i => i.confidence >= 0.7)
    let saved = 0
    for (const instinct of highConf) {
      store.save(instinct)
      saved++
    }
    console.log(`  5. Saved:        ${saved} (confidence ≥ 0.7)\n`)

    // 6. Show reflection results
    for (const r of reflections.slice(0, 5)) {
      console.log(`  [${(r.confidence * 100).toFixed(0)}%] ${r.rootCause}`)
      console.log(`  Action: ${r.suggestedAction}\n`)
    }

    // 7. Stats
    const stats = store.stats()
    console.log(`  Store: ${stats.total} total instincts`)
    for (const [bucket, count] of Object.entries(stats.byConfidence)) {
      if (count > 0) console.log(`    ${bucket}: ${count}`)
    }
    console.log()

    if (args.json) {
      console.log(JSON.stringify({
        observations: observations.length,
        reflections: reflections.length,
        patterns: patterns.length,
        instincts: instincts.length,
        saved,
        stats,
      }, null, 2))
    }
  },
})

// ---------------------------------------------------------------------------
// scale cortex (parent)
// ---------------------------------------------------------------------------

export const cortexCommand = defineCommand({
  meta: {
    name: 'cortex',
    description: 'SCALE Cortex — Evidence-driven continuous learning and governance evolution',
  },
  subCommands: {
    extract: cortexExtractCommand,
    inject: cortexInjectCommand,
    metrics: cortexMetricsCommand,
    evolve: cortexEvolveCommand,
  },
})
