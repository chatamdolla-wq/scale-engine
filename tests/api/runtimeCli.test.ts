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

describe('runtime CLI', () => {
  it('records runtime evidence and passes final check for scoped M work', async () => {
    const scaleDir = makeDir('scale-runtime-cli-scale-')
    const projectDir = makeDir('scale-runtime-cli-project-')

    const start = await runScale([
      'runtime',
      'start',
      '--session-id',
      'SESSION-CLI',
      '--task-id',
      'TASK-CLI',
      '--level',
      'M',
      '--json',
    ], scaleDir, projectDir)
    expect(start.exitCode).toBe(0)
    expect(parseJson<{ sessionId: string }>(start.stdout).sessionId).toBe('SESSION-CLI')

    const record = await runScale([
      'runtime',
      'record',
      '--title',
      'build',
      '--status',
      'passed',
      '--command',
      'npm run build -- --token raw-token',
      '--exit-code',
      '0',
      '--summary',
      'build passed',
      '--json',
    ], scaleDir, projectDir)
    expect(record.exitCode).toBe(0)
    const evidence = parseJson<{ id: string; command: string; taskId: string; sessionId: string }>(record.stdout)
    expect(evidence.taskId).toBe('TASK-CLI')
    expect(evidence.sessionId).toBe('SESSION-CLI')
    expect(evidence.command).not.toContain('raw-token')

    const finalCheck = await runScale([
      'runtime',
      'final-check',
      '--task-id',
      'TASK-CLI',
      '--session-id',
      'SESSION-CLI',
      '--level',
      'M',
      '--json',
    ], scaleDir, projectDir)
    expect(finalCheck.exitCode).toBe(0)
    expect(parseJson<{ ready: boolean }>(finalCheck.stdout).ready).toBe(true)
    expect(existsSync(join(scaleDir, 'events', 'sessions', 'SESSION-CLI.jsonl'))).toBe(true)
  }, 120_000)

  it('fails final check when no passed evidence exists for M work', async () => {
    const scaleDir = makeDir('scale-runtime-cli-scale-')
    const projectDir = makeDir('scale-runtime-cli-project-')

    const result = await runScale([
      'runtime',
      'final-check',
      '--task-id',
      'TASK-NO-EVIDENCE',
      '--level',
      'M',
      '--json',
    ], scaleDir, projectDir)

    expect(result.exitCode).toBe(1)
    const output = parseJson<{ ready: boolean; reasons: string[] }>(result.stdout)
    expect(output.ready).toBe(false)
    expect(output.reasons.join('\n')).toContain('No passed evidence')
  }, 120_000)
})
