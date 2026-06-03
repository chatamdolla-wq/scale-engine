// Tests: HookDeployer — 部署管理
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EventBus } from '../../src/core/eventBus.js'
import { HookDeployer } from '../../src/hooks/HookDeployer.js'
import type { EnhancedHook } from '../../src/hooks/HookGeneratorEnhanced.js'
import { rmSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const TMP = './tmp/test-hook-deployer'
const waitEvents = () => new Promise(r => setTimeout(r, 30))

function mkHook(overrides: Partial<EnhancedHook> = {}): EnhancedHook {
  return {
    id: 'hook-test-1',
    hookType: 'PreToolUse',
    matcher: 'Bash',
    scriptPath: join(TMP, 'hooks', 'test-hook.cjs'),
    timeout: 5000,
    templateId: 'tmpl-test',
    ...overrides,
  }
}

describe('HookDeployer', () => {
  let bus: EventBus
  let deployer: HookDeployer
  let settingsPath: string

  beforeEach(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
    mkdirSync(join(TMP, 'hooks'), { recursive: true })
    bus = new EventBus({ eventsDir: join(TMP, 'events') })
    deployer = new HookDeployer(bus)
    settingsPath = join(TMP, 'settings.json')
    writeFileSync(join(TMP, 'hooks', 'test-hook.cjs'), 'process.exit(0)')
  })

  afterEach(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
  })

  describe('validateForDeployment', () => {
    it('validates a correct hook', () => {
      const result = deployer.validateForDeployment(mkHook())
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('rejects hook with non-existent script', () => {
      const result = deployer.validateForDeployment(mkHook({ scriptPath: '/nonexistent/path.cjs' }))
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('does not exist'))).toBe(true)
    })

    it('rejects invalid hook type', () => {
      const result = deployer.validateForDeployment(mkHook({ hookType: 'InvalidType' as any }))
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Invalid hook type'))).toBe(true)
    })

    it('rejects PreToolUse hook without matcher', () => {
      const result = deployer.validateForDeployment(mkHook({ matcher: '' }))
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Matcher is required'))).toBe(true)
    })

    it('allows Stop hook without matcher', () => {
      const result = deployer.validateForDeployment(mkHook({ hookType: 'Stop', matcher: '' }))
      expect(result.valid).toBe(true)
    })

    it('allows SessionStart hook without matcher', () => {
      const result = deployer.validateForDeployment(mkHook({ hookType: 'SessionStart', matcher: '' }))
      expect(result.valid).toBe(true)
    })

    it('rejects timeout out of range', () => {
      const result = deployer.validateForDeployment(mkHook({ timeout: 500 }))
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Timeout'))).toBe(true)
    })

    it('rejects timeout too high', () => {
      const result = deployer.validateForDeployment(mkHook({ timeout: 120000 }))
      expect(result.valid).toBe(false)
    })
  })

  describe('deploy', () => {
    it('deploys hook to settings.json', () => {
      writeFileSync(settingsPath, JSON.stringify({ hooks: {} }))
      const result = deployer.deploy(mkHook(), settingsPath)

      expect(result.success).toBe(true)
      expect(result.hookId).toBe('hook-test-1')
      expect(result.errors).toHaveLength(0)

      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
      expect(settings.hooks.PreToolUse).toHaveLength(1)
      expect(settings.hooks.PreToolUse[0].matcher).toBe('Bash')
    })

    it('creates settings file if not exists', () => {
      const result = deployer.deploy(mkHook(), settingsPath)
      expect(result.success).toBe(true)
      expect(existsSync(settingsPath)).toBe(true)
    })

    it('fails validation for invalid hook', () => {
      const result = deployer.deploy(mkHook({ scriptPath: '/missing.cjs' }), settingsPath)
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('emits hook.deployed event', async () => {
      writeFileSync(settingsPath, JSON.stringify({ hooks: {} }))
      const events: any[] = []
      bus.on('hook.deployed', (e: any) => events.push(e.payload))

      deployer.deploy(mkHook(), settingsPath)
      await waitEvents()

      expect(events).toHaveLength(1)
      expect(events[0].hookId).toBe('hook-test-1')
    })

    it('tracks deployment status', () => {
      writeFileSync(settingsPath, JSON.stringify({ hooks: {} }))
      deployer.deploy(mkHook(), settingsPath)

      const status = deployer.getStatus('hook-test-1')
      expect(status).toBeDefined()
      expect(status!.active).toBe(true)
      expect(status!.rollbackAvailable).toBe(true)
    })
  })

  describe('deployMultiple', () => {
    it('deploys multiple hooks', () => {
      writeFileSync(settingsPath, JSON.stringify({ hooks: {} }))
      writeFileSync(join(TMP, 'hooks', 'hook2.cjs'), 'process.exit(0)')

      const hooks = [
        mkHook({ id: 'h1', matcher: 'Bash' }),
        mkHook({ id: 'h2', hookType: 'PostToolUse', matcher: 'Edit', scriptPath: join(TMP, 'hooks', 'hook2.cjs') }),
      ]
      const results = deployer.deployMultiple(hooks, settingsPath)

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(true)
    })
  })

  describe('rollback', () => {
    it('restores original settings on rollback', () => {
      const original = { hooks: { PreToolUse: [{ matcher: 'old' }] } }
      writeFileSync(settingsPath, JSON.stringify(original))

      deployer.deploy(mkHook(), settingsPath)

      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
      expect(settings.hooks.PreToolUse).toHaveLength(2)

      const rolled = deployer.rollback('hook-test-1', settingsPath)
      expect(rolled).toBe(true)

      const restored = JSON.parse(readFileSync(settingsPath, 'utf-8'))
      expect(restored.hooks.PreToolUse).toHaveLength(1)
      expect(restored.hooks.PreToolUse[0].matcher).toBe('old')
    })

    it('returns false for non-existent hook', () => {
      expect(deployer.rollback('missing', settingsPath)).toBe(false)
    })

    it('emits hook.rollback event', async () => {
      writeFileSync(settingsPath, JSON.stringify({ hooks: {} }))
      deployer.deploy(mkHook(), settingsPath)

      const events: any[] = []
      bus.on('hook.rollback', (e: any) => events.push(e.payload))

      deployer.rollback('hook-test-1', settingsPath)
      await waitEvents()

      expect(events).toHaveLength(1)
    })
  })

  describe('listDeployed', () => {
    it('lists all deployed hooks', () => {
      writeFileSync(settingsPath, JSON.stringify({ hooks: {} }))
      writeFileSync(join(TMP, 'hooks', 'hook2.cjs'), 'process.exit(0)')

      deployer.deploy(mkHook({ id: 'h1' }), settingsPath)
      deployer.deploy(mkHook({ id: 'h2', scriptPath: join(TMP, 'hooks', 'hook2.cjs') }), settingsPath)

      const list = deployer.listDeployed()
      expect(list).toHaveLength(2)
    })

    it('returns empty list when nothing deployed', () => {
      expect(deployer.listDeployed()).toHaveLength(0)
    })
  })
})
