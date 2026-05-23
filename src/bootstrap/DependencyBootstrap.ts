import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { execa } from 'execa'
import { inspectCodeIntelligence, writeCodeIntelligenceConfig } from '../codegraph/CodeIntelligence.js'
import { externalCommandExists } from '../core/ExternalCommand.js'
import { inspectMemoryProviders, useMemoryProvider, writeMemoryProvidersConfig } from '../memory/MemoryProviders.js'
import { wrapShellCommandWithRtk } from '../tools/RtkRuntime.js'
import { inspectToolCapabilities } from '../tools/ToolCapabilityRegistry.js'

export type DependencyBootstrapPackId = 'ui' | 'memory' | 'knowledge' | 'external-cli' | 'full'
export type DependencyBootstrapItemKind = 'skill' | 'cli'
export type DependencyBootstrapStatus = 'installed' | 'ready' | 'manual-review' | 'installed-now' | 'failed'

export interface DependencyBootstrapItemReport {
  id: string
  name: string
  kind: DependencyBootstrapItemKind
  packs: Array<Exclude<DependencyBootstrapPackId, 'full'>>
  source: string
  installed: boolean
  status: DependencyBootstrapStatus
  installCommand?: string
  installSupported: boolean
  detectedBy: string
  prerequisites: Array<{ command: string; present: boolean }>
  manualReason?: string
  output?: string
  error?: string
}

export interface DependencyBootstrapReport {
  ok: boolean
  complete: boolean
  projectDir: string
  scaleDir: string
  packIds: DependencyBootstrapPackId[]
  includeIds: string[]
  apply: boolean
  items: DependencyBootstrapItemReport[]
  summary: {
    total: number
    installed: number
    ready: number
    manualReview: number
    installedNow: number
    failed: number
  }
  postActions: string[]
  postChecks: DependencyBootstrapPostCheckResult[]
  postCheckSummary: {
    total: number
    passed: number
    warned: number
    failed: number
  }
  postCheckCommands: string[]
  rollbackHints: string[]
  recommendations: string[]
}

export interface DependencyBootstrapOptions {
  projectDir?: string
  scaleDir?: string
  packIds?: string[]
  includeIds?: string[]
  apply?: boolean
}

export interface DependencyBootstrapPostCheckResult {
  id: 'tool-capabilities' | 'memory-provider' | 'code-intelligence'
  label: string
  command: string
  status: 'passed' | 'warn' | 'failed'
  summary: string
  details?: Record<string, unknown>
}

interface DependencyBootstrapPostCheckDeps {
  inspectTools?: typeof inspectToolCapabilities
  inspectMemory?: typeof inspectMemoryProviders
  inspectCode?: typeof inspectCodeIntelligence
}

interface DependencyBootstrapPostActionDeps {
  writeMemoryConfig?: typeof writeMemoryProvidersConfig
  switchMemoryProvider?: typeof useMemoryProvider
  writeCodeConfig?: typeof writeCodeIntelligenceConfig
}

type BootstrapInstallContext = {
  projectDir: string
  homeDir: string
  commandExists: (command: string) => boolean
}

type DependencyBootstrapDefinition = {
  id: string
  name: string
  kind: DependencyBootstrapItemKind
  packs: Array<Exclude<DependencyBootstrapPackId, 'full'>>
  source: string
  detectCommand?: string
  detectSkillId?: string
  prerequisites: string[]
  manualReason: string
  installCommand: (ctx: BootstrapInstallContext) => string | null
}

const UI_SKILL_INSTALLS = {
  'awesome-design-md': 'npx skills add https://github.com/VoltAgent/awesome-design-md --skill awesome-design-md',
  'ui-ux-pro-max': 'npx skills add https://github.com/nextlevelbuilder/ui-ux-pro-max-skill --skill ui-ux-pro-max',
  'frontend-design': 'npx skills add anthropics/skills --skill frontend-design',
} as const

const RTK_INSTALL = 'cargo install --git https://github.com/rtk-ai/rtk'
const CODEGRAPH_INSTALL = 'npm install -g @colbymchenry/codegraph'
const GRAPHIFY_PIP_INSTALL = 'pip install graphifyy && graphify install'
const GRAPHIFY_PIP3_INSTALL = 'pip3 install graphifyy && graphify install'
const GRAPHIFY_PYTHON_INSTALL = 'python -m pip install graphifyy && graphify install'
const GRAPHIFY_PYTHON3_INSTALL = 'python3 -m pip install graphifyy && graphify install'
const GBRAIN_SOURCE = 'https://github.com/garrytan/gbrain'

const DEPENDENCY_BOOTSTRAP_DEFINITIONS: DependencyBootstrapDefinition[] = [
  {
    id: 'awesome-design-md',
    name: 'Awesome Design.md',
    kind: 'skill',
    packs: ['ui'],
    source: 'https://github.com/VoltAgent/awesome-design-md',
    detectSkillId: 'awesome-design-md',
    prerequisites: ['npx'],
    manualReason: 'Requires npm/npx and the local skills installer to be available before UI brand skills can be added.',
    installCommand: ctx => ctx.commandExists('npx') ? UI_SKILL_INSTALLS['awesome-design-md'] : null,
  },
  {
    id: 'ui-ux-pro-max',
    name: 'UI/UX Pro Max',
    kind: 'skill',
    packs: ['ui'],
    source: 'https://github.com/nextlevelbuilder/ui-ux-pro-max-skill',
    detectSkillId: 'ui-ux-pro-max',
    prerequisites: ['npx'],
    manualReason: 'Requires npm/npx and the local skills installer to be available before UI review skills can be added.',
    installCommand: ctx => ctx.commandExists('npx') ? UI_SKILL_INSTALLS['ui-ux-pro-max'] : null,
  },
  {
    id: 'frontend-design',
    name: 'Frontend Design',
    kind: 'skill',
    packs: ['ui'],
    source: 'https://github.com/anthropics/skills/tree/main/skills/frontend-design',
    detectSkillId: 'frontend-design',
    prerequisites: ['npx'],
    manualReason: 'Requires npm/npx and the local skills installer to be available before the implementation companion skill can be added.',
    installCommand: ctx => ctx.commandExists('npx') ? UI_SKILL_INSTALLS['frontend-design'] : null,
  },
  {
    id: 'rtk',
    name: 'RTK',
    kind: 'cli',
    packs: ['external-cli'],
    source: 'https://github.com/rtk-ai/rtk',
    detectCommand: 'rtk',
    prerequisites: ['cargo'],
    manualReason: 'RTK currently installs from the official Rust toolchain path and needs Cargo on PATH.',
    installCommand: ctx => ctx.commandExists('cargo') ? RTK_INSTALL : null,
  },
  {
    id: 'gbrain',
    name: 'GBrain',
    kind: 'cli',
    packs: ['memory'],
    source: GBRAIN_SOURCE,
    detectCommand: 'gbrain',
    prerequisites: ['git', 'bun'],
    manualReason: 'The official standalone GBrain install currently needs git + bun and links the CLI from a local clone.',
    installCommand: ctx => buildGbrainInstallCommand(ctx),
  },
  {
    id: 'graphify',
    name: 'Graphify',
    kind: 'cli',
    packs: ['knowledge'],
    source: 'https://github.com/safishamsi/graphify',
    detectCommand: 'graphify',
    prerequisites: ['pip|pip3|python|python3'],
    manualReason: 'Graphify requires Python 3.10+ and a working pip/python path before the CLI can be installed.',
    installCommand: ctx => buildGraphifyInstallCommand(ctx),
  },
  {
    id: 'codegraph',
    name: 'CodeGraph',
    kind: 'cli',
    packs: ['knowledge'],
    source: 'https://github.com/colbymchenry/codegraph',
    detectCommand: 'codegraph',
    prerequisites: ['npm'],
    manualReason: 'CodeGraph installs through npm and needs Node.js/npm available on PATH.',
    installCommand: ctx => ctx.commandExists('npm') ? CODEGRAPH_INSTALL : null,
  },
]

export async function bootstrapDependencies(options: DependencyBootstrapOptions = {}): Promise<DependencyBootstrapReport> {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const scaleDir = resolveScaleRoot(projectDir, options.scaleDir)
  const homeDir = homedir()
  const packIds = normalizePackIds(options.packIds)
  const includeIds = unique((options.includeIds ?? []).map(value => value.trim()).filter(Boolean))
  const definitions = selectDefinitions(packIds, includeIds)
  const context: BootstrapInstallContext = {
    projectDir,
    homeDir,
    commandExists: externalCommandExists,
  }
  const reports = definitions.map(definition => inspectDefinition(definition, context))

  if (options.apply) {
    for (const item of reports.filter(entry => entry.status === 'ready')) {
      if (!item.installCommand) continue
      const result = await runInstallCommand(item.installCommand)
      item.output = result.output
      item.error = result.error
      const definition = definitions.find(entry => entry.id === item.id)
      const rechecked = definition ? inspectDefinition(definition, context) : item
      item.installed = rechecked.installed
      item.detectedBy = rechecked.detectedBy
      item.status = result.ok && rechecked.installed ? 'installed-now' : 'failed'
      if (!result.ok && !item.error) item.error = `Installation command failed: ${item.installCommand}`
      if (!result.ok) item.installSupported = true
    }
  }

  const postActions = options.apply ? applyDependencyBootstrapPostActions(projectDir, scaleDir, reports) : []
  const postChecks = options.apply
    ? runDependencyBootstrapPostChecks({ projectDir, scaleDir, packIds, items: reports, homeDir })
    : []
  return buildReport(projectDir, scaleDir, packIds, includeIds, Boolean(options.apply), reports, postActions, postChecks)
}

function buildReport(
  projectDir: string,
  scaleDir: string,
  packIds: DependencyBootstrapPackId[],
  includeIds: string[],
  apply: boolean,
  items: DependencyBootstrapItemReport[],
  postActions: string[],
  postChecks: DependencyBootstrapPostCheckResult[],
): DependencyBootstrapReport {
  const summary = {
    total: items.length,
    installed: items.filter(item => item.status === 'installed').length,
    ready: items.filter(item => item.status === 'ready').length,
    manualReview: items.filter(item => item.status === 'manual-review').length,
    installedNow: items.filter(item => item.status === 'installed-now').length,
    failed: items.filter(item => item.status === 'failed').length,
  }
  const complete = items.length > 0 && items.every(item => item.status === 'installed' || item.status === 'installed-now')
  const postCheckSummary = {
    total: postChecks.length,
    passed: postChecks.filter(item => item.status === 'passed').length,
    warned: postChecks.filter(item => item.status === 'warn').length,
    failed: postChecks.filter(item => item.status === 'failed').length,
  }
  const recommendations: string[] = []
  const postCheckCommands = buildPostCheckCommands(packIds, items)
  const rollbackHints = buildRollbackHints(items)

  if (!apply && !complete) recommendations.push('Re-run with --apply to install all ready dependencies in one pass.')
  if (summary.manualReview > 0) recommendations.push('Review manual-review items for missing package managers, PATH setup, or platform-specific configuration.')
  if (items.some(item => item.id === 'gbrain')) recommendations.push('After GBrain is installed, validate remote or thin-client health with `scale memory provider status --json`.')
  if (items.some(item => item.id === 'graphify' || item.id === 'codegraph')) recommendations.push('After knowledge tools are installed, run `scale codegraph status --json` and initialize the project index or graph artifacts as needed.')
  if (postCheckSummary.failed > 0) recommendations.push('Resolve failed post-checks before treating the dependency bootstrap as production-ready.')
  if (postCheckSummary.warned > 0) recommendations.push('Review warned post-checks; they usually indicate provider initialization or project index/artifact setup is still pending.')

  return {
    ok: summary.failed === 0 && postCheckSummary.failed === 0,
    complete,
    projectDir,
    scaleDir,
    packIds,
    includeIds,
    apply,
    items,
    summary,
    postActions,
    postChecks,
    postCheckSummary,
    postCheckCommands,
    rollbackHints,
    recommendations,
  }
}

export function runDependencyBootstrapPostChecks(input: {
  projectDir: string
  scaleDir: string
  packIds: DependencyBootstrapPackId[]
  items: DependencyBootstrapItemReport[]
  homeDir?: string
}, deps: DependencyBootstrapPostCheckDeps = {}): DependencyBootstrapPostCheckResult[] {
  const inspectTools = deps.inspectTools ?? inspectToolCapabilities
  const inspectMemory = deps.inspectMemory ?? inspectMemoryProviders
  const inspectCode = deps.inspectCode ?? inspectCodeIntelligence
  const toolIds = unique(input.items.map(item => item.id).filter(id =>
    ['awesome-design-md', 'ui-ux-pro-max', 'frontend-design', 'rtk', 'gbrain', 'codegraph', 'graphify'].includes(id)))
  const results: DependencyBootstrapPostCheckResult[] = []

  if (toolIds.length > 0) {
    const toolReport = inspectTools({
      projectDir: input.projectDir,
      homeDir: input.homeDir,
      toolIds,
    })
    const missing = toolReport.tools.filter(tool => !tool.installed).map(tool => tool.id)
    results.push({
      id: 'tool-capabilities',
      label: 'Tool Doctor',
      command: `scale tool doctor --tools ${toolIds.join(',')} --json`,
      status: toolReport.ok ? 'passed' : 'failed',
      summary: `${toolReport.summary.installed}/${toolReport.summary.total} selected tools are available${missing.length > 0 ? `; missing: ${missing.join(', ')}` : ''}`,
      details: {
        toolIds,
        missing,
      },
    })
  }

  if (input.items.some(item => item.id === 'gbrain')) {
    const memoryReport = inspectMemory({ projectDir: input.projectDir, scaleDir: input.scaleDir })
    const gbrain = memoryReport.providers.find(provider => provider.id === 'gbrain')
    const warnings = [...memoryReport.warnings]
    const status = !gbrain?.available ? 'failed' : warnings.length > 0 ? 'warn' : 'passed'
    results.push({
      id: 'memory-provider',
      label: 'Memory Provider',
      command: 'scale memory provider status --json',
      status,
      summary: gbrain
        ? `mode=${memoryReport.routing.mode}; order=${memoryReport.routing.defaultOrder.join(' -> ')}; gbrain=${gbrain.available ? 'available' : 'unavailable'}`
        : 'gbrain provider entry is missing from routing policy',
      details: {
        warnings,
        gbrainReason: gbrain?.reason,
      },
    })
  }

  if (input.items.some(item => item.id === 'codegraph' || item.id === 'graphify')) {
    const codeReport = inspectCode({ projectDir: input.projectDir, scaleDir: input.scaleDir })
    const codegraph = codeReport.providers.find(provider => provider.id === 'codegraph')
    const graphify = codeReport.providers.find(provider => provider.id === 'graphify')
    const warnings: string[] = []
    let failed = false

    if (input.items.some(item => item.id === 'codegraph')) {
      if (!codegraph?.available) failed = true
      else if (!codeReport.projectIndexExists) warnings.push('codegraph CLI is installed but the project index (.codegraph/) is not initialized yet')
    }
    if (input.items.some(item => item.id === 'graphify') && !graphify?.available) {
      warnings.push('graphify CLI is installed but graphify-out/graph.json is not present yet')
    }

    results.push({
      id: 'code-intelligence',
      label: 'Code Intelligence',
      command: 'scale codegraph status --json',
      status: failed ? 'failed' : warnings.length > 0 ? 'warn' : 'passed',
      summary: [
        codegraph ? `codegraph=${codegraph.available ? 'available' : 'missing'}` : undefined,
        graphify ? `graphify-artifact=${graphify.available ? 'available' : 'missing'}` : undefined,
        `projectIndex=${codeReport.projectIndexExists ? 'present' : 'missing'}`,
      ].filter(Boolean).join('; '),
      details: {
        warnings,
      },
    })
  }

  return results
}

function inspectDefinition(definition: DependencyBootstrapDefinition, context: BootstrapInstallContext): DependencyBootstrapItemReport {
  const detectedBy = detectDefinition(definition, context.projectDir, context.homeDir)
  const installed = detectedBy !== 'missing'
  const prerequisites = definition.prerequisites.map(requirement => ({
    command: requirement,
    present: requirementSatisfied(requirement, context.commandExists),
  }))
  const installCommand = installed ? undefined : definition.installCommand(context) ?? undefined
  const installSupported = Boolean(installCommand)
  return {
    id: definition.id,
    name: definition.name,
    kind: definition.kind,
    packs: definition.packs,
    source: definition.source,
    installed,
    status: installed ? 'installed' : installSupported ? 'ready' : 'manual-review',
    installCommand,
    installSupported,
    detectedBy,
    prerequisites,
    manualReason: installed ? undefined : definition.manualReason,
  }
}

function detectDefinition(definition: DependencyBootstrapDefinition, projectDir: string, homeDir: string): string {
  if (definition.detectSkillId) {
    const path = skillCandidatePaths(projectDir, homeDir, definition.detectSkillId).find(candidate => existsSync(candidate))
    return path ?? 'missing'
  }
  if (definition.detectCommand && externalCommandExists(definition.detectCommand)) return `PATH:${definition.detectCommand}`
  return 'missing'
}

function skillCandidatePaths(projectDir: string, homeDir: string, skillId: string): string[] {
  return [
    join(projectDir, '.agents', 'skills', skillId, 'SKILL.md'),
    join(projectDir, '.codex', 'skills', skillId, 'SKILL.md'),
    join(projectDir, '.claude', 'skills', skillId, 'SKILL.md'),
    join(homeDir, '.agents', 'skills', skillId, 'SKILL.md'),
    join(homeDir, '.codex', 'skills', skillId, 'SKILL.md'),
    join(homeDir, '.claude', 'skills', skillId, 'SKILL.md'),
  ]
}

function requirementSatisfied(requirement: string, commandExists: (command: string) => boolean): boolean {
  return requirement.split('|').some(command => commandExists(command))
}

function buildGraphifyInstallCommand(context: BootstrapInstallContext): string | null {
  if (context.commandExists('pip')) return GRAPHIFY_PIP_INSTALL
  if (context.commandExists('pip3')) return GRAPHIFY_PIP3_INSTALL
  if (context.commandExists('python')) return GRAPHIFY_PYTHON_INSTALL
  if (context.commandExists('python3')) return GRAPHIFY_PYTHON3_INSTALL
  return null
}

function buildGbrainInstallCommand(context: BootstrapInstallContext): string | null {
  if (!context.commandExists('git') || !context.commandExists('bun')) return null
  const vendorRoot = join(context.homeDir, '.scale', 'vendor')
  const installDir = join(vendorRoot, 'gbrain')
  mkdirSync(vendorRoot, { recursive: true })
  const changeDir = process.platform === 'win32' ? `cd /d "${installDir}"` : `cd "${installDir}"`
  if (existsSync(installDir)) return `${changeDir} && git pull --ff-only && bun install && bun link`
  return `git clone ${GBRAIN_SOURCE}.git "${installDir}" && ${changeDir} && bun install && bun link`
}

async function runInstallCommand(shellCommand: string): Promise<{ ok: boolean; output?: string; error?: string }> {
  const wrapped = wrapShellCommandWithRtk(shellCommand)
  const result = wrapped
    ? await execa(wrapped.command, wrapped.args, { reject: false, timeout: 300_000, all: false })
    : await execa(shellCommand, { shell: true, reject: false, timeout: 300_000, all: false })
  return {
    ok: (result.exitCode ?? 1) === 0,
    output: result.stdout ?? '',
    error: result.stderr ?? '',
  }
}

export function applyDependencyBootstrapPostActions(
  projectDir: string,
  scaleDir: string,
  items: DependencyBootstrapItemReport[],
  deps: DependencyBootstrapPostActionDeps = {},
): string[] {
  const writeMemoryConfig = deps.writeMemoryConfig ?? writeMemoryProvidersConfig
  const switchMemoryProvider = deps.switchMemoryProvider ?? useMemoryProvider
  const writeCodeConfig = deps.writeCodeConfig ?? writeCodeIntelligenceConfig
  const ids = new Set(items.map(item => item.id))
  const actions: string[] = []

  if (ids.has('gbrain')) {
    const memoryConfig = writeMemoryConfig({ projectDir, scaleDir })
    actions.push(`${memoryConfig.written ? 'Wrote' : 'Reused'} ${memoryConfig.path}`)
    const provider = switchMemoryProvider({ projectDir, scaleDir, provider: 'gbrain' })
    const previousOrder = provider.previousOrder.join(' -> ')
    const nextOrder = provider.nextOrder.join(' -> ')
    actions.push(previousOrder === nextOrder
      ? `Memory provider order unchanged: ${nextOrder}`
      : `Memory provider order: ${previousOrder} => ${nextOrder}`)
  }

  if (ids.has('graphify') || ids.has('codegraph')) {
    const codeIntelligence = writeCodeConfig({ projectDir, scaleDir })
    actions.push(`${codeIntelligence.written ? 'Wrote' : 'Reused'} ${codeIntelligence.path}`)
  }
  return actions
}

function selectDefinitions(packIds: DependencyBootstrapPackId[], includeIds: string[]): DependencyBootstrapDefinition[] {
  const selectedPacks = new Set(packIds.includes('full') ? ['ui', 'memory', 'knowledge', 'external-cli'] : packIds)
  const selectedIds = new Set(includeIds)
  return DEPENDENCY_BOOTSTRAP_DEFINITIONS.filter(definition =>
    definition.packs.some(pack => selectedPacks.has(pack)) || selectedIds.has(definition.id))
}

function buildPostCheckCommands(packIds: DependencyBootstrapPackId[], items: DependencyBootstrapItemReport[]): string[] {
  const commands = new Set<string>()
  const selectedPacks = new Set(packIds.includes('full') ? ['ui', 'memory', 'knowledge', 'external-cli'] : packIds)
  const ids = new Set(items.map(item => item.id))

  if (selectedPacks.has('ui')) {
    commands.add('scale tool doctor --tools awesome-design-md,ui-ux-pro-max,frontend-design --json')
    commands.add('scale skill doctor --json')
  }
  if (selectedPacks.has('memory') || ids.has('gbrain')) {
    commands.add('scale memory provider status --json')
  }
  if (selectedPacks.has('knowledge') || ids.has('codegraph') || ids.has('graphify')) {
    commands.add('scale tool doctor --tools codegraph,graphify --json')
    commands.add('scale codegraph status --json')
  }
  if (selectedPacks.has('external-cli') || ids.has('rtk')) {
    commands.add('scale tool doctor --tools rtk --json')
  }
  commands.add('scale doctor')
  return [...commands]
}

function buildRollbackHints(items: DependencyBootstrapItemReport[]): string[] {
  const hints = new Set<string>()
  for (const item of items) {
    switch (item.id) {
      case 'rtk':
        hints.add('RTK rollback: cargo uninstall rtk')
        break
      case 'codegraph':
        hints.add('CodeGraph rollback: npm uninstall -g @colbymchenry/codegraph')
        break
      case 'graphify':
        hints.add('Graphify rollback: pip uninstall graphifyy  # or pip3/python -m pip uninstall graphifyy')
        break
      case 'gbrain':
        hints.add('GBrain rollback: bun unlink gbrain, then remove ~/.scale/vendor/gbrain if you want a full local cleanup')
        break
      case 'awesome-design-md':
      case 'ui-ux-pro-max':
      case 'frontend-design':
        hints.add(`Skill rollback (${item.id}): remove the installed skill directory under ~/.agents/skills/${item.id} after review`)
        break
      default:
        break
    }
  }
  return [...hints]
}

function normalizePackIds(input: string[] | undefined): DependencyBootstrapPackId[] {
  const requested = unique((input ?? ['full']).map(value => value.trim()).filter(Boolean))
  const packIds = requested
    .flatMap(value => value.split(','))
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => normalizePackId(value))
    .filter((value): value is DependencyBootstrapPackId => value !== null)
  return packIds.length > 0 ? unique(packIds) : ['full']
}

function normalizePackId(value: string): DependencyBootstrapPackId | null {
  if (value === 'ui' || value === 'memory' || value === 'knowledge' || value === 'external-cli' || value === 'full') return value
  if (value === 'external' || value === 'cli') return 'external-cli'
  return null
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function resolveScaleRoot(projectDir: string, scaleDir: string | undefined): string {
  const candidate = scaleDir ?? '.scale'
  return resolve(projectDir, candidate)
}
