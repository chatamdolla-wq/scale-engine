import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createAiOsPlan } from '../../src/runtime/AiOsRuntime.js'
import { MemoryBrain } from '../../src/memory/MemoryBrain.js'

let dirs: string[] = []

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

function makeDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  dirs.push(dir)
  return dir
}

describe('AI OS runtime planner', () => {
  it('builds one explainable plan across governance, context, memory, skills, and ROI', async () => {
    const projectDir = makeDir('scale-ai-os-project-')
    const scaleDir = makeDir('scale-ai-os-scale-')
    const brain = new MemoryBrain({ projectDir, scaleDir })
    try {
      brain.addNode({
        id: 'MEM-AI-OS-1',
        type: 'decision',
        title: 'OAuth callbacks use Redis state',
        summary: 'OAuth callbacks must resolve provider and user context from server-side Redis state.',
        source: 'manual',
        evidencePaths: ['docs/oauth-state.md'],
        confidence: 0.88,
        scope: 'project',
        status: 'active',
      })
    } finally {
      brain.close()
    }

    const plan = await createAiOsPlan({
      projectDir,
      scaleDir,
      taskId: 'TASK-AI-OS',
      task: 'Fix OAuth callback auth token handling and verify browser flow',
      level: 'L',
      files: ['src/auth/oauth.ts', 'src/ui/callback.tsx'],
      budget: 2400,
    })

    expect(plan.version).toBe('0.27.0')
    expect(plan.governance.effectiveMode).toBe('critical')
    expect(plan.context.compiler?.strategy).toBe('relevance-budget-v1')
    expect(plan.memory.providerOrder).toEqual(['agentmemory', 'gbrain', 'scale-local'])
    expect(plan.memory.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'scale-local', id: 'MEM-AI-OS-1' }),
    ]))
    expect(plan.skillPlan.executionPlan.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'skill', id: 'security-review', required: true }),
      expect.objectContaining({ kind: 'verification', id: 'browser-run' }),
    ]))
    expect(plan.adaptiveWorkflow.requiredBehaviors).toContain('run security review')
    expect(plan.roi.modules.map(module => module.module)).toEqual(expect.arrayContaining([
      'context-compiler',
      'memory-provider-runtime',
      'skill-routing-engine',
      'progressive-governance',
    ]))
  })
})
