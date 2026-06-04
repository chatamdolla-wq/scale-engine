import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { FALLBACK_SCALE_ENGINE_VERSION } from '../src/version.js'

describe('version', () => {
  it('FALLBACK_SCALE_ENGINE_VERSION matches package.json version', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf-8'),
    ) as { version: string }
    expect(FALLBACK_SCALE_ENGINE_VERSION).toBe(packageJson.version)
  })
})
