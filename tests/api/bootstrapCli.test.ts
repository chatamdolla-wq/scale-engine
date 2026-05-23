import { afterEach, describe, expect, it } from 'vitest'
import { execa } from 'execa'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'

let dirs: string[] = []
const CLI_ENTRY = join(process.cwd(), 'src/api/cli.ts')
const TSX_LOADER = pathToFileURL(join(process.cwd(), 'node_modules/tsx/dist/loader.mjs')).href

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

function makeDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  dirs.push(dir)
  return dir
}

async function runScale(args: string[], scaleDir: string, projectDir: string, homeDir: string, cwd = process.cwd()) {
  return execa('node', ['--import', TSX_LOADER, CLI_ENTRY, ...args], {
    cwd,
    env: {
      ...process.env,
      HOME: homeDir,
      USERPROFILE: homeDir,
      SCALE_DIR: scaleDir,
      SCALE_PROJECT_DIR: projectDir,
      SCALE_LOG_LEVEL: undefined,
    },
    reject: false,
  })
}

describe('bootstrap CLI', () => {
  it('plans UI dependency bootstrap in a fresh home directory', async () => {
    const scaleDir = makeDir('scale-bootstrap-cli-scale-')
    const projectDir = makeDir('scale-bootstrap-cli-project-')
    const homeDir = makeDir('scale-bootstrap-cli-home-')

    const result = await runScale(['bootstrap', 'deps', '--dir', projectDir, '--pack', 'ui', '--json'], scaleDir, projectDir, homeDir)

    expect(result.exitCode).toBe(0)
    const report = JSON.parse(result.stdout) as {
      apply: boolean
      packIds: string[]
      summary: { total: number; ready: number; manualReview: number }
      postChecks: Array<unknown>
      postCheckSummary: { total: number; passed: number; warned: number; failed: number }
      items: Array<{ id: string; status: string; installCommand?: string }>
      postCheckCommands: string[]
      rollbackHints: string[]
      recommendations: string[]
    }
    expect(report.apply).toBe(false)
    expect(report.packIds).toEqual(['ui'])
    expect(report.summary.total).toBe(3)
    expect(report.summary.ready).toBe(3)
    expect(report.summary.manualReview).toBe(0)
    expect(report.postChecks).toEqual([])
    expect(report.postCheckSummary).toMatchObject({ total: 0, passed: 0, warned: 0, failed: 0 })
    expect(report.items.map(item => item.id)).toEqual(['awesome-design-md', 'ui-ux-pro-max', 'frontend-design'])
    expect(report.items.every(item => item.status === 'ready')).toBe(true)
    expect(report.items.every(item => item.installCommand?.includes('npx skills add'))).toBe(true)
    expect(report.postCheckCommands).toEqual(expect.arrayContaining([
      'scale tool doctor --tools awesome-design-md,ui-ux-pro-max,frontend-design --json',
      'scale skill doctor --json',
      'scale doctor',
    ]))
    expect(report.rollbackHints).toEqual(expect.arrayContaining([
      'Skill rollback (awesome-design-md): remove the installed skill directory under ~/.agents/skills/awesome-design-md after review',
    ]))
    expect(report.recommendations).toEqual(expect.arrayContaining([
      'Re-run with --apply to install all ready dependencies in one pass.',
    ]))
  }, 30_000)

  it('reports workflow capability planning and bootstrap hint during init', async () => {
    const scaleDir = makeDir('scale-bootstrap-cli-scale-')
    const projectDir = makeDir('scale-bootstrap-cli-project-')
    const homeDir = makeDir('scale-bootstrap-cli-home-')

    const result = await runScale(['init', '--dir', projectDir, '--governance-pack', 'standard', '--json'], scaleDir, projectDir, homeDir)

    expect(result.exitCode).toBe(0)
    const report = JSON.parse(result.stdout) as {
      ok: boolean
      workflowCapabilities: string[]
      capabilitiesEnabled: string[]
      dependencyBootstrapCommand: string
    }
    expect(report.ok).toBe(true)
    expect(report.workflowCapabilities).toEqual(['browser', 'search', 'computer'])
    expect(report.capabilitiesEnabled).toEqual(report.workflowCapabilities)
    expect(report.dependencyBootstrapCommand).toBe('scale bootstrap deps --pack external-cli --json')
  }, 30_000)

  it('derives bootstrap packs from profile and governance pack hints', async () => {
    const scaleDir = makeDir('scale-bootstrap-cli-scale-')
    const projectDir = makeDir('scale-bootstrap-cli-project-')
    const homeDir = makeDir('scale-bootstrap-cli-home-')

    const result = await runScale(
      ['bootstrap', 'deps', '--dir', projectDir, '--profile', 'advanced', '--governance-pack', 'frontend-app', '--json'],
      scaleDir,
      projectDir,
      homeDir,
    )

    expect(result.exitCode).toBe(0)
    const report = JSON.parse(result.stdout) as {
      packIds: string[]
      items: Array<{ id: string }>
      postCheckCommands: string[]
    }
    expect(report.packIds).toEqual(['external-cli', 'memory', 'knowledge', 'ui'])
    expect(report.items.map(item => item.id)).toEqual(expect.arrayContaining([
      'rtk',
      'gbrain',
      'codegraph',
      'graphify',
      'awesome-design-md',
      'ui-ux-pro-max',
      'frontend-design',
    ]))
    expect(report.postCheckCommands).toEqual(expect.arrayContaining([
      'scale tool doctor --tools rtk --json',
      'scale memory provider status --json',
      'scale tool doctor --tools codegraph,graphify --json',
      'scale tool doctor --tools awesome-design-md,ui-ux-pro-max,frontend-design --json',
    ]))
  }, 30_000)

  it('returns profile bootstrap guidance when switching config profiles', async () => {
    const scaleDir = makeDir('scale-bootstrap-cli-scale-')
    const projectDir = makeDir('scale-bootstrap-cli-project-')
    const homeDir = makeDir('scale-bootstrap-cli-home-')

    const result = await runScale(
      ['config', 'profile', '--set', 'advanced', '--governance-pack', 'frontend-app', '--json'],
      scaleDir,
      projectDir,
      homeDir,
      projectDir,
    )

    expect(result.exitCode).toBe(0)
    const report = JSON.parse(result.stdout) as {
      ok: boolean
      profile: string
      bootstrapPacks: string[]
      dependencyBootstrapCommand: string
      dependencyBootstrapApplyCommand: string
      configPath: string
    }
    expect(report.ok).toBe(true)
    expect(report.profile).toBe('advanced')
    expect(report.bootstrapPacks).toEqual(['external-cli', 'memory', 'knowledge', 'ui'])
    expect(report.dependencyBootstrapCommand).toBe('scale bootstrap deps --pack external-cli,memory,knowledge,ui --json')
    expect(report.dependencyBootstrapApplyCommand).toBe('scale bootstrap deps --pack external-cli,memory,knowledge,ui --apply')
    expect(report.configPath.replaceAll('\\', '/')).toBe('.scale/config.yaml')
  }, 30_000)
})
