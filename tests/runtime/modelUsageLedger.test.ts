import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ModelUsageLedger } from '../../src/runtime/ModelUsageLedger.js'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs.length = 0
})

function makeScaleDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'scale-model-usage-'))
  dirs.push(dir)
  return dir
}

describe('ModelUsageLedger', () => {
  it('records model usage and summarizes cache savings', () => {
    const ledger = new ModelUsageLedger(makeScaleDir())

    const record = ledger.record({
      provider: 'anthropic',
      model: 'claude-sonnet',
      inputTokens: 1000,
      outputTokens: 200,
      cacheEligibleTokens: 800,
      cacheCreationInputTokens: 800,
      cacheReadInputTokens: 600,
      estimatedCostUsd: 0.0012,
      metadata: { command: 'context-budget' },
    })

    expect(record.totalTokens).toBe(1200)
    expect(record.cacheSavingsTokens).toBe(600)

    ledger.record({
      provider: 'openai',
      inputTokens: 500,
      outputTokens: 50,
      cachedTokens: 300,
    })

    const summary = ledger.summarize()
    expect(summary.totalRecords).toBe(2)
    expect(summary.totalTokens).toBe(1750)
    expect(summary.cacheEligibleTokens).toBe(800)
    expect(summary.cacheCreationInputTokens).toBe(800)
    expect(summary.cacheReadInputTokens).toBe(600)
    expect(summary.cachedTokens).toBe(300)
    expect(summary.cacheSavingsTokens).toBe(900)
    expect(summary.byProvider.anthropic.records).toBe(1)
    expect(summary.byProvider.openai.cacheSavingsTokens).toBe(300)
  })
})

