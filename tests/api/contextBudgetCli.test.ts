import { afterEach, describe, expect, it } from 'vitest'
import { execa } from 'execa'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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

function writeProject(projectDir: string) {
  mkdirSync(join(projectDir, 'docs', 'plans'), { recursive: true })
  mkdirSync(join(projectDir, '.scale'), { recursive: true })
  writeFileSync(join(projectDir, 'AGENTS.md'), '# Agent Rules\nAlways verify.\n', 'utf-8')
  writeFileSync(join(projectDir, 'CLAUDE.md'), '# Claude Rules\nKeep evidence.\n', 'utf-8')
  writeFileSync(join(projectDir, '.scale', 'verification.json'), '{"version":"1.0"}', 'utf-8')
  writeFileSync(join(projectDir, 'docs', 'plans', 'old-plan.md'), '# Historical Plan\n' + 'detail\n'.repeat(40), 'utf-8')
  writeFileSync(join(projectDir, 'docs', 'report.html'), '<html><body>generated</body></html>', 'utf-8')
}

describe('context budget CLI', () => {
  it('reports context categories and always-loaded tokens', async () => {
    const scaleDir = makeDir('scale-context-cli-scale-')
    const projectDir = makeDir('scale-context-cli-project-')
    writeProject(projectDir)

    const result = await runScale(['context', 'budget', '--json'], scaleDir, projectDir)

    expect(result.exitCode).toBe(0)
    const report = parseJson<{
      summary: { alwaysTokens: number; byCategory: Record<string, { files: number }> }
      entries: Array<{ path: string; category: string }>
    }>(result.stdout)
    expect(report.summary.alwaysTokens).toBeGreaterThan(0)
    expect(report.summary.byCategory.always.files).toBeGreaterThan(0)
    expect(report.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'AGENTS.md', category: 'always' }),
      expect.objectContaining({ path: 'docs/report.html', category: 'generated' }),
    ]))
  }, 120_000)

  it('scans an absolute SCALE_DIR as logical .scale context', async () => {
    const scaleDir = makeDir('scale-context-cli-scale-')
    const projectDir = makeDir('scale-context-cli-project-')
    writeFileSync(join(projectDir, 'AGENTS.md'), '# Agent Rules\nAlways verify.\n', 'utf-8')
    writeFileSync(join(scaleDir, 'verification.json'), '{"version":"1.0"}', 'utf-8')

    const result = await runScale(['context', 'budget', '--json'], scaleDir, projectDir)

    expect(result.exitCode).toBe(0)
    const report = parseJson<{
      entries: Array<{ path: string; category: string }>
    }>(result.stdout)
    expect(report.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '.scale/verification.json', category: 'always' }),
    ]))
  }, 120_000)

  it('fails context doctor when always-loaded threshold is too low', async () => {
    const scaleDir = makeDir('scale-context-cli-scale-')
    const projectDir = makeDir('scale-context-cli-project-')
    writeProject(projectDir)

    const result = await runScale(['context', 'doctor', '--max-always', '1', '--json'], scaleDir, projectDir)

    expect(result.exitCode).toBe(1)
    const report = parseJson<{ ok: boolean; checks: Array<{ name: string; status: string }> }>(result.stdout)
    expect(report.ok).toBe(false)
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Always-loaded context', status: 'fail' }),
    ]))
  }, 120_000)

  it('builds a lazy-loaded context pack with explicit omissions under tight budget', async () => {
    const scaleDir = makeDir('scale-context-cli-scale-')
    const projectDir = makeDir('scale-context-cli-project-')
    writeProject(projectDir)

    const result = await runScale([
      'context',
      'pack',
      '--task',
      'Review release plan with browser evidence',
      '--level',
      'L',
      '--budget',
      '20',
      '--json',
    ], scaleDir, projectDir)

    expect(result.exitCode).toBe(0)
    const pack = parseJson<{
      lazyLoaded: Array<{ id: string }>
      omitted: Array<{ id: string }>
      sections: Array<{ id: string; included: boolean }>
    }>(result.stdout)
    expect(pack.sections.length).toBeGreaterThan(0)
    expect(pack.omitted.length).toBeGreaterThan(0)
  }, 120_000)
})
