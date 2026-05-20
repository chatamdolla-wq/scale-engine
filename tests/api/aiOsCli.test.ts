import { afterEach, describe, expect, it } from 'vitest'
import { execa } from 'execa'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

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

async function runScale(args: string[], scaleDir: string, projectDir: string) {
  return execa('node', ['--import', 'tsx', 'src/api/cli.ts', ...args], {
    env: {
      ...process.env,
      SCALE_DIR: scaleDir,
      SCALE_PROJECT_DIR: projectDir,
      SCALE_LOG_LEVEL: undefined,
    },
    reject: false,
  })
}

function parseJson<T>(stdout: string): T {
  return JSON.parse(stdout) as T
}

describe('ai-os CLI', () => {
  it('prints a unified 0.27.0 runtime plan as JSON', async () => {
    const scaleDir = makeDir('scale-ai-os-cli-scale-')
    const projectDir = makeDir('scale-ai-os-cli-project-')

    const result = await runScale([
      'ai-os',
      'plan',
      '--task-id',
      'TASK-AI-OS-CLI',
      '--task',
      'Review auth token and browser callback flow',
      '--level',
      'L',
      '--files',
      'src/auth/token.ts,src/ui/callback.tsx',
      '--budget',
      '2400',
      '--json',
    ], scaleDir, projectDir)

    expect(result.exitCode).toBe(0)
    const report = parseJson<{
      version: string
      task: { taskId: string }
      governance: { effectiveMode: string }
      context: { compiler?: { strategy: string } }
      memory: { providerOrder: string[] }
      skillPlan: { executionPlan: { steps: Array<{ kind: string; id: string }> } }
      roi: { modules: Array<{ module: string }> }
    }>(result.stdout)
    expect(report.version).toBe('0.27.0')
    expect(report.task.taskId).toBe('TASK-AI-OS-CLI')
    expect(report.governance.effectiveMode).toBe('critical')
    expect(report.context.compiler?.strategy).toBe('relevance-budget-v1')
    expect(report.memory.providerOrder).toEqual(['agentmemory', 'gbrain', 'scale-local'])
    expect(report.skillPlan.executionPlan.steps.length).toBeGreaterThan(0)
    expect(report.roi.modules).toEqual(expect.arrayContaining([
      expect.objectContaining({ module: 'context-compiler' }),
      expect.objectContaining({ module: 'skill-routing-engine' }),
    ]))
  }, 120_000)
})
