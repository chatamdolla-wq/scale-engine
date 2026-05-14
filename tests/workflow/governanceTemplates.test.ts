import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { writeGovernanceTemplates } from '../../src/workflow/GovernanceTemplates.js'

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
      join(dir, 'docs', 'workflow', 'templates', 'ui-spec.md'),
      join(dir, 'docs', 'workflow', 'templates', 'github-actions-scale-preflight.yml'),
      join(dir, 'docs', 'workflow', 'templates', 'pre-push-scale-preflight.sh'),
      join(dir, 'docs', 'worklog', 'metrics.md'),
      join(dir, '.scale', 'verification.json'),
      join(dir, '.scale', 'skills.json'),
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
})
