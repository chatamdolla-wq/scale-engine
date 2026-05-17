import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export type ToolCapabilityCategory = 'skill' | 'cli' | 'mcp'
export type ToolCapabilityStatus = 'installed' | 'missing'

export interface ToolCatalogEntry {
  id: string
  name: string
  category: ToolCapabilityCategory
  requiredFor: string[]
  recommendedFor?: string[]
  skillId?: string
  command?: string
  versionArgs?: string[]
  envFlag?: string
  source?: string
}

export interface ToolCapabilityEntry extends ToolCatalogEntry {
  installed: boolean
  status: ToolCapabilityStatus
  checkedPaths: string[]
  detectedPath?: string
  version?: string
  missingReason?: string
}

export interface ToolCapabilitySummary {
  total: number
  installed: number
  missing: number
}

export interface ToolCapabilityReport {
  ok: boolean
  summary: ToolCapabilitySummary
  tools: ToolCapabilityEntry[]
}

export interface ToolCapabilityRegistryOptions {
  projectDir?: string
  homeDir?: string
  toolIds?: string[]
  env?: Record<string, string | undefined>
  commandExists?: (command: string) => boolean
  runVersion?: (command: string, args: string[]) => { ok: boolean; stdout?: string; stderr?: string }
}

export const TOOL_CAPABILITY_CATALOG: ToolCatalogEntry[] = [
  {
    id: 'web-access',
    name: 'Web Access',
    category: 'skill',
    skillId: 'web-access',
    requiredFor: ['webResearch'],
    recommendedFor: ['browserAutomation'],
    source: 'https://github.com/eze-is/web-access',
  },
  {
    id: 'frontend-design',
    name: 'Frontend Design',
    category: 'skill',
    skillId: 'frontend-design',
    requiredFor: ['ui'],
    source: 'https://github.com/anthropics/skills/tree/main/skills/frontend-design',
  },
  {
    id: 'ui-ux-pro-max',
    name: 'UI/UX Pro Max',
    category: 'skill',
    skillId: 'ui-ux-pro-max',
    requiredFor: ['ui'],
    source: 'https://github.com/nextlevelbuilder/ui-ux-pro-max-skill',
  },
  {
    id: 'awesome-design-md',
    name: 'Awesome Design.md',
    category: 'skill',
    skillId: 'awesome-design-md',
    requiredFor: [],
    recommendedFor: ['ui'],
    source: 'https://github.com/VoltAgent/awesome-design-md',
  },
  {
    id: 'agent-browser',
    name: 'Agent Browser',
    category: 'cli',
    command: 'agent-browser',
    versionArgs: ['--version'],
    requiredFor: ['browserAutomation'],
    recommendedFor: ['ui', 'e2e'],
    source: 'https://github.com/vercel-labs/agent-browser',
  },
  {
    id: 'playwright',
    name: 'Playwright',
    category: 'cli',
    command: 'npx',
    versionArgs: ['playwright', '--version'],
    requiredFor: ['e2e'],
    recommendedFor: ['browserAutomation', 'ui'],
    source: 'https://playwright.dev',
  },
  {
    id: 'mcp-chrome-devtools',
    name: 'Chrome DevTools MCP',
    category: 'mcp',
    envFlag: 'SCALE_MCP_CHROME_DEVTOOLS',
    requiredFor: ['browserAutomation'],
    recommendedFor: ['ui', 'e2e'],
    source: 'https://github.com/ChromeDevTools/chrome-devtools-mcp',
  },
  {
    id: 'desktop-cua',
    name: 'CUA',
    category: 'cli',
    command: 'cua',
    versionArgs: ['--version'],
    requiredFor: ['desktopAutomation'],
    source: 'https://github.com/trycua/cua',
  },
  {
    id: 'codex-cli',
    name: 'Codex CLI',
    category: 'cli',
    command: 'codex',
    versionArgs: ['--version'],
    requiredFor: [],
    recommendedFor: ['externalCli', 'review'],
    source: 'https://github.com/openai/codex',
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    category: 'cli',
    command: 'gemini',
    versionArgs: ['--version'],
    requiredFor: [],
    recommendedFor: ['externalCli', 'review'],
    source: 'https://github.com/google-gemini/gemini-cli',
  },
  {
    id: 'opencode-cli',
    name: 'OpenCode CLI',
    category: 'cli',
    command: 'opencode',
    versionArgs: ['--version'],
    requiredFor: [],
    recommendedFor: ['externalCli', 'review'],
    source: 'https://github.com/sst/opencode',
  },
]

export function inspectToolCapabilities(options: ToolCapabilityRegistryOptions = {}): ToolCapabilityReport {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const homeDir = options.homeDir ?? homedir()
  const env = options.env ?? process.env
  const selected = new Set(options.toolIds ?? TOOL_CAPABILITY_CATALOG.map(tool => tool.id))
  const tools = TOOL_CAPABILITY_CATALOG
    .filter(tool => selected.has(tool.id))
    .map(tool => inspectToolCapability(tool, {
      projectDir,
      homeDir,
      env,
      commandExists: options.commandExists ?? defaultCommandExists,
      runVersion: options.runVersion ?? defaultRunVersion,
    }))
  const installed = tools.filter(tool => tool.installed).length
  const missing = tools.length - installed
  return {
    ok: missing === 0,
    summary: {
      total: tools.length,
      installed,
      missing,
    },
    tools,
  }
}

interface InspectToolCapabilityDeps {
  projectDir: string
  homeDir: string
  env: Record<string, string | undefined>
  commandExists: (command: string) => boolean
  runVersion: (command: string, args: string[]) => { ok: boolean; stdout?: string; stderr?: string }
}

function inspectToolCapability(tool: ToolCatalogEntry, deps: InspectToolCapabilityDeps): ToolCapabilityEntry {
  if (tool.category === 'skill') return inspectSkillTool(tool, deps)
  if (tool.category === 'cli') return inspectCliTool(tool, deps)
  return inspectMcpTool(tool, deps)
}

function inspectSkillTool(tool: ToolCatalogEntry, deps: InspectToolCapabilityDeps): ToolCapabilityEntry {
  const checkedPaths = skillCandidatePaths(tool.skillId ?? tool.id, deps.projectDir, deps.homeDir)
  const detectedPath = checkedPaths.find(path => existsSync(path))
  return {
    ...tool,
    checkedPaths,
    detectedPath,
    installed: Boolean(detectedPath),
    status: detectedPath ? 'installed' : 'missing',
    missingReason: detectedPath ? undefined : 'SKILL.md was not found in project or user skill directories',
  }
}

function inspectCliTool(tool: ToolCatalogEntry, deps: InspectToolCapabilityDeps): ToolCapabilityEntry {
  const command = tool.command ?? tool.id
  const checkedPaths = [`PATH:${command}`]
  if (!deps.commandExists(command)) {
    return {
      ...tool,
      checkedPaths,
      installed: false,
      status: 'missing',
      missingReason: `Command not found: ${command}`,
    }
  }
  const version = deps.runVersion(command, tool.versionArgs ?? ['--version'])
  return {
    ...tool,
    checkedPaths,
    installed: true,
    status: 'installed',
    version: version.ok ? (version.stdout ?? '').trim() : undefined,
    missingReason: version.ok ? undefined : version.stderr ?? 'Version command failed',
  }
}

function inspectMcpTool(tool: ToolCatalogEntry, deps: InspectToolCapabilityDeps): ToolCapabilityEntry {
  const envFlag = tool.envFlag ?? `SCALE_MCP_${tool.id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
  const installed = truthy(deps.env[envFlag])
  return {
    ...tool,
    checkedPaths: [`env:${envFlag}`],
    installed,
    status: installed ? 'installed' : 'missing',
    missingReason: installed ? undefined : `MCP availability flag is not set: ${envFlag}`,
  }
}

function skillCandidatePaths(skillId: string, projectDir: string, homeDir: string): string[] {
  return [
    join(projectDir, '.agents', 'skills', skillId, 'SKILL.md'),
    join(projectDir, '.codex', 'skills', skillId, 'SKILL.md'),
    join(projectDir, '.claude', 'skills', skillId, 'SKILL.md'),
    join(homeDir, '.agents', 'skills', skillId, 'SKILL.md'),
    join(homeDir, '.codex', 'skills', skillId, 'SKILL.md'),
    join(homeDir, '.claude', 'skills', skillId, 'SKILL.md'),
  ]
}

function defaultCommandExists(command: string): boolean {
  try {
    execFileSync(process.platform === 'win32' ? 'where.exe' : 'which', [command], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function defaultRunVersion(command: string, args: string[]): { ok: boolean; stdout?: string; stderr?: string } {
  try {
    const stdout = execFileSync(command, args, { encoding: 'utf-8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] })
    return { ok: true, stdout }
  } catch (error) {
    return {
      ok: false,
      stderr: error instanceof Error ? error.message : String(error),
    }
  }
}

function truthy(value: string | undefined): boolean {
  if (!value) return false
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(value.toLowerCase())
}
