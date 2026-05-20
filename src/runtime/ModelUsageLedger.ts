import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface ModelUsageInput {
  provider: string
  model?: string
  taskId?: string
  sessionId?: string
  inputTokens?: number
  outputTokens?: number
  cacheEligibleTokens?: number
  cacheCreationInputTokens?: number
  cacheReadInputTokens?: number
  cachedTokens?: number
  estimatedCostUsd?: number
  metadata?: Record<string, string | number | boolean>
  timestamp?: string
}

export interface ModelUsageRecord extends Required<Omit<ModelUsageInput, 'model' | 'taskId' | 'sessionId' | 'estimatedCostUsd' | 'metadata'>> {
  id: string
  model?: string
  taskId?: string
  sessionId?: string
  estimatedCostUsd?: number
  metadata?: Record<string, string | number | boolean>
  totalTokens: number
  cacheSavingsTokens: number
}

export interface ModelUsageSummary {
  totalRecords: number
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  cacheEligibleTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
  cachedTokens: number
  cacheSavingsTokens: number
  estimatedCostUsd?: number
  byProvider: Record<string, {
    records: number
    totalTokens: number
    cacheSavingsTokens: number
  }>
}

export class ModelUsageLedger {
  private usageDir: string
  private usagePath: string

  constructor(scaleDir = process.env.SCALE_DIR ?? '.scale') {
    this.usageDir = join(scaleDir, 'model-usage')
    this.usagePath = join(this.usageDir, 'usage.jsonl')
  }

  record(input: ModelUsageInput): ModelUsageRecord {
    if (!existsSync(this.usageDir)) mkdirSync(this.usageDir, { recursive: true })
    const record = normalizeRecord(input)
    appendFileSync(this.usagePath, JSON.stringify(record) + '\n', 'utf-8')
    return record
  }

  list(): ModelUsageRecord[] {
    if (!existsSync(this.usagePath)) return []
    return readFileSync(this.usagePath, 'utf-8')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => JSON.parse(line) as ModelUsageRecord)
  }

  summarize(): ModelUsageSummary {
    const records = this.list()
    const summary: ModelUsageSummary = {
      totalRecords: records.length,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      cacheEligibleTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      cachedTokens: 0,
      cacheSavingsTokens: 0,
      byProvider: {},
    }

    let cost: number | undefined
    for (const record of records) {
      summary.totalInputTokens += record.inputTokens
      summary.totalOutputTokens += record.outputTokens
      summary.totalTokens += record.totalTokens
      summary.cacheEligibleTokens += record.cacheEligibleTokens
      summary.cacheCreationInputTokens += record.cacheCreationInputTokens
      summary.cacheReadInputTokens += record.cacheReadInputTokens
      summary.cachedTokens += record.cachedTokens
      summary.cacheSavingsTokens += record.cacheSavingsTokens
      if (record.estimatedCostUsd !== undefined) cost = (cost ?? 0) + record.estimatedCostUsd
      const provider = summary.byProvider[record.provider] ?? { records: 0, totalTokens: 0, cacheSavingsTokens: 0 }
      provider.records += 1
      provider.totalTokens += record.totalTokens
      provider.cacheSavingsTokens += record.cacheSavingsTokens
      summary.byProvider[record.provider] = provider
    }
    if (cost !== undefined) summary.estimatedCostUsd = Math.round(cost * 1_000_000) / 1_000_000
    return summary
  }
}

function normalizeRecord(input: ModelUsageInput): ModelUsageRecord {
  const inputTokens = nonNegative(input.inputTokens)
  const outputTokens = nonNegative(input.outputTokens)
  const cacheCreationInputTokens = nonNegative(input.cacheCreationInputTokens)
  const cacheReadInputTokens = nonNegative(input.cacheReadInputTokens)
  const cachedTokens = nonNegative(input.cachedTokens)
  const cacheSavingsTokens = Math.max(cacheReadInputTokens, cachedTokens)
  return {
    id: `USAGE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: input.timestamp ?? new Date().toISOString(),
    provider: input.provider,
    model: input.model,
    taskId: input.taskId,
    sessionId: input.sessionId,
    inputTokens,
    outputTokens,
    cacheEligibleTokens: nonNegative(input.cacheEligibleTokens),
    cacheCreationInputTokens,
    cacheReadInputTokens,
    cachedTokens,
    estimatedCostUsd: input.estimatedCostUsd,
    metadata: input.metadata,
    totalTokens: inputTokens + outputTokens,
    cacheSavingsTokens,
  }
}

function nonNegative(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value) || value < 0) return 0
  return value
}

