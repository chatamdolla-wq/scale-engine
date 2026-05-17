import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createSkillPlan, resolveSkillRoutingPolicy } from '../../src/skills/routing/index.js'
import { inspectToolCapabilities } from '../../src/tools/ToolCapabilityRegistry.js'
import { ToolEvidenceStore } from '../../src/tools/ToolEvidenceStore.js'
import { resolveToolPolicy } from '../../src/tools/ToolPolicy.js'
import { ToolOrchestrator } from '../../src/tools/ToolOrchestrator.js'

let dirs: string[] = []

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

function makeProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'scale-tool-orchestrator-'))
  dirs.push(dir)
  return dir
}

function writeSkill(projectDir: string, skillId: string): void {
  const dir = join(projectDir, '.agents', 'skills', skillId)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${skillId}\n---\n`, 'utf-8')
}

function uiSkillPlan() {
  return createSkillPlan({
    taskId: 'TASK-UI',
    taskName: 'Improve upload page UI',
    description: 'Build frontend ui and responsive visual review',
    level: 'M',
    files: ['src/components/Upload.tsx'],
    policy: resolveSkillRoutingPolicy({
      policy: { mode: 'block', enforceLevels: ['M', 'L', 'CRITICAL'], requireSkillPlan: true },
    }),
  })
}

describe('ToolOrchestrator', () => {
  it('builds a tool execution plan from skill plan, tool policy, and capability status', () => {
    const projectDir = makeProject()
    const homeDir = makeProject()
    writeSkill(projectDir, 'frontend-design')

    const capabilityReport = inspectToolCapabilities({
      projectDir,
      homeDir,
      toolIds: ['frontend-design', 'ui-ux-pro-max', 'agent-browser'],
      commandExists: () => false,
    })
    const orchestrator = new ToolOrchestrator({
      projectDir,
      policy: resolveToolPolicy({ mode: 'block' }),
      capabilityReport,
    })

    const plan = orchestrator.plan({ skillPlan: uiSkillPlan() })

    expect(plan.mode).toBe('block')
    expect(plan.steps.map(step => step.toolId)).toEqual(expect.arrayContaining(['frontend-design', 'ui-ux-pro-max']))
    expect(plan.steps.find(step => step.toolId === 'frontend-design')).toMatchObject({
      required: true,
      status: 'ready',
      adapter: 'skill',
    })
    expect(plan.steps.find(step => step.toolId === 'ui-ux-pro-max')).toMatchObject({
      required: true,
      status: 'missing',
    })
    expect(plan.blockers).toEqual(expect.arrayContaining([
      expect.stringContaining('ui-ux-pro-max'),
    ]))
  })

  it('runs ready steps in dry-run mode and writes skipped evidence', async () => {
    const projectDir = makeProject()
    writeSkill(projectDir, 'frontend-design')
    writeSkill(projectDir, 'ui-ux-pro-max')

    const evidenceStore = new ToolEvidenceStore({ projectDir })
    const orchestrator = new ToolOrchestrator({
      projectDir,
      policy: resolveToolPolicy({ mode: 'evidence-required' }),
      evidenceStore,
      capabilityReport: inspectToolCapabilities({
        projectDir,
        toolIds: ['frontend-design', 'ui-ux-pro-max'],
      }),
    })
    const plan = orchestrator.plan({ skillPlan: uiSkillPlan() })

    const report = await orchestrator.run(plan, { dryRun: true })

    expect(report.ok).toBe(true)
    expect(report.evidence.map(item => item.status)).toEqual(['skipped', 'skipped'])
    expect(evidenceStore.summary('TASK-UI')).toMatchObject({
      total: 2,
      skipped: 2,
      ok: true,
    })
  })

  it('records failed execution evidence and marks the report failed', async () => {
    const projectDir = makeProject()
    writeSkill(projectDir, 'frontend-design')

    const evidenceStore = new ToolEvidenceStore({ projectDir })
    const orchestrator = new ToolOrchestrator({
      projectDir,
      policy: resolveToolPolicy({ mode: 'evidence-required' }),
      evidenceStore,
      capabilityReport: inspectToolCapabilities({
        projectDir,
        toolIds: ['frontend-design'],
      }),
      executeStep: async step => ({
        status: 'failed',
        outputSummary: `failed ${step.toolId} token=secret-token-value`,
        outputPaths: [],
        exitCode: 1,
      }),
    })
    const plan = orchestrator.plan({ skillPlan: {
      ...uiSkillPlan(),
      requiredSkills: ['frontend-design'],
      recommendedSkills: [],
    } })

    const report = await orchestrator.run(plan)

    expect(report.ok).toBe(false)
    expect(report.blockers).toEqual([expect.stringContaining('frontend-design')])
    const evidence = evidenceStore.list('TASK-UI')
    expect(evidence).toHaveLength(1)
    expect(evidence[0]).toMatchObject({
      tool: 'frontend-design',
      status: 'failed',
      exitCode: 1,
    })
    expect(evidence[0].outputSummary).not.toContain('secret-token-value')
  })
})
