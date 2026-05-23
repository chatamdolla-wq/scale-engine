import { describe, expect, it } from 'vitest'
import {
  applyDependencyBootstrapPostActions,
  runDependencyBootstrapPostChecks,
  type DependencyBootstrapItemReport,
} from '../../src/bootstrap/DependencyBootstrap.js'

function installedItem(id: string): DependencyBootstrapItemReport {
  return {
    id,
    name: id,
    kind: id === 'awesome-design-md' ? 'skill' : 'cli',
    packs: id === 'gbrain' ? ['memory'] : ['knowledge'],
    source: `https://example.com/${id}`,
    installed: true,
    status: 'installed',
    installSupported: false,
    detectedBy: `PATH:${id}`,
    prerequisites: [],
  }
}

describe('dependency bootstrap post-checks', () => {
  it('summarizes tool, memory, and code-intelligence checks with warn/fail separation', () => {
    const results = runDependencyBootstrapPostChecks({
      projectDir: 'E:/project/demo',
      scaleDir: 'E:/project/demo/.scale',
      packIds: ['memory', 'knowledge'],
      items: [installedItem('gbrain'), installedItem('codegraph'), installedItem('graphify')],
      homeDir: 'C:/Users/tester',
    }, {
      inspectTools: () => ({
        ok: true,
        summary: { total: 3, installed: 3, missing: 0 },
        tools: [
          { id: 'gbrain', name: 'GBrain', category: 'cli', requiredFor: [], checkedPaths: ['PATH:gbrain'], installed: true, status: 'installed' },
          { id: 'codegraph', name: 'CodeGraph', category: 'cli', requiredFor: [], checkedPaths: ['PATH:codegraph'], installed: true, status: 'installed' },
          { id: 'graphify', name: 'Graphify', category: 'cli', requiredFor: [], checkedPaths: ['PATH:graphify'], installed: true, status: 'installed' },
        ],
      }),
      inspectMemory: () => ({
        projectDir: 'E:/project/demo',
        scaleDir: 'E:/project/demo/.scale',
        configPath: 'E:/project/demo/.scale/memory-providers.json',
        configExists: true,
        routing: {
          mode: 'external-first',
          defaultOrder: ['gbrain', 'agentmemory', 'scale-local'],
          allowExternalWrite: false,
          requireEvidence: true,
          maxResultsPerProvider: 5,
        },
        providers: [
          {
            id: 'gbrain',
            kind: 'gbrain',
            enabled: true,
            available: true,
            selectedByDefault: true,
            priority: 95,
            capabilities: ['graph-recall'],
            safetyLevel: 'review-required',
            writeMode: 'disabled',
            reason: 'gbrain CLI is available for default graph-backed recall',
          },
        ],
        availableProviderCount: 1,
        warnings: [],
      }),
      inspectCode: () => ({
        projectDir: 'E:/project/demo',
        scaleDir: 'E:/project/demo/.scale',
        configPath: 'E:/project/demo/.scale/code-intelligence.json',
        configExists: true,
        projectIndexPath: 'E:/project/demo/.codegraph',
        projectIndexExists: false,
        providers: [
          {
            id: 'codegraph',
            type: 'external-cli',
            enabled: true,
            available: true,
            capabilities: ['context'],
            reason: 'command available: codegraph; project index missing (.codegraph/)',
          },
          {
            id: 'graphify',
            type: 'artifact',
            enabled: true,
            available: false,
            capabilities: ['context'],
            reason: 'manifest not found: graphify-out/graph.json',
          },
        ],
        fallback: {
          enabled: true,
          tools: ['rg'],
          available: true,
          reason: 'internal source scan fallback is available',
        },
        availableProviderCount: 1,
        recommendations: [],
      }),
    })

    expect(results.map(result => result.id)).toEqual(['tool-capabilities', 'memory-provider', 'code-intelligence'])
    expect(results.find(result => result.id === 'tool-capabilities')).toMatchObject({
      status: 'passed',
      summary: '3/3 selected tools are available',
    })
    expect(results.find(result => result.id === 'memory-provider')).toMatchObject({
      status: 'passed',
    })
    expect(results.find(result => result.id === 'code-intelligence')).toMatchObject({
      status: 'warn',
      summary: 'codegraph=available; graphify-artifact=missing; projectIndex=missing',
    })
  })

  it('scopes post-actions to the selected packs and keeps provider-order messaging readable', () => {
    const memoryActions = applyDependencyBootstrapPostActions(
      'E:/project/demo',
      'E:/project/demo/.scale',
      [installedItem('gbrain')],
      {
        writeMemoryConfig: () => ({ path: 'E:/project/demo/.scale/memory-providers.json', written: true }),
        switchMemoryProvider: () => ({
          ok: true,
          provider: 'gbrain',
          mode: 'external-first',
          path: 'E:/project/demo/.scale/memory-providers.json',
          previousOrder: ['gbrain', 'agentmemory', 'scale-local'],
          nextOrder: ['gbrain', 'agentmemory', 'scale-local'],
          warnings: [],
        }),
        writeCodeConfig: () => ({ path: 'E:/project/demo/.scale/code-intelligence.json', written: true }),
      },
    )

    expect(memoryActions).toEqual([
      'Wrote E:/project/demo/.scale/memory-providers.json',
      'Memory provider order unchanged: gbrain -> agentmemory -> scale-local',
    ])

    const knowledgeActions = applyDependencyBootstrapPostActions(
      'E:/project/demo',
      'E:/project/demo/.scale',
      [installedItem('codegraph')],
      {
        writeMemoryConfig: () => ({ path: 'E:/project/demo/.scale/memory-providers.json', written: true }),
        switchMemoryProvider: () => ({
          ok: true,
          provider: 'gbrain',
          mode: 'external-first',
          path: 'E:/project/demo/.scale/memory-providers.json',
          previousOrder: ['gbrain', 'agentmemory', 'scale-local'],
          nextOrder: ['gbrain', 'agentmemory', 'scale-local'],
          warnings: [],
        }),
        writeCodeConfig: () => ({ path: 'E:/project/demo/.scale/code-intelligence.json', written: false }),
      },
    )

    expect(knowledgeActions).toEqual([
      'Reused E:/project/demo/.scale/code-intelligence.json',
    ])
  })
})
