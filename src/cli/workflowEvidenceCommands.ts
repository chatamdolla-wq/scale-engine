// SCALE Engine — Workflow and Evidence Commands
import { defineCommand } from 'citty'
import { SCALE_DIR } from './engineBootstrap.js'
import { listWorkflowPresets, getPresetsByScenario } from '../workflows/presets.js'
import { EvidenceStore } from '../workflow/EvidenceStore.js'

export const workflowListCommand = defineCommand({
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

export const workflowCommand = defineCommand({
  meta: { name: 'workflow', description: 'Workflow preset management' },
  subCommands: { list: workflowListCommand },
})

export const evidenceListCommand = defineCommand({
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

export const evidenceShowCommand = defineCommand({
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

export const evidenceCommand = defineCommand({
  meta: { name: 'evidence', description: 'Persisted gate evidence inspection' },
  subCommands: { list: evidenceListCommand, show: evidenceShowCommand },
})
