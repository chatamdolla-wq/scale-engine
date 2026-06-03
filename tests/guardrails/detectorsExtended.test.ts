// Tests: BlameShiftDetector + IdleToolDetector + PassiveWaitDetector + SameFileEditDetector
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EventBus } from '../../src/core/eventBus.js'
import {
  BlameShiftDetector,
  IdleToolDetector,
} from '../../src/guardrails/detectors.js'
import type { ToolUseInput, ToolResultInput, StopInput } from '../../src/artifact/types.js'
import { rmSync, existsSync, mkdirSync } from 'node:fs'

const TMP = './tmp/test-detectors-extended'

describe('Extended Detectors', () => {
  let bus: EventBus

  beforeEach(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
    mkdirSync(TMP, { recursive: true })
    bus = new EventBus({ eventsDir: `${TMP}/events` })
  })

  afterEach(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
  })

  // ===== BlameShiftDetector =====
  describe('BlameShiftDetector', () => {
    it('triggers on "可能是环境问题" without sufficient verification', async () => {
      const detector = new BlameShiftDetector()
      const ctx = { eventBus: bus, cache: new Map() }
      const input: ToolResultInput = {
        sessionId: 's1',
        tool: 'Bash',
        output: '可能是环境问题导致的',
      }
      const r = await detector.check(input, ctx)
      expect(r.triggered).toBe(true)
      expect(r.severity).toBe('warn')
    })

    it('does not trigger when sufficient bash evidence exists', async () => {
      bus.emit('tool.completed', { tool: 'Bash', args: { command: 'node -v' } }, { sessionId: 's1' })
      bus.emit('tool.completed', { tool: 'Bash', args: { command: 'npm ls' } }, { sessionId: 's1' })
      bus.emit('tool.completed', { tool: 'Bash', args: { command: 'cat package.json' } }, { sessionId: 's1' })

      const detector = new BlameShiftDetector()
      const ctx = { eventBus: bus, cache: new Map() }
      const input: ToolResultInput = {
        sessionId: 's1',
        tool: 'Bash',
        output: 'maybe the environment issue',
      }
      const r = await detector.check(input, ctx)
      expect(r.triggered).toBe(false)
    })

    it('triggers on English blame patterns', async () => {
      const detector = new BlameShiftDetector()
      const ctx = { eventBus: bus, cache: new Map() }
      const input: ToolResultInput = {
        sessionId: 's1',
        tool: 'Bash',
        output: 'not sure why this is happening',
      }
      const r = await detector.check(input, ctx)
      expect(r.triggered).toBe(true)
      expect(r.severity).toBe('warn')
    })

    it('does not trigger on normal output', async () => {
      const detector = new BlameShiftDetector()
      const ctx = { eventBus: bus, cache: new Map() }
      const input: ToolResultInput = {
        sessionId: 's1',
        tool: 'Bash',
        output: 'All tests passed successfully',
      }
      const r = await detector.check(input, ctx)
      expect(r.triggered).toBe(false)
    })
  })

  // ===== IdleToolDetector =====
  describe('IdleToolDetector', () => {
    it('does not trigger for non-edit tools', async () => {
      const detector = new IdleToolDetector()
      const ctx = { eventBus: bus, cache: new Map() }
      const input: ToolUseInput = {
        sessionId: 's1', tool: 'Bash', args: { command: 'ls' },
      }
      const r = await detector.check(input, ctx)
      expect(r.triggered).toBe(false)
    })

    it('triggers when editing after failure without investigation', async () => {
      bus.emit('tool.failed', { tool: 'Edit', args: { file_path: 'src/a.ts' } }, { sessionId: 's1' })

      const detector = new IdleToolDetector()
      const ctx = { eventBus: bus, cache: new Map() }
      const input: ToolUseInput = {
        sessionId: 's1', tool: 'Edit', args: { file_path: 'src/a.ts' },
      }
      const r = await detector.check(input, ctx)
      expect(r.triggered).toBe(true)
      expect(r.severity).toBe('warn')
    })

    it('does not trigger when investigation happened after failure', async () => {
      bus.emit('tool.failed', { tool: 'Edit', args: { file_path: 'src/a.ts' } }, { sessionId: 's1' })
      bus.emit('tool.completed', { tool: 'Read', args: { file_path: 'src/a.ts' } }, { sessionId: 's1' })

      const detector = new IdleToolDetector()
      const ctx = { eventBus: bus, cache: new Map() }
      const input: ToolUseInput = {
        sessionId: 's1', tool: 'Edit', args: { file_path: 'src/a.ts' },
      }
      const r = await detector.check(input, ctx)
      expect(r.triggered).toBe(false)
    })
  })
})
