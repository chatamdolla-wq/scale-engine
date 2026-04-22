// W10 Tests: Doctor + Health Check
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Doctor } from '../../src/api/doctor.js'
import { ClaudeCodeAdapter } from '../../src/adapters/ClaudeCodeAdapter.js'
import { rmSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const TMP = './tmp/test-doctor'

describe('Doctor', () => {
  beforeEach(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
    mkdirSync(TMP, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
  })

  it('reports broken on empty project', async () => {
    const doc = new Doctor(TMP)
    const report = await doc.diagnose()
    expect(report.overall).toBe('broken')
    expect(report.checks.some((c) => c.status === 'fail')).toBe(true)
    expect(report.checks.find((c) => c.name === '.scale directory')?.status).toBe('fail')
  })

  it('reports healthy after scale init', async () => {
    const adapter = new ClaudeCodeAdapter()
    await adapter.init({ projectDir: TMP })
    const doc = new Doctor(TMP)
    const report = await doc.diagnose()
    expect(report.overall).toBe('healthy')
    expect(report.checks.every((c) => c.status === 'ok')).toBe(true)
  })

  it('warns on missing hooks in settings.json', async () => {
    mkdirSync(join(TMP, '.scale', 'events'), { recursive: true })
    mkdirSync(join(TMP, '.scale', 'artifacts'), { recursive: true })
    mkdirSync(join(TMP, '.claude'), { recursive: true })
    writeFileSync(join(TMP, '.claude', 'settings.json'), '{}', 'utf-8')
    writeFileSync(join(TMP, 'CLAUDE.md'), '# Test', 'utf-8')

    const doc = new Doctor(TMP)
    const report = await doc.diagnose()
    const settingsCheck = report.checks.find((c) => c.name === 'Agent settings')
    expect(settingsCheck?.status).toBe('warn')
    expect(settingsCheck?.message).toContain('no SCALE hooks')
  })

  it('warns on large knowledge doc', async () => {
    const adapter = new ClaudeCodeAdapter()
    await adapter.init({ projectDir: TMP })
    // Overwrite CLAUDE.md with 250 lines
    const bigContent = Array.from({ length: 250 }, (_, i) => `Line ${i + 1}`).join('\n')
    writeFileSync(join(TMP, 'CLAUDE.md'), bigContent, 'utf-8')

    const doc = new Doctor(TMP)
    const report = await doc.diagnose()
    const kdCheck = report.checks.find((c) => c.name === 'Knowledge doc')
    expect(kdCheck?.status).toBe('warn')
    expect(kdCheck?.message).toContain('>200')
  })

  it('checks Node.js version', async () => {
    const doc = new Doctor(TMP)
    const report = await doc.diagnose()
    const nodeCheck = report.checks.find((c) => c.name === 'Node.js version')
    expect(nodeCheck?.status).toBe('ok')
    expect(nodeCheck?.message).toMatch(/^v\d+/)
  })

  it('formatReport produces readable output', async () => {
    const doc = new Doctor(TMP)
    const report = await doc.diagnose()
    const formatted = doc.formatReport(report)
    expect(formatted).toContain('SCALE Engine Health')
    expect(formatted).toContain('passed')
  })

  it('detect .gitignore presence', async () => {
    const adapter = new ClaudeCodeAdapter()
    await adapter.init({ projectDir: TMP })
    const doc = new Doctor(TMP)
    const report = await doc.diagnose()
    const giCheck = report.checks.find((c) => c.name === '.scale/.gitignore')
    expect(giCheck?.status).toBe('ok')
  })

  it('rules and hooks check on fresh install', async () => {
    const adapter = new ClaudeCodeAdapter()
    await adapter.init({ projectDir: TMP })
    const doc = new Doctor(TMP)
    const report = await doc.diagnose()
    expect(report.checks.find((c) => c.name === 'Rules directory')?.status).toBe('ok')
    expect(report.checks.find((c) => c.name === 'Hooks directory')?.status).toBe('ok')
  })

  it('disk usage check works', async () => {
    const adapter = new ClaudeCodeAdapter()
    await adapter.init({ projectDir: TMP })
    const doc = new Doctor(TMP)
    const report = await doc.diagnose()
    const diskCheck = report.checks.find((c) => c.name === 'Disk usage')
    expect(diskCheck?.status).toBe('ok')
    expect(diskCheck?.message).toContain('MB')
  })

  it('invalid settings.json detected', async () => {
    mkdirSync(join(TMP, '.scale', 'events'), { recursive: true })
    mkdirSync(join(TMP, '.scale', 'artifacts'), { recursive: true })
    mkdirSync(join(TMP, '.claude'), { recursive: true })
    writeFileSync(join(TMP, '.claude', 'settings.json'), '{bad json', 'utf-8')

    const doc = new Doctor(TMP)
    const report = await doc.diagnose()
    const settingsCheck = report.checks.find((c) => c.name === 'Agent settings')
    expect(settingsCheck?.status).toBe('fail')
    expect(settingsCheck?.message).toContain('invalid JSON')
  })
})

