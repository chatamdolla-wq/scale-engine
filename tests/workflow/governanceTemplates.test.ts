import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { governanceTemplateContent, writeGovernanceTemplates } from '../../src/workflow/GovernanceTemplates.js'
import { computeGovernanceDrift } from '../../src/workflow/GovernanceLock.js'

let dirs: string[] = []

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

function makeDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'scale-governance-'))
  dirs.push(dir)
  return dir
}

describe('writeGovernanceTemplates', () => {
  it('creates workflow templates, metrics, and verification matrix', () => {
    const dir = makeDir()

    const result = writeGovernanceTemplates(dir, { mode: 'critical', projectName: 'Demo' })

    expect(result.created).toEqual(expect.arrayContaining([
      join(dir, 'docs', 'workflow', 'README.md'),
      join(dir, 'docs', 'workflow', 'templates', 'mini-prd.md'),
      join(dir, 'docs', 'workflow', 'templates', 'skill-plan.md'),
      join(dir, 'docs', 'workflow', 'templates', 'skill-evidence.md'),
      join(dir, 'docs', 'workflow', 'templates', 'ui-spec.md'),
      join(dir, 'docs', 'workflow', 'templates', 'docs-impact.md'),
      join(dir, 'docs', 'workflow', 'templates', 'github-actions-scale-preflight.yml'),
      join(dir, 'docs', 'workflow', 'templates', 'pre-push-scale-preflight.sh'),
      join(dir, 'docs', 'worklog', 'metrics.md'),
      join(dir, '.scale', 'verification.json'),
      join(dir, '.scale', 'skills.json'),
      join(dir, '.scale', 'governance.lock.json'),
    ]))
    expect(readFileSync(join(dir, 'docs', 'workflow', 'README.md'), 'utf-8')).toContain('Governance mode: critical')
    expect(readFileSync(join(dir, 'docs', 'workflow', 'templates', 'github-actions-scale-preflight.yml'), 'utf-8')).toContain('scale-engine@latest preflight --service all')
    expect(JSON.parse(readFileSync(join(dir, '.scale', 'verification.json'), 'utf-8')).policy).toMatchObject({
      mode: 'critical',
      artifactGate: 'block',
    })
    expect(JSON.parse(readFileSync(join(dir, '.scale', 'skills.json'), 'utf-8')).policy).toMatchObject({
      mode: 'block',
      requireSkillPlan: true,
    })
    const skills = JSON.parse(readFileSync(join(dir, '.scale', 'skills.json'), 'utf-8'))
    expect(skills.domains.ui.requiredSkills).toContain('frontend-design')
    expect(skills.domains.ui.recommendedSkills).toContain('webapp-testing')
    expect(skills.domains.review.requiredSkills).toContain('code-reviewer')
    expect(skills.domains.docs.recommendedSkills).toContain('update-docs')
  })

  it('generates project-scaffold pack wrappers and governance lock', () => {
    const dir = makeDir()

    const result = writeGovernanceTemplates(dir, {
      mode: 'standard',
      projectName: 'Scaffold',
      pack: 'project-scaffold',
    })

    expect(result.created).toEqual(expect.arrayContaining([
      join(dir, 'scripts', 'workflow', 'new-task.sh'),
      join(dir, 'scripts', 'gates', 'all.sh'),
      join(dir, '.scale', 'governance.lock.json'),
    ]))
    expect(readFileSync(join(dir, 'scripts', 'workflow', 'new-task.sh'), 'utf-8')).toContain('@hongmaple0820/scale-engine@latest')
    expect(JSON.parse(readFileSync(join(dir, '.scale', 'governance.lock.json'), 'utf-8'))).toMatchObject({
      pack: 'project-scaffold',
      packVersion: 1,
    })
  })

  it('generates Go service-matrix verification config', () => {
    const dir = makeDir()

    writeGovernanceTemplates(dir, { mode: 'standard', pack: 'go-service-matrix' })

    const matrix = JSON.parse(readFileSync(join(dir, '.scale', 'verification.json'), 'utf-8'))
    expect(matrix.profiles.default.services).toEqual(['netdisk', 'auth', 'gateway'])
    expect(matrix.services.map((service: { name: string }) => service.name)).toEqual(['netdisk', 'auth', 'gateway'])
    expect(matrix.exclude).toEqual(expect.arrayContaining(['OpenList', 'gfast', 'mcp-zero']))
  })

  it('generates whitespace-clean markdown templates', () => {
    const names = [
      'explore.md',
      'mini-prd.md',
      'skill-plan.md',
      'skill-evidence.md',
      'ui-spec.md',
      'visual-review.md',
      'docs-impact.md',
      'api-contract.md',
      'security-review.md',
      'db-change-plan.md',
      'e2e-plan.md',
      'plan.md',
      'verification.md',
      'review.md',
      'summary.md',
    ] as const

    for (const name of names) {
      const content = governanceTemplateContent(name)
      expect(content).toMatch(/\n$/)
      expect(content).not.toMatch(/\n\n$/)
      expect(content.split('\n').some(line => /[ \t]$/.test(line))).toBe(false)
    }
  })

  it('does not overwrite existing templates', () => {
    const dir = makeDir()
    const readme = join(dir, 'docs', 'workflow', 'README.md')
    writeGovernanceTemplates(dir)
    writeFileSync(readme, 'custom\n', 'utf-8')

    const result = writeGovernanceTemplates(dir)

    expect(result.skipped).toContain(readme)
    expect(readFileSync(readme, 'utf-8')).toBe('custom\n')
    expect(existsSync(join(dir, 'docs', 'workflow', 'templates', 'summary.md'))).toBe(true)
  })

  it('does not erase existing governance drift when init is rerun', () => {
    const dir = makeDir()
    const readme = join(dir, 'docs', 'workflow', 'README.md')
    writeGovernanceTemplates(dir, { pack: 'project-scaffold' })
    writeFileSync(readme, '# Local change\n', 'utf-8')

    writeGovernanceTemplates(dir, { pack: 'project-scaffold' })

    expect(computeGovernanceDrift(dir).changed.map(item => item.path)).toContain('docs/workflow/README.md')
  })
})
