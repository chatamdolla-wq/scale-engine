import { describe, expect, it, vi, beforeEach } from 'vitest'

const externalCommand = vi.hoisted(() => ({
  externalCommandExists: vi.fn(),
  resolveExternalCommandPath: vi.fn(),
  runExternalCommandSync: vi.fn(),
}))

vi.mock('../../src/core/ExternalCommand.js', () => externalCommand)

import { inspectGbrainCliHealth, inspectMemoryProviders } from '../../src/memory/MemoryProviders.js'

function commandError(stdout: string, stderr = ''): Error & { stdout: string; stderr: string } {
  const error = new Error(stderr || 'command failed') as Error & { stdout: string; stderr: string }
  error.stdout = stdout
  error.stderr = stderr
  return error
}

const degradedDoctor = JSON.stringify({
  schema_version: 2,
  status: 'unhealthy',
  health_score: 55,
  checks: [
    { name: 'resolver_health', status: 'fail', message: 'skill resolver warnings' },
    { name: 'connection', status: 'ok', message: 'Connected, 0 pages' },
    { name: 'schema_version', status: 'ok', message: 'Version 80' },
    { name: 'brain_score', status: 'ok', message: 'Brain score 100/100' },
  ],
})

describe('MemoryProviders gbrain health', () => {
  beforeEach(() => {
    externalCommand.externalCommandExists.mockReset()
    externalCommand.resolveExternalCommandPath.mockReset()
    externalCommand.runExternalCommandSync.mockReset()
    externalCommand.resolveExternalCommandPath.mockReturnValue(null)
  })

  it('treats configured gbrain as available when only non-recall doctor checks fail', () => {
    externalCommand.externalCommandExists.mockReturnValue(true)
    externalCommand.runExternalCommandSync.mockImplementation(() => {
      throw commandError(`${degradedDoctor}\n[doctor.db_checks] done`)
    })

    const health = inspectGbrainCliHealth()

    expect(health).toMatchObject({
      available: true,
      degraded: true,
      status: 'unhealthy',
      healthScore: 55,
    })
    expect(health.reason).toContain('resolver_health')
  })

  it('keeps gbrain unavailable when no brain is configured', () => {
    externalCommand.externalCommandExists.mockReturnValue(true)
    externalCommand.runExternalCommandSync.mockImplementation(() => {
      throw commandError('', 'No brain configured. Run: gbrain init')
    })

    const report = inspectMemoryProviders()
    const gbrain = report.providers.find(provider => provider.id === 'gbrain')

    expect(gbrain).toMatchObject({
      available: false,
      reason: 'gbrain CLI is installed but no brain is configured; run `gbrain init --pglite` before autonomous recall',
    })
  })

  it('marks gbrain provider available for degraded but recall-ready doctor output', () => {
    externalCommand.externalCommandExists.mockReturnValue(true)
    externalCommand.runExternalCommandSync.mockImplementation(() => {
      throw commandError(degradedDoctor)
    })

    const report = inspectMemoryProviders()
    const gbrain = report.providers.find(provider => provider.id === 'gbrain')

    expect(gbrain).toMatchObject({
      id: 'gbrain',
      available: true,
    })
    expect(gbrain?.reason).toContain('non-recall doctor issue')
  })

  it('recalls gbrain query output that times out after producing results', async () => {
    externalCommand.externalCommandExists.mockReturnValue(true)
    externalCommand.runExternalCommandSync.mockImplementation((command: string, args: string[]) => {
      if (command === 'gbrain' && args[0] === 'doctor') return JSON.stringify({
        status: 'healthy',
        health_score: 100,
        checks: [
          { name: 'connection', status: 'ok' },
          { name: 'schema_version', status: 'ok' },
        ],
      })
      if (command === 'gbrain' && args[0] === 'query') {
        throw commandError('[1.0000] scale-note -- Sentinel memory result', 'spawnSync bun.exe ETIMEDOUT')
      }
      return ''
    })

    const { recallMemoryProviders } = await import('../../src/memory/MemoryProviders.js')
    const report = await recallMemoryProviders({
      provider: 'gbrain',
      query: 'Sentinel',
      limit: 3,
    })

    expect(report.ok).toBe(true)
    expect(report.selectedProviders).toEqual(['gbrain'])
    expect(report.items[0]).toMatchObject({
      provider: 'gbrain',
      title: 'scale-note',
      summary: 'Sentinel memory result',
    })
  })
})
