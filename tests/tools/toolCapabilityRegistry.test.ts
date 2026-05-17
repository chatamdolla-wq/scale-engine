import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { inspectToolCapabilities } from '../../src/tools/ToolCapabilityRegistry.js'

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

function writeSkill(root: string, skillId: string): string {
  const dir = join(root, '.agents', 'skills', skillId)
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'SKILL.md')
  writeFileSync(file, `---\nname: ${skillId}\n---\n`, 'utf-8')
  return file
}

describe('ToolCapabilityRegistry', () => {
  it('detects installed skill files and CLI tool versions through injectable probes', () => {
    const homeDir = makeDir('scale-tools-home-')
    const projectDir = makeDir('scale-tools-project-')
    const webAccessPath = writeSkill(homeDir, 'web-access')

    const report = inspectToolCapabilities({
      projectDir,
      homeDir,
      toolIds: ['web-access', 'agent-browser', 'codex-cli'],
      commandExists: command => command === 'codex',
      runVersion: command => ({ ok: command === 'codex', stdout: 'codex 1.2.3' }),
    })

    expect(report.ok).toBe(false)
    expect(report.tools.find(tool => tool.id === 'web-access')).toMatchObject({
      id: 'web-access',
      category: 'skill',
      installed: true,
      status: 'installed',
      detectedPath: webAccessPath,
    })
    expect(report.tools.find(tool => tool.id === 'codex-cli')).toMatchObject({
      id: 'codex-cli',
      category: 'cli',
      installed: true,
      status: 'installed',
      version: 'codex 1.2.3',
    })
    expect(report.tools.find(tool => tool.id === 'agent-browser')).toMatchObject({
      installed: false,
      status: 'missing',
    })
    expect(report.summary).toMatchObject({
      total: 3,
      installed: 2,
      missing: 1,
    })
  })

  it('reports MCP tools from explicit environment flags without assuming availability', () => {
    const report = inspectToolCapabilities({
      projectDir: makeDir('scale-tools-project-'),
      homeDir: makeDir('scale-tools-home-'),
      toolIds: ['mcp-chrome-devtools'],
      env: {
        SCALE_MCP_CHROME_DEVTOOLS: '1',
      },
    })

    expect(report.ok).toBe(true)
    expect(report.tools[0]).toMatchObject({
      id: 'mcp-chrome-devtools',
      category: 'mcp',
      installed: true,
      status: 'installed',
    })
  })
})
