import { afterEach, describe, expect, it } from 'vitest'
import { execa } from 'execa'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
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

describe('memory CLI', () => {
  it('renders a memory context pack for a scoped task', async () => {
    const scaleDir = makeDir('scale-memory-cli-scale-')
    const projectDir = makeDir('scale-memory-cli-project-')

    await runScale([
      'runtime',
      'start',
      '--session-id',
      'SESSION-MEM',
      '--task-id',
      'TASK-MEM',
      '--level',
      'M',
      '--summary',
      'Memory context pack',
    ], scaleDir, projectDir)
    await runScale([
      'runtime',
      'record',
      '--title',
      'unit tests',
      '--status',
      'passed',
      '--exit-code',
      '0',
      '--summary',
      'memory tests passed',
    ], scaleDir, projectDir)

    const result = await runScale([
      'memory',
      'pack',
      '--task-id',
      'TASK-MEM',
      '--session-id',
      'SESSION-MEM',
      '--task',
      'Build a memory context pack',
      '--level',
      'M',
      '--budget',
      '2000',
      '--json',
    ], scaleDir, projectDir)

    expect(result.exitCode).toBe(0)
    const pack = parseJson<{ task: { taskId: string }; sections: Array<{ id: string; included: boolean }> }>(result.stdout)
    expect(pack.task.taskId).toBe('TASK-MEM')
    expect(pack.sections).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'runtime-evidence', included: true }),
      expect.objectContaining({ id: 'session-events', included: true }),
    ]))
  }, 120_000)

  it('fails memory doctor when a context pack would exceed its budget', async () => {
    const scaleDir = makeDir('scale-memory-cli-scale-')
    const projectDir = makeDir('scale-memory-cli-project-')

    const result = await runScale([
      'memory',
      'doctor',
      '--task',
      'Review a very large cross module architecture change with many known risks and long context',
      '--level',
      'L',
      '--budget',
      '10',
      '--json',
    ], scaleDir, projectDir)

    expect(result.exitCode).toBe(1)
    const report = parseJson<{ ok: boolean; checks: Array<{ name: string; status: string }> }>(result.stdout)
    expect(report.ok).toBe(false)
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Context budget', status: 'fail' }),
    ]))
  }, 120_000)

  it('settles a memory learning candidate from runtime evidence', async () => {
    const scaleDir = makeDir('scale-memory-cli-scale-')
    const projectDir = makeDir('scale-memory-cli-project-')

    await runScale([
      'runtime',
      'start',
      '--session-id',
      'SESSION-SETTLE',
      '--task-id',
      'TASK-SETTLE',
      '--level',
      'M',
      '--summary',
      'Memory settlement',
    ], scaleDir, projectDir)
    await runScale([
      'runtime',
      'record',
      '--title',
      'unit tests',
      '--status',
      'passed',
      '--exit-code',
      '0',
      '--summary',
      'memory settle tests passed',
    ], scaleDir, projectDir)

    const result = await runScale([
      'memory',
      'settle',
      '--task-id',
      'TASK-SETTLE',
      '--session-id',
      'SESSION-SETTLE',
      '--task',
      'Settle runtime evidence into learning',
      '--level',
      'M',
      '--json',
    ], scaleDir, projectDir)

    expect(result.exitCode).toBe(0)
    const output = parseJson<{
      candidate: { status: string; recommendedAction: string; promotable: boolean; evidenceIds: string[] }
      files: { json: string; markdown: string }
    }>(result.stdout)
    expect(output.candidate).toMatchObject({
      status: 'candidate',
      recommendedAction: 'review-for-knowledge-base',
      promotable: true,
    })
    expect(output.candidate.evidenceIds.length).toBeGreaterThan(0)
    expect(existsSync(output.files.json)).toBe(true)
    expect(existsSync(output.files.markdown)).toBe(true)
  }, 120_000)
})
