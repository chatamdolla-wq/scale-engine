import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { writeGovernanceTemplates } from '../../src/workflow/GovernanceTemplates.js'
import { createUpgradeCheckReport, createUpgradePlanReport } from '../../src/workflow/UpgradeManager.js'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs.length = 0
})

function makeDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'scale-upgrade-'))
  dirs.push(dir)
  return dir
}

describe('UpgradeManager', () => {
  it('reports a clean project as safe and check-only for third-party capabilities', () => {
    const projectDir = makeDir()
    writeGovernanceTemplates(projectDir, { mode: 'standard', pack: 'project-scaffold' })

    const report = createUpgradeCheckReport({ projectDir })

    expect(report.status).toBe('clean')
    expect(report.governanceLock.exists).toBe(true)
    expect(report.governancePack).toMatchObject({
      id: 'project-scaffold',
      currentVersion: 2,
      latestVersion: 2,
      upToDate: true,
    })
    expect(report.generatedFiles.changed).toBe(0)
    expect(report.generatedFiles.missing).toBe(0)
    expect(report.thirdParty.policy).toBe('check-only')
    expect(report.thirdParty.reviewRequired).toBeGreaterThan(0)
    expect(report.recommendedCommands).toContain('scale upgrade plan --dir .')
  })

  it('blocks safe apply when generated files have local changes', () => {
    const projectDir = makeDir()
    writeGovernanceTemplates(projectDir, { mode: 'standard', pack: 'project-scaffold' })
    writeFileSync(join(projectDir, 'docs', 'workflow', 'README.md'), '# Local workflow rules\n', 'utf-8')

    const plan = createUpgradePlanReport({ projectDir })

    expect(plan.applyMode).toBe('manual-review')
    expect(plan.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'local-generated-file-changed',
        path: 'docs/workflow/README.md',
      }),
    ]))
    expect(plan.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: 'review-local-change',
        path: 'docs/workflow/README.md',
      }),
    ]))
  })

  it('plans to recreate missing generated files without overwriting local changes', () => {
    const projectDir = makeDir()
    writeGovernanceTemplates(projectDir, { mode: 'standard', pack: 'project-scaffold' })
    rmSync(join(projectDir, 'docs', 'workflow', 'templates', 'summary.md'))

    const plan = createUpgradePlanReport({ projectDir })

    expect(plan.applyMode).toBe('safe')
    expect(plan.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: 'restore-missing-generated-file',
        path: 'docs/workflow/templates/summary.md',
      }),
    ]))
    expect(readFileSync(join(projectDir, '.scale', 'governance.lock.json'), 'utf-8')).toContain('"project-scaffold"')
  })
})
