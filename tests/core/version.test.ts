import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getScaleEngineVersion, SCALE_ENGINE_VERSION } from '../../src/version.js'

describe('version', () => {
  it('uses package.json as the runtime version source', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf-8')) as { version: string }

    expect(getScaleEngineVersion()).toBe(packageJson.version)
    expect(SCALE_ENGINE_VERSION).toBe(packageJson.version)
  })
})
