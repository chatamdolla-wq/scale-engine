import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { EventBus } from '../../src/core/eventBus.js'
import { HookGeneratorEnhanced } from '../../src/hooks/HookGeneratorEnhanced.js'
import { WorkflowHooksManager } from '../../src/hooks/WorkflowHooksManager.js'

describe('workflow hooks', () => {
  let dir: string
  let bus: EventBus

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'scale-hooks-'))
    bus = new EventBus({ eventsDir: join(dir, 'events') })
  })

  afterEach(() => {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  })

  it('registers workflow hook templates', () => {
    const generator = new HookGeneratorEnhanced(bus)
    const templateIds = generator.getTemplates().map(template => template.id)

    expect(templateIds).toContain('tmpl-karpathy-k1-think')
    expect(templateIds).toContain('tmpl-karpathy-k2-simple')
    expect(templateIds).toContain('tmpl-hardcoded-secret-guard')
    expect(templateIds).toContain('tmpl-empty-catch-guard')
    expect(templateIds).toContain('tmpl-unverified-check')
    expect(templateIds).toContain('tmpl-mutation-guard')
    expect(templateIds).toContain('tmpl-ai-slop-detector')
  })

  it('generates executable workflow hook scripts', () => {
    const generator = new HookGeneratorEnhanced(bus)
    const template = generator.getTemplates().find(t => t.id === 'tmpl-hardcoded-secret-guard')

    expect(template).toBeDefined()
    const hook = generator.generateFromTemplate(template!, {}, join(dir, 'hooks'))

    const allowed = spawnSync(process.execPath, [
      hook.scriptPath,
      JSON.stringify({ tool_input: { content: 'const safeValue = "public"' } })
    ])
    expect(allowed.status).toBe(0)

    const blocked = spawnSync(process.execPath, [
      hook.scriptPath,
      JSON.stringify({ tool_input: { content: 'const apiKey = "123456789012345678901234567890"' } })
    ])
    expect(blocked.status).toBe(2)
  })

  it('deploys enabled workflow presets into settings', () => {
    const manager = new WorkflowHooksManager(bus)
    const settingsPath = join(dir, '.claude', 'settings.json')

    const result = manager.deployDefaultWorkflowHooks(join(dir, 'hooks'), settingsPath)

    expect(result.deployed).toBe(5)
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8')) as {
      hooks: Record<string, Array<{ command: string; description?: string }>>
    }
    expect(settings.hooks.PreToolUse).toHaveLength(3)
    expect(settings.hooks.PostToolUse).toHaveLength(1)
    expect(settings.hooks.Stop).toHaveLength(1)
    expect(settings.hooks.PreToolUse.some(h => h.description?.includes('tmpl-hardcoded-secret-guard'))).toBe(true)
  })
})
