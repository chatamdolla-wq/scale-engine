import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { MemoryBrain, type MemoryNode } from './MemoryBrain.js'

export type MemoryProviderKind = 'scale-local' | 'agentmemory' | 'gbrain' | 'generic-http'
export type MemoryProviderCapability = 'keyword-recall' | 'semantic-recall' | 'graph-recall' | 'session-memory' | 'mcp' | 'write-memory'
export type MemoryProviderSafetyLevel = 'trusted-local' | 'review-required' | 'blocked'
export type MemoryProviderWriteMode = 'disabled' | 'candidate-only' | 'enabled'

export interface MemoryProviderConfig {
  id: string
  kind: MemoryProviderKind
  enabled: boolean
  priority: number
  endpoint?: string
  statusPath?: string
  searchPath?: string
  apiKeyEnv?: string
  capabilities: MemoryProviderCapability[]
  safetyLevel: MemoryProviderSafetyLevel
  writeMode: MemoryProviderWriteMode
  attribution?: {
    license: string
    sourceUrl: string
    notice: string
  }
}

export interface MemoryProviderRoutingConfig {
  mode: 'auto' | 'local-only' | 'external-first'
  defaultOrder: string[]
  allowExternalWrite: boolean
  requireEvidence: boolean
  maxResultsPerProvider: number
}

export interface MemoryProvidersConfig {
  version: '1.0'
  routing: MemoryProviderRoutingConfig
  providers: MemoryProviderConfig[]
}

export interface MemoryProviderStatus {
  id: string
  kind: MemoryProviderKind
  enabled: boolean
  available: boolean
  selectedByDefault: boolean
  priority: number
  capabilities: MemoryProviderCapability[]
  safetyLevel: MemoryProviderSafetyLevel
  writeMode: MemoryProviderWriteMode
  reason: string
}

export interface MemoryProviderStatusReport {
  projectDir: string
  scaleDir: string
  configPath: string
  configExists: boolean
  routing: MemoryProviderRoutingConfig
  providers: MemoryProviderStatus[]
  availableProviderCount: number
  warnings: string[]
}

export interface MemoryProviderRecallInput {
  query: string
  task?: string
  files?: string[]
  limit?: number
  provider?: string
  includeCandidates?: boolean
}

export interface MemoryProviderRecallItem {
  provider: string
  id: string
  title: string
  summary: string
  confidence: number
  score: number
  evidencePaths: string[]
  sourceUrl?: string
  metadata?: Record<string, unknown>
}

export interface MemoryProviderRecallReport {
  ok: boolean
  projectDir: string
  generatedAt: string
  query: string
  providerOrder: string[]
  selectedProviders: string[]
  fallbackUsed: boolean
  items: MemoryProviderRecallItem[]
  providerStatuses: MemoryProviderStatus[]
  warnings: string[]
}

export function defaultMemoryProvidersConfig(): MemoryProvidersConfig {
  return {
    version: '1.0',
    routing: {
      mode: 'auto',
      defaultOrder: ['agentmemory', 'gbrain', 'scale-local'],
      allowExternalWrite: false,
      requireEvidence: true,
      maxResultsPerProvider: 5,
    },
    providers: [
      {
        id: 'agentmemory',
        kind: 'agentmemory',
        enabled: false,
        priority: 90,
        endpoint: process.env.AGENTMEMORY_ENDPOINT,
        statusPath: '/health',
        searchPath: '/search',
        apiKeyEnv: 'AGENTMEMORY_API_KEY',
        capabilities: ['semantic-recall', 'session-memory', 'mcp'],
        safetyLevel: 'review-required',
        writeMode: 'disabled',
        attribution: {
          license: 'Apache-2.0',
          sourceUrl: 'https://github.com/rohitg00/agentmemory',
          notice: 'Optional external memory provider. Do not enable writes until retention, privacy, and delete boundaries are reviewed.',
        },
      },
      {
        id: 'gbrain',
        kind: 'gbrain',
        enabled: false,
        priority: 80,
        endpoint: process.env.GBRAIN_ENDPOINT,
        statusPath: '/health',
        searchPath: '/search',
        apiKeyEnv: 'GBRAIN_API_KEY',
        capabilities: ['semantic-recall', 'graph-recall', 'session-memory', 'mcp'],
        safetyLevel: 'review-required',
        writeMode: 'disabled',
        attribution: {
          license: 'MIT',
          sourceUrl: 'https://github.com/garrytan/gbrain',
          notice: 'Optional graph memory provider. Treat returned knowledge as recall evidence, not final truth.',
        },
      },
      {
        id: 'scale-local',
        kind: 'scale-local',
        enabled: true,
        priority: 10,
        capabilities: ['keyword-recall'],
        safetyLevel: 'trusted-local',
        writeMode: 'candidate-only',
      },
    ],
  }
}

export function memoryProvidersConfigPath(projectDir = process.cwd(), scaleDir = '.scale'): string {
  return join(resolveScaleRoot(projectDir, scaleDir), 'memory-providers.json')
}

export function writeMemoryProvidersConfig(options: {
  projectDir?: string
  scaleDir?: string
  force?: boolean
} = {}): { path: string; written: boolean; config: MemoryProvidersConfig } {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const path = memoryProvidersConfigPath(projectDir, options.scaleDir)
  if (existsSync(path) && !options.force) {
    return { path, written: false, config: loadMemoryProvidersConfig(projectDir, options.scaleDir).config }
  }
  mkdirSync(dirname(path), { recursive: true })
  const config = defaultMemoryProvidersConfig()
  writeFileSync(path, JSON.stringify(config, null, 2), 'utf-8')
  return { path, written: true, config }
}

export function loadMemoryProvidersConfig(projectDir = process.cwd(), scaleDir = '.scale'): {
  config: MemoryProvidersConfig
  path: string
  exists: boolean
} {
  const path = memoryProvidersConfigPath(projectDir, scaleDir)
  if (!existsSync(path)) return { config: defaultMemoryProvidersConfig(), path, exists: false }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Partial<MemoryProvidersConfig>
    const defaults = defaultMemoryProvidersConfig()
    return {
      path,
      exists: true,
      config: {
        version: '1.0',
        routing: {
          ...defaults.routing,
          ...(parsed.routing ?? {}),
          defaultOrder: Array.isArray(parsed.routing?.defaultOrder) ? parsed.routing.defaultOrder.map(String) : defaults.routing.defaultOrder,
          maxResultsPerProvider: positiveInt(parsed.routing?.maxResultsPerProvider, defaults.routing.maxResultsPerProvider),
        },
        providers: normalizeProviders(parsed.providers, defaults.providers),
      },
    }
  } catch {
    return { config: defaultMemoryProvidersConfig(), path, exists: true }
  }
}

export function inspectMemoryProviders(options: {
  projectDir?: string
  scaleDir?: string
} = {}): MemoryProviderStatusReport {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const loaded = loadMemoryProvidersConfig(projectDir, options.scaleDir)
  const statuses = loaded.config.providers
    .map(provider => providerStatus(provider, loaded.config.routing))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
  return {
    projectDir,
    scaleDir: resolveScaleRoot(projectDir, options.scaleDir),
    configPath: loaded.path,
    configExists: loaded.exists,
    routing: loaded.config.routing,
    providers: statuses,
    availableProviderCount: statuses.filter(status => status.available).length,
    warnings: providerWarnings(statuses, loaded.config),
  }
}

export async function recallMemoryProviders(options: {
  projectDir?: string
  scaleDir?: string
} & MemoryProviderRecallInput): Promise<MemoryProviderRecallReport> {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const loaded = loadMemoryProvidersConfig(projectDir, options.scaleDir)
  const statuses = inspectMemoryProviders({ projectDir, scaleDir: options.scaleDir }).providers
  const limit = Math.max(1, Math.floor(options.limit ?? loaded.config.routing.maxResultsPerProvider))
  const providers = orderedProviders(loaded.config, options.provider)
  const warnings: string[] = []
  const items: MemoryProviderRecallItem[] = []
  const selectedProviders: string[] = []
  let fallbackUsed = false

  for (const provider of providers) {
    const status = statuses.find(item => item.id === provider.id)
    if (!status?.available) {
      warnings.push(`${provider.id} skipped: ${status?.reason ?? 'not available'}`)
      continue
    }
    try {
      const recalled = provider.kind === 'scale-local'
        ? recallLocal(projectDir, options.scaleDir, provider, options, limit)
        : await recallExternal(provider, options, limit)
      if (recalled.length > 0) {
        selectedProviders.push(provider.id)
        items.push(...recalled)
      }
      if (provider.kind === 'scale-local' && providers.some(item => item.kind !== 'scale-local')) fallbackUsed = true
    } catch (error) {
      warnings.push(`${provider.id} recall failed: ${(error as Error).message}`)
    }
    if (items.length >= limit && !options.provider) break
  }

  return {
    ok: items.length > 0,
    projectDir,
    generatedAt: new Date().toISOString(),
    query: options.query,
    providerOrder: providers.map(provider => provider.id),
    selectedProviders,
    fallbackUsed,
    items: items
      .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
      .slice(0, limit),
    providerStatuses: statuses,
    warnings,
  }
}

function orderedProviders(config: MemoryProvidersConfig, providerId?: string): MemoryProviderConfig[] {
  const candidates = config.routing.mode === 'local-only'
    ? config.providers.filter(provider => provider.kind === 'scale-local')
    : config.providers
  const selected = providerId ? candidates.filter(provider => provider.id === providerId) : candidates
  const order = config.routing.mode === 'local-only'
    ? ['scale-local']
    : config.routing.defaultOrder
  return selected.sort((a, b) => {
    const ai = order.indexOf(a.id)
    const bi = order.indexOf(b.id)
    const orderRank = (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    return orderRank || b.priority - a.priority || a.id.localeCompare(b.id)
  })
}

function recallLocal(
  projectDir: string,
  scaleDir: string | undefined,
  provider: MemoryProviderConfig,
  input: MemoryProviderRecallInput,
  limit: number,
): MemoryProviderRecallItem[] {
  const brain = new MemoryBrain({ projectDir, scaleDir })
  try {
    const active = brain.query(input.query, { limit, status: 'active' }).nodes
    const nodes = active.length > 0 || !input.includeCandidates
      ? active
      : brain.query(input.query, { limit }).nodes
    return nodes.map(node => nodeToRecall(provider.id, node))
  } finally {
    brain.close()
  }
}

async function recallExternal(
  provider: MemoryProviderConfig,
  input: MemoryProviderRecallInput,
  limit: number,
): Promise<MemoryProviderRecallItem[]> {
  if (!provider.endpoint) return []
  const response = await fetch(new URL(provider.searchPath ?? '/search', provider.endpoint), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(provider.apiKeyEnv && process.env[provider.apiKeyEnv] ? { authorization: `Bearer ${process.env[provider.apiKeyEnv]}` } : {}),
    },
    body: JSON.stringify({
      query: input.query,
      task: input.task,
      files: input.files ?? [],
      limit,
    }),
    signal: AbortSignal.timeout(2500),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = await response.json() as unknown
  const raw = extractExternalResults(data)
  return raw.slice(0, limit).map((item, index) => externalToRecall(provider.id, item, index))
}

function extractExternalResults(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) return data.filter(isRecord)
  if (!isRecord(data)) return []
  for (const key of ['results', 'items', 'memories', 'nodes', 'documents']) {
    const value = data[key]
    if (Array.isArray(value)) return value.filter(isRecord)
  }
  return []
}

function externalToRecall(provider: string, item: Record<string, unknown>, index: number): MemoryProviderRecallItem {
  const title = firstString(item.title, item.name, item.summary, item.content, item.text) ?? `${provider} memory ${index + 1}`
  const summary = firstString(item.summary, item.content, item.text, item.body, item.markdown) ?? title
  const confidence = clampNumber(item.confidence ?? item.relevance ?? item.score, 0.5)
  const score = clampNumber(item.score ?? item.relevance ?? item.confidence, confidence)
  return {
    provider,
    id: firstString(item.id, item.key, item.memoryId) ?? `${provider}-${index + 1}`,
    title: truncate(title, 140),
    summary: truncate(summary, 500),
    confidence,
    score,
    evidencePaths: arrayOfStrings(item.evidencePaths ?? item.evidence_paths ?? item.sources),
    sourceUrl: firstString(item.url, item.sourceUrl, item.source_url),
    metadata: item,
  }
}

function nodeToRecall(provider: string, node: MemoryNode): MemoryProviderRecallItem {
  return {
    provider,
    id: node.id,
    title: node.title,
    summary: node.summary,
    confidence: node.confidence,
    score: node.confidence,
    evidencePaths: node.evidencePaths,
    metadata: {
      type: node.type,
      scope: node.scope,
      status: node.status,
      entities: node.entities,
    },
  }
}

function providerStatus(provider: MemoryProviderConfig, routing: MemoryProviderRoutingConfig): MemoryProviderStatus {
  if (!provider.enabled) {
    return {
      ...providerStatusBase(provider, routing),
      available: false,
      reason: 'disabled by memory provider policy',
    }
  }
  if (provider.kind === 'scale-local') {
    return {
      ...providerStatusBase(provider, routing),
      available: true,
      reason: 'local MemoryBrain fallback is available',
    }
  }
  if (!provider.endpoint) {
    return {
      ...providerStatusBase(provider, routing),
      available: false,
      reason: `${provider.id} requires endpoint configuration before autonomous use`,
    }
  }
  return {
    ...providerStatusBase(provider, routing),
    available: true,
    reason: `${provider.id} endpoint configured; recall is read-only unless policy enables writes`,
  }
}

function providerStatusBase(provider: MemoryProviderConfig, routing: MemoryProviderRoutingConfig): Omit<MemoryProviderStatus, 'available' | 'reason'> {
  return {
    id: provider.id,
    kind: provider.kind,
    enabled: provider.enabled,
    selectedByDefault: routing.defaultOrder.includes(provider.id),
    priority: provider.priority,
    capabilities: provider.capabilities,
    safetyLevel: provider.safetyLevel,
    writeMode: provider.writeMode,
  }
}

function providerWarnings(statuses: MemoryProviderStatus[], config: MemoryProvidersConfig): string[] {
  const warnings: string[] = []
  if (!config.routing.allowExternalWrite && statuses.some(status => status.writeMode === 'enabled' && status.kind !== 'scale-local')) {
    warnings.push('External memory write is configured on a provider while routing.allowExternalWrite is false.')
  }
  if (!statuses.some(status => status.kind === 'scale-local' && status.available)) {
    warnings.push('scale-local fallback is unavailable; autonomous recall may fail closed.')
  }
  for (const status of statuses) {
    if (status.kind !== 'scale-local' && status.enabled && status.safetyLevel !== 'review-required') {
      warnings.push(`${status.id} should remain review-required until privacy and retention boundaries are recorded.`)
    }
  }
  return warnings
}

function normalizeProviders(input: unknown, defaults: MemoryProviderConfig[]): MemoryProviderConfig[] {
  if (!Array.isArray(input)) return defaults
  const byId = new Map(defaults.map(provider => [provider.id, provider]))
  const providers = input.filter(isRecord).map(item => {
    const id = String(item.id ?? '')
    const base = byId.get(id)
    return {
      ...(base ?? {}),
      ...item,
      id,
      kind: normalizeKind(item.kind, base?.kind),
      enabled: item.enabled !== false && Boolean(item.enabled ?? base?.enabled ?? false),
      priority: positiveInt(item.priority, base?.priority ?? 0),
      capabilities: arrayOfStrings(item.capabilities) as MemoryProviderCapability[],
      safetyLevel: normalizeSafety(item.safetyLevel, base?.safetyLevel),
      writeMode: normalizeWriteMode(item.writeMode, base?.writeMode),
    } as MemoryProviderConfig
  }).filter(provider => provider.id)
  for (const defaultProvider of defaults) {
    if (!providers.some(provider => provider.id === defaultProvider.id)) providers.push(defaultProvider)
  }
  return providers
}

function normalizeKind(value: unknown, fallback: MemoryProviderKind = 'generic-http'): MemoryProviderKind {
  return ['scale-local', 'agentmemory', 'gbrain', 'generic-http'].includes(String(value))
    ? value as MemoryProviderKind
    : fallback
}

function normalizeSafety(value: unknown, fallback: MemoryProviderSafetyLevel = 'review-required'): MemoryProviderSafetyLevel {
  return ['trusted-local', 'review-required', 'blocked'].includes(String(value))
    ? value as MemoryProviderSafetyLevel
    : fallback
}

function normalizeWriteMode(value: unknown, fallback: MemoryProviderWriteMode = 'disabled'): MemoryProviderWriteMode {
  return ['disabled', 'candidate-only', 'enabled'].includes(String(value))
    ? value as MemoryProviderWriteMode
    : fallback
}

function positiveInt(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function resolveScaleRoot(projectDir: string, scaleDir?: string): string {
  return isAbsolute(scaleDir ?? '') ? scaleDir as string : join(projectDir, scaleDir ?? '.scale')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function firstString(...values: unknown[]): string | undefined {
  return values.map(value => typeof value === 'string' ? value.trim() : '').find(Boolean)
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : []
}

function clampNumber(value: unknown, fallback: number): number {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(0.01, Math.min(1, Math.round(number * 100) / 100))
}

function truncate(value: string, maxChars: number): string {
  return value.length > maxChars ? `${value.slice(0, maxChars - 3)}...` : value
}
