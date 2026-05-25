import { describe, expect, it, vi, beforeEach } from 'vitest'

const externalCommand = vi.hoisted(() => ({
  externalCommandExists: vi.fn(),
}))

const gbrainRuntime = vi.hoisted(() => ({
  runGbrainCommandSync: vi.fn(),
}))

vi.mock('../../src/core/ExternalCommand.js', () => externalCommand)
vi.mock('../../src/core/GbrainRuntime.js', () => gbrainRuntime)

import { inspectGbrainCliHealth, inspectMemoryProviders } from '../../src/memory/MemoryProviders.js'

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
    gbrainRuntime.runGbrainCommandSync.mockReset()
  })

  it('treats configured gbrain as available when only non-recall doctor checks fail', () => {
    externalCommand.externalCommandExists.mockReturnValue(true)
    gbrainRuntime.runGbrainCommandSync.mockImplementation(() => ({
      stdout: `${degradedDoctor}\n[doctor.db_checks] done`,
      stderr: '',
      exitCode: 1,
      timedOut: false,
      usedMirroredRuntime: false,
      recoveredTimeout: false,
    }))

    const health = inspectGbrainCliHealth()

    expect(health).toMatchObject({
      available: true,
      degraded: false,
      status: 'unhealthy',
      healthScore: 55,
    })
    expect(health.reason).toContain('optional doctor warnings: resolver_health')
  })

  it('keeps gbrain unavailable when no brain is configured', () => {
    externalCommand.externalCommandExists.mockReturnValue(true)
    gbrainRuntime.runGbrainCommandSync.mockImplementation(() => ({
      stdout: '',
      stderr: 'No brain configured. Run: gbrain init',
      exitCode: 1,
      timedOut: false,
      usedMirroredRuntime: false,
      recoveredTimeout: false,
    }))

    const report = inspectMemoryProviders()
    const gbrain = report.providers.find(provider => provider.id === 'gbrain')

    expect(gbrain).toMatchObject({
      available: false,
      reason: 'gbrain CLI is installed but no brain is configured; run `gbrain init --pglite` before autonomous recall',
    })
  })

  it('marks gbrain provider available for recall-ready doctor output with optional warnings', () => {
    externalCommand.externalCommandExists.mockReturnValue(true)
    gbrainRuntime.runGbrainCommandSync.mockImplementation(() => ({
      stdout: degradedDoctor,
      stderr: '',
      exitCode: 1,
      timedOut: false,
      usedMirroredRuntime: false,
      recoveredTimeout: false,
    }))

    const report = inspectMemoryProviders()
    const gbrain = report.providers.find(provider => provider.id === 'gbrain')

    expect(gbrain).toMatchObject({
      id: 'gbrain',
      available: true,
    })
    expect(gbrain?.reason).toContain('optional doctor warnings: resolver_health')
  })

  it('recalls gbrain query output that times out after producing results', async () => {
    externalCommand.externalCommandExists.mockReturnValue(true)
    gbrainRuntime.runGbrainCommandSync.mockImplementation((args: string[]) => {
      if (args[0] === 'doctor') return {
        stdout: JSON.stringify({
          status: 'healthy',
          health_score: 100,
          checks: [
            { name: 'connection', status: 'ok' },
            { name: 'schema_version', status: 'ok' },
          ],
        }),
        stderr: '',
        exitCode: 0,
        timedOut: false,
        usedMirroredRuntime: false,
        recoveredTimeout: false,
      }
      if (args[0] === 'query') {
        return {
          stdout: '[1.0000] scale-note -- Sentinel memory result',
          stderr: 'spawnSync bun.exe ETIMEDOUT',
          exitCode: 1,
          timedOut: true,
          usedMirroredRuntime: false,
          recoveredTimeout: false,
        }
      }
      return {
        stdout: '',
        stderr: '',
        exitCode: 0,
        timedOut: false,
        usedMirroredRuntime: false,
        recoveredTimeout: false,
      }
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
