// SCALE Engine — External Skills Integration Tests

import { describe, it, expect, beforeEach } from 'vitest'
import { SkillRegistry } from '../../src/skills/SkillRegistry.js'
import { registerExternalSkills } from '../../src/skills/ExternalSkills.js'
import { EventBus } from '../../src/core/eventBus.js'

describe('External Skills Integration', () => {
  let registry: SkillRegistry
  let eventBus: EventBus

  beforeEach(() => {
    eventBus = new EventBus()
    registry = new SkillRegistry(eventBus)
    registerExternalSkills(registry, eventBus)
  })

  it('should register 12 external skills', () => {
    const all = registry.listAll()
    expect(all.length).toBe(12)
  })

  it('should have graphify installed', () => {
    const skill = registry.get('graphify')
    expect(skill).toBeDefined()
    expect(skill?.installed).toBe(true)
    expect(skill?.domain).toBe('context')
  })

  it('should have awesome-design-md installed', () => {
    const skill = registry.get('awesome-design-md')
    expect(skill).toBeDefined()
    expect(skill?.installed).toBe(true)
  })

  it('should have ui-ux-pro-max installed', () => {
    const skill = registry.get('ui-ux-pro-max')
    expect(skill).toBeDefined()
    expect(skill?.installed).toBe(true)
  })

  it('should have web-access installed', () => {
    const skill = registry.get('web-access')
    expect(skill).toBeDefined()
    expect(skill?.installed).toBe(true)
    expect(skill?.priority).toBe(85)
  })

  it('should have playwright installed', () => {
    const skill = registry.get('playwright')
    expect(skill).toBeDefined()
    expect(skill?.installed).toBe(true)
  })

  it('should have playwright-interactive installed', () => {
    const skill = registry.get('playwright-interactive')
    expect(skill).toBeDefined()
    expect(skill?.domain).toBe('verification')
  })

  it('should have cua not installed by default', () => {
    const skill = registry.get('cua')
    expect(skill).toBeDefined()
    expect(skill?.installed).toBe(false)
    expect(skill?.priority).toBe(90)
  })

  it('should recommend web-access for web-scraping task', () => {
    const recommendations = registry.recommend({
      taskType: 'web-scraping',
      keywords: ['browser', 'login'],
    })
    expect(recommendations.length).toBeGreaterThan(0)
    expect(recommendations[0].skillId).toBe('web-access')
  })

  it('should recommend playwright for e2e-testing task', () => {
    const recommendations = registry.recommend({
      taskType: 'e2e-testing',
      phase: 'verify',
    })
    expect(recommendations.length).toBeGreaterThan(0)
    expect(recommendations.some(r => r.skillId === 'playwright')).toBe(true)
  })
})
