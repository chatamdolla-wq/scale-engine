import { describe, expect, it } from 'vitest'
import { listGovernanceTemplatePacks, resolveGovernanceTemplatePack } from '../../src/workflow/GovernanceTemplatePacks.js'

describe('governance template packs', () => {
  it('lists stable pack ids', () => {
    expect(listGovernanceTemplatePacks().map(pack => pack.id)).toEqual([
      'standard',
      'project-scaffold',
      'go-service-matrix',
      'node-library',
      'frontend-app',
    ])
  })

  it('resolves project-scaffold with wrapper generation enabled', () => {
    const pack = resolveGovernanceTemplatePack('project-scaffold')

    expect(pack.id).toBe('project-scaffold')
    expect(pack.generatedFiles.map(file => file.path)).toContain('scripts/workflow/new-task.sh')
    expect(pack.generatedFiles.map(file => file.path)).toContain('scripts/gates/all.sh')
  })

  it('resolves Go service matrix with language-aware required services and exclusions', () => {
    const pack = resolveGovernanceTemplatePack('go-service-matrix')

    expect(pack.defaultServices?.every(service => service.type === 'go')).toBe(true)
    expect(pack.defaultServices?.map(service => service.name)).toEqual(['netdisk', 'auth', 'gateway'])
    expect(pack.exclude).toEqual(expect.arrayContaining(['OpenList', 'gfast', 'mcp-zero']))
  })

  it('rejects unknown packs with supported ids', () => {
    expect(() => resolveGovernanceTemplatePack('missing')).toThrow('Supported packs')
  })
})
