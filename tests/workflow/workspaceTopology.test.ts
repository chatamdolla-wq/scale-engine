import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadWorkspaceTopology, resolveWorkspaceTopology, workspaceTopologyTemplate } from '../../src/workflow/WorkspaceTopology.js'

let dirs: string[] = []

function makeProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'scale-moe-topology-'))
  dirs.push(dir)
  mkdirSync(join(dir, '.scale'), { recursive: true })
  return dir
}

afterEach(() => {
  for (const dir of dirs) {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  }
  dirs = []
})

describe('WorkspaceTopology', () => {
  it('falls back to a single-repository topology when no config exists', () => {
    const dir = makeProject()

    const topology = resolveWorkspaceTopology({ projectDir: dir })

    expect(topology.topology).toBe('single')
    expect(topology.configured).toBe(false)
    expect(topology.repositories).toEqual([
      expect.objectContaining({ name: 'root', path: '.', role: 'root', required: true }),
    ])
    expect(topology.finishPolicy.requireCleanRepositories).toBe(true)
  })

  it('loads MOE topology repositories, service bindings, and finish policy', () => {
    const dir = makeProject()
    writeFileSync(join(dir, '.scale', 'workspace.json'), JSON.stringify({
      version: 1,
      topology: 'moe',
      repositories: [
        { name: 'root', path: '.', role: 'root', required: true },
        { name: 'common', path: 'packages/common', role: 'submodule', required: true, services: ['common-api'] },
      ],
      finishPolicy: {
        requireCleanRepositories: true,
        requirePushedBranches: true,
        requireRootPointerUpdate: true,
      },
    }, null, 2), 'utf-8')

    const topology = loadWorkspaceTopology(dir)

    expect(topology?.topology).toBe('moe')
    expect(topology?.repositories[1]).toMatchObject({
      name: 'common',
      role: 'submodule',
      services: ['common-api'],
    })
    expect(topology?.finishPolicy.requireRootPointerUpdate).toBe(true)
  })

  it('generates a starter MOE topology template', () => {
    const template = JSON.parse(workspaceTopologyTemplate({ topology: 'moe' }))

    expect(template.topology).toBe('moe')
    expect(template.repositories).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'root', path: '.', role: 'root' }),
    ]))
    expect(template.finishPolicy).toMatchObject({
      requireCleanRepositories: true,
      requirePushedBranches: true,
      requireRootPointerUpdate: true,
    })
  })
})
