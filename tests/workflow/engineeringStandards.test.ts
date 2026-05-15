import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  doctorEngineeringStandards,
  engineeringStandardsPolicyTemplate,
  scanEngineeringStandards,
  settleEngineeringStandards,
} from '../../src/workflow/EngineeringStandards.js'

let dirs: string[] = []

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

function makeProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'scale-standards-'))
  dirs.push(dir)
  return dir
}

function write(projectDir: string, relativePath: string, content: string): void {
  const target = join(projectDir, ...relativePath.split('/'))
  mkdirSync(target.split(/[\\/]/).slice(0, -1).join('/'), { recursive: true })
  writeFileSync(target, content, 'utf-8')
}

describe('EngineeringStandards', () => {
  it('flags sensitive logs, raw SQL construction, unsafe UI sinks, and empty catch blocks', () => {
    const projectDir = makeProject()
    write(projectDir, '.scale/engineering-standards.json', engineeringStandardsPolicyTemplate())
    write(projectDir, 'src/business/upload.ts', `
export async function upload(req: { body: { token: string; id: string } }, db: { query: (sql: string) => Promise<void> }) {
  console.log('upload token', req.body.token)
  await db.query('SELECT * FROM files WHERE id = ' + req.body.id)
  try {
    return document.body.innerHTML = req.body.token
  } catch (error) {
  }
}
`)
    write(projectDir, 'src/cli/report.ts', `
export function printReport(summary: string) {
  console.log(summary)
}
`)

    const report = scanEngineeringStandards({ projectDir })

    expect(report.summary.totalFindings).toBeGreaterThanOrEqual(4)
    expect(report.summary.blockingFindings).toBeGreaterThanOrEqual(3)
    expect(report.findings.map(finding => finding.ruleId)).toEqual(expect.arrayContaining([
      'sensitive-log',
      'raw-sql-construction',
      'unsafe-html-sink',
      'empty-catch',
    ]))
    expect(report.findings.some(finding => finding.path === 'src/cli/report.ts' && finding.ruleId === 'ad-hoc-console-log')).toBe(false)
  })

  it('keeps standards doctor non-ok when blocking findings exist', () => {
    const projectDir = makeProject()
    write(projectDir, '.scale/engineering-standards.json', engineeringStandardsPolicyTemplate())
    write(projectDir, 'src/service/auth.ts', `
export function login(password: string) {
  logger.info('password=' + password)
}
`)

    const report = doctorEngineeringStandards({ projectDir })

    expect(report.ok).toBe(false)
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: 'fail', ruleId: 'sensitive-log' }),
    ]))
  })

  it('flags ad-hoc output and sensitive output in non-TypeScript services', () => {
    const projectDir = makeProject()
    write(projectDir, '.scale/engineering-standards.json', engineeringStandardsPolicyTemplate())
    write(projectDir, 'internal/service/auth.go', `
package service

import "fmt"

func Login(token string) {
  fmt.Println("debug login")
  fmt.Println("token", token)
}
`)

    const report = doctorEngineeringStandards({ projectDir })

    expect(report.ok).toBe(false)
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'warn',
        ruleId: 'ad-hoc-console-log',
        path: 'internal/service/auth.go',
        line: 7,
      }),
      expect.objectContaining({
        severity: 'fail',
        ruleId: 'sensitive-log',
        path: 'internal/service/auth.go',
        line: 8,
      }),
    ]))
  })

  it('blocks hardcoded secret-like assignments', () => {
    const projectDir = makeProject()
    write(projectDir, '.scale/engineering-standards.json', engineeringStandardsPolicyTemplate())
    write(projectDir, 'src/service/payment.ts', `
export function getPaymentConfig() {
  const apiToken = "sk_live_1234567890abcdef"
  return { apiToken }
}
`)

    const report = doctorEngineeringStandards({ projectDir })

    expect(report.ok).toBe(false)
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'fail',
        category: 'security',
        ruleId: 'hardcoded-secret',
        path: 'src/service/payment.ts',
        line: 3,
      }),
    ]))
  })

  it('does not flag regex literals that describe output calls', () => {
    const projectDir = makeProject()
    write(projectDir, '.scale/engineering-standards.json', engineeringStandardsPolicyTemplate())
    write(projectDir, 'src/rules/outputMatcher.ts', String.raw`
export function matchesOutputCall(line: string): boolean {
  return /\bconsole\.(?:log|debug|info|warn|error)\s*\(|\bfmt\.Print(?:f|ln)?\s*\(|\bprint(?:ln)?\s*\(|\bSystem\.out\.print(?:ln)?\s*\(/.test(line)
}
`)

    const report = doctorEngineeringStandards({ projectDir })

    expect(report.findings.some(finding => finding.ruleId === 'ad-hoc-console-log')).toBe(false)
  })

  it('allows explicit baseline findings while keeping new violations visible', () => {
    const projectDir = makeProject()
    write(projectDir, '.scale/engineering-standards.json', JSON.stringify({
      version: 1,
      baselineFindings: [
        { ruleId: 'empty-catch', path: 'src/legacy/old.ts', reason: 'legacy debt tracked separately' },
      ],
    }, null, 2))
    write(projectDir, 'src/legacy/old.ts', 'try { work() } catch (error) {}\n')
    write(projectDir, 'src/legacy/new.ts', 'try { work() } catch (error) {}\n')

    const report = doctorEngineeringStandards({ projectDir })

    expect(report.ok).toBe(false)
    expect(report.findings.some(finding => finding.path === 'src/legacy/old.ts' && finding.ruleId === 'empty-catch')).toBe(false)
    expect(report.findings.some(finding => finding.path === 'src/legacy/new.ts' && finding.ruleId === 'empty-catch')).toBe(true)
  })

  it('supports line-specific baselines without hiding new violations in the same file', () => {
    const projectDir = makeProject()
    write(projectDir, '.scale/engineering-standards.json', JSON.stringify({
      version: 1,
      baselineFindings: [
        { ruleId: 'empty-catch', path: 'src/legacy/old.ts', line: 1, reason: 'legacy debt tracked separately' },
      ],
    }, null, 2))
    write(projectDir, 'src/legacy/old.ts', [
      'try { oldWork() } catch (error) {}',
      'try { newWork() } catch (error) {}',
      '',
    ].join('\n'))

    const report = doctorEngineeringStandards({ projectDir })

    expect(report.ok).toBe(false)
    expect(report.findings.some(finding => finding.path === 'src/legacy/old.ts' && finding.ruleId === 'empty-catch' && finding.line === 1)).toBe(false)
    expect(report.findings.some(finding => finding.path === 'src/legacy/old.ts' && finding.ruleId === 'empty-catch' && finding.line === 2)).toBe(true)
  })

  it('supports evidence-pattern exceptions without hiding other findings in the same file', () => {
    const projectDir = makeProject()
    write(projectDir, '.scale/engineering-standards.json', JSON.stringify({
      version: 1,
      allowedFindingPatterns: [
        {
          ruleId: 'ad-hoc-console-log',
          path: 'src/capabilities/InstalledSkillsIntegration.ts',
          evidencePattern: 'python3 -c .*print\\(',
          reason: 'The embedded command probes the local Python runtime.',
        },
      ],
    }, null, 2))
    write(projectDir, 'src/capabilities/InstalledSkillsIntegration.ts', `
export const probe = "python3 -c \\"print('ready')\\""
export function debug(value: string) {
  console.log('debug value', value)
}
`)

    const report = doctorEngineeringStandards({ projectDir })

    expect(report.ok).toBe(true)
    expect(report.findings.some(finding =>
      finding.ruleId === 'ad-hoc-console-log' &&
      finding.evidence?.includes('python3 -c'),
    )).toBe(false)
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'warn',
        ruleId: 'ad-hoc-console-log',
        path: 'src/capabilities/InstalledSkillsIntegration.ts',
        line: 4,
      }),
    ]))
  })

  it('can promote configured warning rules into blocking findings', () => {
    const projectDir = makeProject()
    write(projectDir, '.scale/engineering-standards.json', JSON.stringify({
      version: 1,
      blockingRules: ['ad-hoc-console-log'],
    }, null, 2))
    write(projectDir, 'src/business/debug.ts', `
export function debug(value: string) {
  console.log('debug value', value)
}
`)

    const report = doctorEngineeringStandards({ projectDir })

    expect(report.ok).toBe(false)
    expect(report.scan.summary.blockingFindings).toBe(1)
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'fail',
        ruleId: 'ad-hoc-console-log',
        path: 'src/business/debug.ts',
      }),
    ]))
  })

  it('flags framework catalog banned imports', () => {
    const projectDir = makeProject()
    write(projectDir, '.scale/frameworks.json', JSON.stringify({
      version: 1,
      bannedImports: [
        {
          source: '@legacy/orm',
          replacement: '@/infrastructure/db',
          reason: 'Use the project repository boundary instead of the legacy ORM client.',
        },
      ],
    }, null, 2))
    write(projectDir, 'src/service/user.ts', `
import { db } from '@legacy/orm'

export function loadUser(id: string) {
  return db.user.find(id)
}
`)

    const report = doctorEngineeringStandards({ projectDir })

    expect(report.ok).toBe(false)
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'fail',
        category: 'framework',
        ruleId: 'banned-import',
        path: 'src/service/user.ts',
        line: 2,
      }),
    ]))
  })

  it('reports malformed framework catalog against the framework source file', () => {
    const projectDir = makeProject()
    write(projectDir, '.scale/engineering-standards.json', engineeringStandardsPolicyTemplate())
    write(projectDir, '.scale/frameworks.json', '{ bad json')
    write(projectDir, 'src/domain/user.ts', 'export const user = true\n')

    const report = doctorEngineeringStandards({ projectDir })

    expect(report.ok).toBe(true)
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'warn',
        ruleId: 'frameworks-catalog-warning',
        path: join(projectDir, '.scale', 'frameworks.json'),
      }),
    ]))
  })

  it('warns when framework catalog review is stale', () => {
    const projectDir = makeProject()
    write(projectDir, '.scale/engineering-standards.json', engineeringStandardsPolicyTemplate())
    write(projectDir, '.scale/frameworks.json', JSON.stringify({
      version: 1,
      lastReviewedAt: '2026-01-01',
      reviewIntervalDays: 30,
      bannedImports: [],
    }, null, 2))
    write(projectDir, 'src/domain/user.ts', 'export const user = true\n')

    const report = doctorEngineeringStandards({
      projectDir,
      now: new Date('2026-05-15T00:00:00Z'),
    })

    expect(report.ok).toBe(true)
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'warn',
        ruleId: 'frameworks-catalog-stale',
        path: join(projectDir, '.scale', 'frameworks.json'),
      }),
    ]))
  })

  it('writes task standards settlement evidence', () => {
    const projectDir = makeProject()
    const artifactDir = 'docs/worklog/tasks/2026-05-15-standards'
    write(projectDir, '.scale/engineering-standards.json', engineeringStandardsPolicyTemplate())
    write(projectDir, 'src/domain/user.ts', 'export const user = true\n')

    const report = settleEngineeringStandards({
      projectDir,
      taskId: 'TASK-STANDARDS',
      artifactsDir: artifactDir,
    })

    expect(report.ok).toBe(true)
    expect(report.standardsImpactPath).toBe(join(projectDir, 'docs', 'worklog', 'tasks', '2026-05-15-standards', 'standards-impact.md'))
    expect(existsSync(report.standardsImpactPath!)).toBe(true)
    expect(readFileSync(report.standardsImpactPath!, 'utf-8')).toContain('SCALE Engineering Standards Settlement')
  })
})
