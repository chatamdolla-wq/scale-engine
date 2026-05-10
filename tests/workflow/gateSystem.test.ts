import { describe, expect, it } from 'vitest'
import { BuildGate, CoverageGate, runShellCommand } from '../../src/workflow/gates/GateSystem.js'

function nodePrintCommand(text: string): string {
  const codes = Array.from(text).map(char => char.charCodeAt(0)).join(',')
  return `node -p String.fromCharCode(${codes})`
}

describe('runShellCommand', () => {
  it('runs a command through the platform shell', async () => {
    const result = await runShellCommand('node -e "process.stdout.write(String(40 + 2))"', 10_000)

    expect(result.code).toBe(0)
    expect(result.stdout).toBe('42')
    expect(result.stderr).toBe('')
  })

  it('captures non-zero exits without throwing', async () => {
    const result = await runShellCommand('node -e "process.stderr.write(\\"bad\\"); process.exit(7)"', 10_000)

    expect(result.code).toBe(7)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('bad')
  })
})

describe('BuildGate', () => {
  it('passes when the build command exits successfully', async () => {
    const gate = new BuildGate({
      command: 'node -v',
      source: 'override',
      reason: 'test build command',
    })

    const result = await gate.execute()

    expect(result.passed).toBe(true)
    expect(result.status).toBe('PASSED')
    expect(result.evidenceItems?.[0].command).toBe('node -v')
  })

  it('fails when the build command exits non-zero', async () => {
    const gate = new BuildGate({
      command: 'node -e "process.exit(2)"',
      source: 'override',
      reason: 'test failing build command',
    })

    const result = await gate.execute()

    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.blockers[0]).toContain('Build failed')
  })
})

describe('CoverageGate', () => {
  it('passes when parsed coverage is at least 80', async () => {
    const gate = new CoverageGate({
      command: nodePrintCommand('All files | 100.00 | 100.00 | 100.00 | 100.00 | 85.50'),
      source: 'override',
      reason: 'test coverage command',
    })

    const result = await gate.execute()

    expect(result.passed).toBe(true)
    expect(result.status).toBe('PASSED')
    expect(result.evidence).toContain('Coverage: 85.5%')
  })

  it('fails when parsed coverage is below 80', async () => {
    const gate = new CoverageGate({
      command: nodePrintCommand('All files | 100.00 | 100.00 | 100.00 | 100.00 | 79.99'),
      source: 'override',
      reason: 'test low coverage command',
    })

    const result = await gate.execute()

    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.blockers[0]).toContain('below 80% threshold')
  })

  it('fails when coverage output cannot be parsed', async () => {
    const gate = new CoverageGate({
      command: nodePrintCommand('tests passed without coverage table'),
      source: 'override',
      reason: 'test unparseable coverage command',
    })

    const result = await gate.execute()

    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAILED')
    expect(result.blockers).toContain('Coverage percentage could not be parsed')
  })
})
