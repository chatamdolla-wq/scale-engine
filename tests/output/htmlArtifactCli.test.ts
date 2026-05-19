import { afterEach, describe, expect, it } from 'vitest'
import { execa } from 'execa'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

function write(projectDir: string, relativePath: string, content: string): void {
  const target = join(projectDir, ...relativePath.split('/'))
  mkdirSync(target.split(/[\\/]/).slice(0, -1).join('/'), { recursive: true })
  writeFileSync(target, content, 'utf-8')
}

function runScale(args: string[], scaleDir: string, projectDir: string) {
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

describe('artifact CLI', () => {
  it('renders and doctors a task HTML artifact', async () => {
    const projectDir = makeDir('scale-artifact-cli-project-')
    const scaleDir = makeDir('scale-artifact-cli-state-')
    const taskId = '2026-05-18-cli'
    write(projectDir, `docs/worklog/tasks/${taskId}/summary.md`, '# Summary\n\nReady for review.\n')
    write(projectDir, `docs/worklog/tasks/${taskId}/verification.md`, '# Verification\n\nnpm test exit 0.\n')

    const render = await runScale([
      'artifact',
      'render',
      '--dir',
      projectDir,
      '--task-id',
      taskId,
      '--type',
      'status-report',
      '--json',
    ], scaleDir, projectDir)

    expect(render.exitCode).toBe(0)
    const rendered = JSON.parse(render.stdout) as { outputPath: string; indexPath: string }
    expect(readFileSync(rendered.outputPath, 'utf-8')).toContain('Ready for review')
    expect(readFileSync(rendered.indexPath, 'utf-8')).toContain('status-report')

    const doctor = await runScale([
      'artifact',
      'doctor',
      '--dir',
      projectDir,
      '--task-id',
      taskId,
      '--json',
    ], scaleDir, projectDir)

    expect(doctor.exitCode).toBe(0)
    expect(JSON.parse(doctor.stdout)).toMatchObject({ ok: true })
  }, 20_000)
})
