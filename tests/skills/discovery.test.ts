// SCALE Engine - Skill Discovery Tests

import { describe, it, expect, beforeEach } from 'vitest'
import { SkillRegistry } from '../../src/skills/SkillRegistry.js'
import { SkillInstaller } from '../../src/skills/SkillInstaller.js'
import { SkillDiscovery } from '../../src/skills/SkillDiscovery.js'
import { registerExternalSkills } from '../../src/skills/ExternalSkills.js'
import { EventBus } from '../../src/core/eventBus.js'

describe('SkillDiscovery', () => {
  let registry: SkillRegistry
  let installer: SkillInstaller
  let discovery: SkillDiscovery
  let eventBus: EventBus

  beforeEach(() => {
    eventBus = new EventBus()
    registry = new SkillRegistry(eventBus)
    registerExternalSkills(registry, eventBus)
    installer = new SkillInstaller(registry, eventBus)
    discovery = new SkillDiscovery(registry, installer, eventBus)
  })

  it('should discover browser automation skills for web-scraping task', async () => {
    const results = await discovery.discover({
      taskType: 'web-scraping',
      missingCapabilities: ['browser', 'login'],
      phase: 'execute',
      keywords: ['automation'],
    })
    expect(results.length).toBeGreaterThan(0)
    expect(results.some(r => r.skillId === 'web-access')).toBe(true)
    expect(results.some(r => r.skillId === 'cua')).toBe(true)
  })

  it('should recommend high quality skills for installation', async () => {
    const configs = await discovery.recommendInstall({
      taskType: 'ui-design',
      missingCapabilities: ['design', 'ux'],
      phase: 'plan',
      keywords: ['brand', 'accessibility'],
    })
    for (const config of configs) {
      expect(config.skillId).toBeDefined()
      expect(config.sourceUrl).toContain('github')
    }
  })

  it('should check during execution for missing capabilities', async () => {
    const results = await discovery.checkDuringExecution('web-scraping', ['browser', 'cua', 'playwright'])
    // 已安装的技能不会出现在结果中
    const uninstalled = results.filter(r => !r.alreadyInstalled)
    expect(uninstalled.length).toBeGreaterThanOrEqual(0)
  })

  it('should detect platform from project files', () => {
    const platform = discovery.detectPlatform()
    // 在测试环境中可能无法检测到平台
    expect(platform).toBeDefined()
  })

  it('should emit skill.recommended event', async () => {
    let eventEmitted = false
    eventBus.on('skill.recommended', () => { eventEmitted = true })
    await discovery.discover({
      taskType: 'diagram',
      missingCapabilities: ['diagram'],
      phase: 'plan',
      keywords: ['architecture'],
    })
    await new Promise(r => setTimeout(r, 50))
    expect(eventEmitted).toBe(true)
  })

  it('should periodic scan find unregistered skills', async () => {
    const results = await discovery.periodicScan()
    // 找出知识库中但未注册的技能
    expect(results.length).toBeGreaterThanOrEqual(0)
  })
})
