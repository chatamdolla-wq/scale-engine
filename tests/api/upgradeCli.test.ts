import { afterEach, describe, expect, it } from 'vitest'
import { execa } from 'execa'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs.length = 0
})

function makeDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  dirs.push(dir)
  return dir
}

async function runScale(args: string[], scaleDir: string, projectDir?: string) {
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

describe('upgrade CLI', () => {
  it('prints machine-readable upgrade check and plan reports', async () => {
    const scaleDir = makeDir('scale-upgrade-cli-')
    const projectDir = makeDir('scale-upgrade-project-')
    const init = await runScale(['init', '--dir', projectDir, '--governance-pack', 'project-scaffold', '--json'], scaleDir, projectDir)
    expect(init.exitCode).toBe(0)

    const check = await runScale(['upgrade', 'check', '--dir', projectDir, '--json'], scaleDir, projectDir)
    expect(check.exitCode).toBe(0)
    expect(parseJson<{ status: string; thirdParty: { policy: string } }>(check.stdout)).toMatchObject({
      status: 'clean',
      thirdParty: { policy: 'check-only' },
    })

    const plan = await runScale(['upgrade', 'plan', '--dir', projectDir, '--json'], scaleDir, projectDir)
    expect(plan.exitCode).toBe(0)
    expect(parseJson<{ applyMode: string; steps: unknown[] }>(plan.stdout)).toMatchObject({
      applyMode: 'safe',
    })
  }, 45000)

  it('safe-applies missing generated files and can roll them back', async () => {
    const scaleDir = makeDir('scale-upgrade-cli-')
    const projectDir = makeDir('scale-upgrade-project-')
    const missingPath = join(projectDir, 'docs', 'workflow', 'templates', 'summary.md')
    const init = await runScale(['init', '--dir', projectDir, '--governance-pack', 'project-scaffold', '--json'], scaleDir, projectDir)
    expect(init.exitCode).toBe(0)
    rmSync(missingPath)

    const apply = await runScale(['upgrade', 'apply', '--dir', projectDir, '--confirm', '--json'], scaleDir, projectDir)
    expect(apply.exitCode).toBe(0)
    expect(parseJson<{ ok: boolean; applied: boolean; changedFiles: string[] }>(apply.stdout)).toMatchObject({
      ok: true,
      applied: true,
      changedFiles: expect.arrayContaining(['docs/workflow/templates/summary.md']),
    })
    expect(existsSync(missingPath)).toBe(true)

    const rollback = await runScale(['upgrade', 'rollback', '--dir', projectDir, '--json'], scaleDir, projectDir)
    expect(rollback.exitCode).toBe(0)
    expect(parseJson<{ ok: boolean; restoredFiles: string[] }>(rollback.stdout)).toMatchObject({
      ok: true,
      restoredFiles: expect.arrayContaining(['docs/workflow/templates/summary.md']),
    })
    expect(existsSync(missingPath)).toBe(false)
  }, 45000)

  it('prints third-party tool and skill update surfaces without installing anything', async () => {
    const scaleDir = makeDir('scale-upgrade-cli-')
    const projectDir = makeDir('scale-upgrade-project-')
    const init = await runScale(['init', '--dir', projectDir, '--governance-pack', 'standard', '--json'], scaleDir, projectDir)
    expect(init.exitCode).toBe(0)

    const tools = await runScale(['tools', 'outdated', '--dir', projectDir, '--json'], scaleDir, projectDir)
    expect(tools.exitCode).toBe(0)
    expect(parseJson<{ policy: string; entries: Array<{ category: string; updatePolicy: string }> }>(tools.stdout)).toMatchObject({
      policy: 'check-only',
    })

    const skills = await runScale(['skill', 'outdated', '--dir', projectDir, '--json'], scaleDir, projectDir)
    expect(skills.exitCode).toBe(0)
    expect(parseJson<{ policy: string; entries: Array<{ category: string; updatePolicy: string }> }>(skills.stdout)).toMatchObject({
      policy: 'check-only',
    })
  }, 45000)
})
