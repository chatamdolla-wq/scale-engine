import { Readable, Writable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { runSetupWizard } from '../../src/setup/SetupWizard.js'
import type { DependencyBootstrapReport } from '../../src/bootstrap/DependencyBootstrap.js'
import type { MemoryProviderUseReport } from '../../src/memory/MemoryProviders.js'

describe('setup wizard', () => {
  it('lets interactive users choose gbrain routing before install confirmation', async () => {
    const prompts: string[] = []
    const report = await runSetupWizard({
      projectDir: process.cwd(),
      scaleDir: '.scale-test',
      interactive: true,
      lang: 'en',
      input: Readable.from(['\n', '\n', 'n\n']),
      output: new Writable({
        write(chunk, _encoding, callback) {
          prompts.push(String(chunk))
          callback()
        },
      }),
      bootstrap: async options => makeBootstrapReport(Boolean(options.apply)),
      switchMemoryProvider: options => ({
        ok: true,
        provider: options.provider,
        mode: options.mode ?? 'auto',
        path: '.scale-test/memory-providers.json',
        previousOrder: ['gbrain', 'agentmemory', 'scale-local'],
        nextOrder: [options.provider, 'agentmemory', 'scale-local'],
        warnings: [],
      }) as MemoryProviderUseReport,
    })

    expect(report.interactiveChoices).toMatchObject({
      memoryProvider: 'gbrain',
      memoryMode: 'external-first',
    })
    expect(report.memoryProviderSwitch).toMatchObject({
      provider: 'gbrain',
      mode: 'external-first',
    })
    expect(report.applied).toBe(false)
    expect(report.prompts).toEqual(expect.arrayContaining([
      expect.stringContaining('memory provider'),
      expect.stringContaining('memory routing mode'),
      expect.stringContaining('Install all ready dependencies'),
    ]))
    expect(prompts.join('')).toContain('gbrain')
  })
})

function makeBootstrapReport(apply: boolean): DependencyBootstrapReport {
  return {
    ok: true,
    complete: false,
    projectDir: process.cwd(),
    scaleDir: '.scale-test',
    packIds: ['memory'],
    includeIds: [],
    apply,
    runtimeChecks: [],
    items: [
      {
        id: 'gbrain',
        name: 'gbrain',
        kind: 'cli',
        packs: ['memory'],
        source: 'https://github.com/louis030195/gbrain',
        installed: true,
        status: 'ready',
        installSupported: true,
        detectedBy: 'command:gbrain',
        prerequisites: [],
      },
    ],
    summary: {
      total: 1,
      installed: 0,
      ready: 1,
      manualReview: 0,
      needsInit: 0,
      versionDrift: 0,
      installedNow: 0,
      failed: 0,
    },
    postActions: [],
    postChecks: [],
    postCheckSummary: { total: 0, passed: 0, warned: 0, failed: 0 },
    postCheckCommands: [],
    rollbackHints: [],
    recommendations: [],
  }
}
