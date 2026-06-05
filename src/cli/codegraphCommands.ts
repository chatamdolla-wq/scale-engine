// SCALE Engine — CodeGraph CLI Commands (extracted from cli.ts)
// Adapter-first code intelligence: status, init, query, impact, context, roi, dump

import { defineCommand } from 'citty'
import { resolve, dirname } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import {
  buildCodeGraphContext,
  createCodeGraphRoiReport,
  dumpCodeGraphData,
  impactCodeGraph,
  inspectCodeIntelligence,
  queryCodeGraph,
  writeCodeIntelligenceConfig,
} from '../codegraph/CodeIntelligence.js'
import { getEngine, PROJECT_DIR, isTruthyFlag, resolveScaleDirForProject } from './engineBootstrap.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsePositiveIntArg(value: unknown, name: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number.parseInt(String(value), 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`)
  }
  return parsed
}

function printCodeGraphReport(report: {
  mode: string
  query: string
  provider?: string
  fallbackUsed: boolean
  confidence: number
  files: string[]
  hits: Array<{ file: string; line?: number; symbol?: string; reason: string }>
  roi: { fileReadsSaved: number; toolCallsSaved: number }
  warnings: string[]
}) {
  console.log('SCALE Code Intelligence')
  console.log(`  Mode: ${report.mode}`)
  console.log(`  Query: ${report.query}`)
  console.log(`  Provider: ${report.provider ?? 'fallback'}`)
  console.log(`  Fallback used: ${report.fallbackUsed}`)
  console.log(`  Confidence: ${report.confidence}`)
  console.log(`  Files: ${report.files.length}`)
  console.log(`  Estimated reads saved: ${report.roi.fileReadsSaved}`)
  for (const hit of report.hits.slice(0, 12)) {
    const line = hit.line ? `:${hit.line}` : ''
    const symbol = hit.symbol ? ` ${hit.symbol}` : ''
    console.log(`  - ${hit.file}${line}${symbol} (${hit.reason})`)
  }
  for (const warning of report.warnings) console.log(`  warning: ${warning}`)
}

// ---------------------------------------------------------------------------
// Sub-commands
// ---------------------------------------------------------------------------

const codegraphStatus = defineCommand({
  meta: { name: 'status', description: 'Inspect CodeGraph, Graphify, and fallback code intelligence providers' },
  args: {
    dir: { type: 'string', default: PROJECT_DIR, description: 'Project directory' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const projectDir = resolve(String(args.dir ?? PROJECT_DIR))
    const scaleDir = resolveScaleDirForProject(projectDir)
    const report = inspectCodeIntelligence({
      projectDir,
      scaleDir,
    })
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
      return
    }
    console.log('SCALE Code Intelligence Status')
    console.log(`  Config: ${report.configPath} (${report.configExists ? 'found' : 'default'})`)
    console.log(`  Project index: ${report.projectIndexExists ? report.projectIndexPath : `${report.projectIndexPath} (not initialized)`}`)
    for (const provider of report.providers) {
      console.log(`  [${provider.available ? 'AVAILABLE' : 'UNAVAILABLE'}] ${provider.id} (${provider.type}): ${provider.reason}`)
      if (provider.source) console.log(`    source: ${provider.source}`)
      if (!provider.available && provider.installHint) console.log(`    install: ${provider.installHint}`)
      if (provider.available && provider.projectInitHint && provider.id === 'codegraph' && !report.projectIndexExists) {
        console.log(`    init: ${provider.projectInitHint}`)
      }
      if (provider.serveCommand) console.log(`    mcp: ${provider.serveCommand}`)
    }
    console.log(`  Fallback: ${report.fallback.available ? 'available' : 'disabled'} (${report.fallback.tools.join(', ')})`)
    for (const recommendation of report.recommendations) console.log(`  recommendation: ${recommendation}`)
  },
})

const codegraphInit = defineCommand({
  meta: { name: 'init', description: 'Create .scale/code-intelligence.json provider configuration' },
  args: {
    dir: { type: 'string', default: PROJECT_DIR, description: 'Project directory' },
    force: { type: 'boolean', default: false, description: 'Overwrite existing configuration' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const projectDir = resolve(String(args.dir ?? PROJECT_DIR))
    const scaleDir = resolveScaleDirForProject(projectDir)
    const result = writeCodeIntelligenceConfig({
      projectDir,
      scaleDir,
      force: isTruthyFlag(args.force),
    })
    if (args.json) {
      console.log(JSON.stringify(result, null, 2))
      return
    }
    console.log(`SCALE Code Intelligence Config: ${result.written ? 'written' : 'exists'}`)
    console.log(`  ${result.path}`)
  },
})

const codegraphQuery = defineCommand({
  meta: { name: 'query', description: 'Query code intelligence providers, with explicit fallback when graph data is unavailable' },
  args: {
    query: { type: 'positional', required: true, description: 'Symbol, function, class, route, or text query' },
    dir: { type: 'string', default: PROJECT_DIR, description: 'Project directory' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const projectDir = resolve(String(args.dir ?? PROJECT_DIR))
    const scaleDir = resolveScaleDirForProject(projectDir)
    const report = queryCodeGraph({
      projectDir,
      scaleDir,
      query: String(args.query),
    })
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
      return
    }
    printCodeGraphReport(report)
  },
})

const codegraphImpact = defineCommand({
  meta: { name: 'impact', description: 'Find likely impacted files for a symbol' },
  args: {
    symbol: { type: 'string', required: true, description: 'Symbol to analyze' },
    dir: { type: 'string', default: PROJECT_DIR, description: 'Project directory' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const projectDir = resolve(String(args.dir ?? PROJECT_DIR))
    const scaleDir = resolveScaleDirForProject(projectDir)
    const report = impactCodeGraph({
      projectDir,
      scaleDir,
      symbol: String(args.symbol),
    })
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
      return
    }
    printCodeGraphReport(report)
  },
})

const codegraphContext = defineCommand({
  meta: { name: 'context', description: 'Build a budgeted file context recommendation from code intelligence' },
  args: {
    symbol: { type: 'string', required: true, description: 'Symbol to analyze' },
    budget: { type: 'string', description: 'Maximum estimated tokens for recommended files' },
    dir: { type: 'string', default: PROJECT_DIR, description: 'Project directory' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const projectDir = resolve(String(args.dir ?? PROJECT_DIR))
    const scaleDir = resolveScaleDirForProject(projectDir)
    const report = buildCodeGraphContext({
      projectDir,
      scaleDir,
      symbol: String(args.symbol),
      budget: parsePositiveIntArg(args.budget, '--budget'),
    })
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
      return
    }
    printCodeGraphReport(report)
    console.log(`  Context budget: ${report.totalEstimatedTokens}/${report.budget}`)
    for (const file of report.contextFiles) {
      console.log(`  [${file.included ? 'IN' : 'OUT'}] ${file.path}: ${file.estimatedTokens} tokens`)
    }
  },
})

const codegraphRoi = defineCommand({
  meta: { name: 'roi', description: 'Estimate exploration ROI from code intelligence or fallback query results' },
  args: {
    query: { type: 'string', description: 'Text query' },
    symbol: { type: 'string', description: 'Symbol to analyze' },
    dir: { type: 'string', default: PROJECT_DIR, description: 'Project directory' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    if (!args.query && !args.symbol) throw new Error('Provide --query or --symbol.')
    const projectDir = resolve(String(args.dir ?? PROJECT_DIR))
    const scaleDir = resolveScaleDirForProject(projectDir)
    const report = createCodeGraphRoiReport({
      projectDir,
      scaleDir,
      query: args.query ? String(args.query) : undefined,
      symbol: args.symbol ? String(args.symbol) : undefined,
    })
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
      return
    }
    console.log('SCALE Code Intelligence ROI')
    console.log(`  Query: ${report.query}`)
    console.log(`  Provider: ${report.provider ?? 'fallback'}`)
    console.log(`  Fallback: ${report.fallbackUsed}`)
    console.log(`  Graph hits: ${report.metrics.graphHits}`)
    console.log(`  Reads saved: ${report.metrics.fileReadsSaved}`)
    console.log(`  Recommendation: ${report.recommendation}`)
  },
})

const codegraphDump = defineCommand({
  meta: { name: 'dump', description: 'Dump full topology graph (nodes + edges) for visualization' },
  args: {
    dir: { type: 'string', default: PROJECT_DIR, description: 'Project directory' },
    out: { type: 'string', description: 'Output file path (default: stdout as JSON)' },
  },
  run({ args }) {
    const projectDir = resolve(String(args.dir ?? PROJECT_DIR))
    const scaleDir = resolveScaleDirForProject(projectDir)
    const graph = dumpCodeGraphData({ projectDir, scaleDir })
    const json = JSON.stringify(graph, null, 2)
    const outPath = args.out ? resolve(String(args.out)) : undefined
    if (outPath) {
      mkdirSync(dirname(outPath), { recursive: true })
      writeFileSync(outPath, json, 'utf-8')
      console.log(`Topology written to ${outPath} (${graph.nodes.length} nodes, ${graph.edges.length} edges)`)
    } else {
      console.log(json)
    }
  },
})

// ---------------------------------------------------------------------------
// Root command (exported)
// ---------------------------------------------------------------------------

export const codegraphCommand = defineCommand({
  meta: { name: 'codegraph', description: 'Adapter-first code intelligence and exploration ROI' },
  subCommands: {
    status: codegraphStatus,
    init: codegraphInit,
    query: codegraphQuery,
    impact: codegraphImpact,
    context: codegraphContext,
    roi: codegraphRoi,
    dump: codegraphDump,
  },
})
