import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getScaleEngineVersion, SCALE_ENGINE_VERSION } from '../../src/version.js'

describe('version', () => {
  it('uses package.json as the runtime version source', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf-8')) as { version: string }

    expect(getScaleEngineVersion()).toBe(packageJson.version)
    expect(SCALE_ENGINE_VERSION).toBe(packageJson.version)
  })

  it('keeps a single release readiness script for publishing gates', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf-8')) as { scripts: Record<string, string> }
    const script = packageJson.scripts['release:check']

    expect(script).toContain('npm run typecheck')
    expect(script).toContain('npm run lint')
    expect(script).toContain('npm test')
    expect(script).toContain('npm run smoke:setup')
    expect(script).toContain('npm run build')
    expect(script).toContain('npm audit --omit=dev')
    expect(script).toContain('npm pack --dry-run')
  })
})
