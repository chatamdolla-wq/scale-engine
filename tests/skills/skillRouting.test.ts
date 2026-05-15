import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  createSkillPlan,
  evaluateSkillGate,
  resolveSkillRoutingPolicy,
  TaskIntentClassifier,
} from '../../src/skills/routing/index.js'

describe('skill routing', () => {
  it('classifies UI tasks from description and files', () => {
    const policy = resolveSkillRoutingPolicy(null)
    const intents = new TaskIntentClassifier(policy).classify({
      description: 'Improve responsive UI layout and visual review',
      files: ['src/components/FileGrid.tsx'],
      level: 'M',
    })

    expect(intents[0].domain).toBe('ui')
    expect(intents[0].reasons.join(',')).toContain('keyword:ui')
  })

  it('creates a domain-specific skill plan with artifacts and skills', () => {
    const policy = resolveSkillRoutingPolicy(null)
    const plan = createSkillPlan({
      taskId: 'TASK-1',
      taskName: 'Auth permission fix',
      description: 'Fix tenant permission and auth token handling',
      level: 'CRITICAL',
      files: ['src/auth/guard.ts'],
      policy,
    })

    expect(plan.intents.map(intent => intent.domain)).toContain('security')
    expect(plan.requiredSkills).toContain('security-review')
    expect(plan.requiredArtifacts).toEqual(expect.arrayContaining(['skill-plan.md', 'security-review.md']))
    expect(plan.mode).toBe('block')
  })

  it('requires Mini-PRD for user-facing UI and API work at M level', () => {
    const policy = resolveSkillRoutingPolicy(null)
    const uiPlan = createSkillPlan({
      taskId: 'TASK-UI',
      taskName: 'File grid polish',
      description: 'Improve responsive UI flow and visual states',
      level: 'M',
      files: ['src/components/FileGrid.tsx'],
      policy,
    })
    const apiPlan = createSkillPlan({
      taskId: 'TASK-API',
      taskName: 'Share endpoint',
      description: 'Add API endpoint for share links',
      level: 'M',
      files: ['src/api/share.ts'],
      policy,
    })

    expect(uiPlan.requiredArtifacts).toEqual(expect.arrayContaining(['mini-prd.md', 'ui-spec.md', 'visual-review.md']))
    expect(apiPlan.requiredArtifacts).toEqual(expect.arrayContaining(['mini-prd.md', 'api-contract.md']))
  })

  it('checks required skill artifacts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scale-skill-gate-'))
    try {
      const artifactsDir = join(dir, 'task')
      mkdirSync(artifactsDir)
      writeFileSync(join(artifactsDir, 'skill-plan.md'), '# Skill Plan\n\n## Detected Intents\n\n## Required Skills\n', 'utf-8')

      const result = evaluateSkillGate({
        projectDir: dir,
        artifactsDir,
        level: 'M',
        requiredArtifacts: ['skill-plan.md', 'ui-spec.md'],
        mode: 'block',
      })

      expect(result.complete).toBe(false)
      expect(result.blocked).toBe(true)
      expect(result.missing).toEqual(['ui-spec.md'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
