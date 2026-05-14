import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolveVerificationProfile, resolveVerificationTargets } from '../../src/workflow/VerificationProfile.js'

let dirs: string[] = []

function makeProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'scale-profile-'))
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

describe('resolveVerificationProfile', () => {
  it('falls back to root auto-detection when no matrix exists', () => {
    const dir = makeProject()

    const resolved = resolveVerificationProfile({ projectDir: dir })

    expect(resolved.config.cwd).toBe(dir)
    expect(resolved.profileName).toBe('auto')
    expect(resolved.warnings[0]).toContain('No verification matrix found')
  })

  it('resolves service commands and cwd from .scale/verification.json', () => {
    const dir = makeProject()
    mkdirSync(join(dir, 'services', 'api'), { recursive: true })
    writeFileSync(join(dir, '.scale', 'verification.json'), JSON.stringify({
      version: 1,
      defaultProfile: 'default',
      profiles: {
        default: {
          commands: {
            build: 'npm run build',
            lint: 'npm run lint',
          },
        },
      },
      services: [
        {
          name: 'api',
          path: 'services/api',
          type: 'node',
          commands: {
            test: 'npm test',
          },
        },
      ],
    }, null, 2), 'utf-8')

    const resolved = resolveVerificationProfile({ projectDir: dir, service: 'api' })

    expect(resolved.profileName).toBe('default')
    expect(resolved.service?.name).toBe('api')
    expect(resolved.config.cwd).toBe(join(dir, 'services', 'api'))
    expect(resolved.config.build).toBe('npm run build')
    expect(resolved.config.lint).toBe('npm run lint')
    expect(resolved.config.test).toBe('npm test')
  })

  it('resolves all required services for a service matrix run', () => {
    const dir = makeProject()
    mkdirSync(join(dir, 'services', 'api'), { recursive: true })
    mkdirSync(join(dir, 'services', 'worker'), { recursive: true })
    writeFileSync(join(dir, '.scale', 'verification.json'), JSON.stringify({
      version: 1,
      defaultProfile: 'default',
      profiles: {
        default: {
          commands: { test: 'npm test' },
        },
      },
      services: [
        { name: 'api', path: 'services/api', required: true },
        { name: 'worker', path: 'services/worker', required: true },
        { name: 'docs', path: 'docs', required: false },
      ],
      policy: {
        artifactGate: 'block',
        artifactGateLevels: ['L', 'CRITICAL'],
      },
    }, null, 2), 'utf-8')

    const resolved = resolveVerificationTargets({ projectDir: dir, service: 'all' })

    expect(resolved.profileName).toBe('default')
    expect(resolved.targets.map(target => target.service?.name)).toEqual(['api', 'worker'])
    expect(resolved.targets.map(target => target.config.cwd)).toEqual([
      join(dir, 'services', 'api'),
      join(dir, 'services', 'worker'),
    ])
    expect(resolved.targets.every(target => target.config.test === 'npm test')).toBe(true)
    expect(resolved.policy).toMatchObject({
      artifactGate: 'block',
      artifactGateLevels: ['L', 'CRITICAL'],
    })
  })

  it('uses profile service selection when no service is requested', () => {
    const dir = makeProject()
    mkdirSync(join(dir, 'services', 'api'), { recursive: true })
    mkdirSync(join(dir, 'services', 'gateway'), { recursive: true })
    writeFileSync(join(dir, '.scale', 'verification.json'), JSON.stringify({
      version: 1,
      defaultProfile: 'backend',
      profiles: {
        backend: {
          services: ['api', 'gateway'],
          commands: { build: 'npm run build' },
        },
      },
      services: [
        { name: 'api', path: 'services/api' },
        { name: 'gateway', path: 'services/gateway' },
      ],
    }, null, 2), 'utf-8')

    const resolved = resolveVerificationTargets({ projectDir: dir })

    expect(resolved.targets.map(target => target.service?.name)).toEqual(['api', 'gateway'])
    expect(resolved.targets.every(target => target.config.build === 'npm run build')).toBe(true)
  })
})
