// Tests: ReviewEnforcer — 强制评审阶段
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EventBus } from '../../src/core/eventBus.js'
import { ReviewEnforcer } from '../../src/guardrails/ReviewEnforcer.js'
import type { IArtifactStore } from '../../src/artifact/store.js'
import type { IFSM } from '../../src/artifact/fsm.js'
import type { Artifact } from '../../src/artifact/types.js'
import { rmSync, existsSync, mkdirSync } from 'node:fs'

const TMP = './tmp/test-review-enforcer'
const waitEvents = () => new Promise(r => setTimeout(r, 30))

function mockStore(artifacts: Map<string, Artifact> = new Map()): IArtifactStore {
  return {
    get: async (id: string) => artifacts.get(id) ?? null,
    list: async () => Array.from(artifacts.values()),
    create: async (a: any) => a,
    update: async (id: string, patch: any) => {
      const existing = artifacts.get(id)
      if (existing) Object.assign(existing, patch)
      return existing!
    },
    delete: async (id: string) => { artifacts.delete(id) },
    query: async () => [],
  } as unknown as IArtifactStore
}

function mockFSM(): IFSM {
  return {
    canTransition: () => true,
    transition: async () => ({} as any),
    getDefinition: () => ({ initial: 'TODO', states: {} } as any),
  } as unknown as IFSM
}

describe('ReviewEnforcer', () => {
  let bus: EventBus
  let enforcer: ReviewEnforcer
  const artifacts = new Map<string, Artifact>()

  beforeEach(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
    mkdirSync(TMP, { recursive: true })
    bus = new EventBus({ eventsDir: `${TMP}/events` })
    artifacts.clear()
  })

  afterEach(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
  })

  describe('shouldEnforceReview', () => {
    it('returns false for non-existent task', async () => {
      enforcer = new ReviewEnforcer(mockStore(artifacts), bus, mockFSM())
      expect(await enforcer.shouldEnforceReview('missing')).toBe(false)
    })

    it('returns false for DONE task', async () => {
      artifacts.set('t1', {
        id: 't1', type: 'Task', status: 'DONE',
        payload: { filesInvolved: ['src/foo.ts'] },
      } as any)
      enforcer = new ReviewEnforcer(mockStore(artifacts), bus, mockFSM())
      expect(await enforcer.shouldEnforceReview('t1')).toBe(false)
    })

    it('returns false for CANCELLED task', async () => {
      artifacts.set('t1', {
        id: 't1', type: 'Task', status: 'CANCELLED',
        payload: { filesInvolved: ['src/foo.ts'] },
      } as any)
      enforcer = new ReviewEnforcer(mockStore(artifacts), bus, mockFSM())
      expect(await enforcer.shouldEnforceReview('t1')).toBe(false)
    })

    it('returns true for IN_PROGRESS task with files but no review', async () => {
      artifacts.set('t1', {
        id: 't1', type: 'Task', status: 'IN_PROGRESS',
        payload: { filesInvolved: ['src/foo.ts'], reviewPassed: false },
      } as any)
      enforcer = new ReviewEnforcer(mockStore(artifacts), bus, mockFSM())
      expect(await enforcer.shouldEnforceReview('t1')).toBe(true)
    })

    it('returns false for IN_PROGRESS task with review already passed', async () => {
      artifacts.set('t1', {
        id: 't1', type: 'Task', status: 'IN_PROGRESS',
        payload: { filesInvolved: ['src/foo.ts'], reviewPassed: true },
      } as any)
      enforcer = new ReviewEnforcer(mockStore(artifacts), bus, mockFSM())
      expect(await enforcer.shouldEnforceReview('t1')).toBe(false)
    })

    it('returns false for IN_PROGRESS task with no files involved', async () => {
      artifacts.set('t1', {
        id: 't1', type: 'Task', status: 'IN_PROGRESS',
        payload: { filesInvolved: [], reviewPassed: false },
      } as any)
      enforcer = new ReviewEnforcer(mockStore(artifacts), bus, mockFSM())
      expect(await enforcer.shouldEnforceReview('t1')).toBe(false)
    })
  })

  describe('enforceReview', () => {
    it('throws for non-existent task', async () => {
      enforcer = new ReviewEnforcer(mockStore(artifacts), bus, mockFSM())
      await expect(enforcer.enforceReview('missing')).rejects.toThrow('Task not found')
    })

    it('emits review.required event with correct payload', async () => {
      artifacts.set('t1', {
        id: 't1', type: 'Task', status: 'IN_PROGRESS',
        payload: { filesInvolved: ['src/a.ts', 'src/b.ts'], reviewPassed: false },
      } as any)
      enforcer = new ReviewEnforcer(mockStore(artifacts), bus, mockFSM())

      const events: any[] = []
      bus.on('review.required', (e: any) => events.push(e.payload))

      await enforcer.enforceReview('t1')
      await waitEvents()

      expect(events).toHaveLength(1)
      expect(events[0].taskId).toBe('t1')
      expect(events[0].filesInvolved).toEqual(['src/a.ts', 'src/b.ts'])
      expect(events[0].requiredChecks).toContain('代码质量检查')
    })

    it('returns passed=false when reviewPassed is false', async () => {
      artifacts.set('t1', {
        id: 't1', type: 'Task', status: 'IN_PROGRESS',
        payload: { filesInvolved: ['src/a.ts'], reviewPassed: false },
      } as any)
      enforcer = new ReviewEnforcer(mockStore(artifacts), bus, mockFSM())
      const result = await enforcer.enforceReview('t1')
      expect(result.passed).toBe(false)
      expect(result.taskId).toBe('t1')
    })

    it('emits review.passed when gates pass and reviewPassed is true', async () => {
      artifacts.set('t1', {
        id: 't1', type: 'Task', status: 'IN_PROGRESS',
        payload: {
          filesInvolved: ['src/a.ts'],
          reviewPassed: true,
          buildStatus: 'success',
          buildExitCode: 0,
          lintStatus: 'success',
          testCoverage: 85,
          testPassed: true,
          testTotal: 10,
          testFailed: 0,
        },
      } as any)
      enforcer = new ReviewEnforcer(mockStore(artifacts), bus, mockFSM())

      const events: any[] = []
      bus.on('review.passed', (e: any) => events.push(e.payload))

      const result = await enforcer.enforceReview('t1')
      await waitEvents()

      expect(result.passed).toBe(true)
      expect(events).toHaveLength(1)
    })
  })

  describe('rollbackOnReviewFailure', () => {
    it('emits task.review_failed event', async () => {
      artifacts.set('t1', {
        id: 't1', type: 'Task', status: 'IN_PROGRESS',
        payload: { filesInvolved: ['src/a.ts'], reviewPassed: false },
      } as any)
      enforcer = new ReviewEnforcer(mockStore(artifacts), bus, mockFSM())

      const events: any[] = []
      bus.on('task.review_failed', (e: any) => events.push(e.payload))

      await enforcer.rollbackOnReviewFailure('t1', ['缺少测试'])
      await waitEvents()

      expect(events).toHaveLength(1)
      expect(events[0].reasons).toEqual(['缺少测试'])
      expect(events[0].rollbackTo).toBe('IN_PROGRESS')
    })

    it('sets reviewPassed to false on rollback', async () => {
      const task: any = {
        id: 't1', type: 'Task', status: 'IN_PROGRESS',
        payload: { filesInvolved: ['src/a.ts'], reviewPassed: true },
      }
      artifacts.set('t1', task)
      enforcer = new ReviewEnforcer(mockStore(artifacts), bus, mockFSM())
      await enforcer.rollbackOnReviewFailure('t1', ['问题'])
      expect(task.payload.reviewPassed).toBe(false)
    })

    it('does nothing for non-existent task', async () => {
      enforcer = new ReviewEnforcer(mockStore(artifacts), bus, mockFSM())
      await enforcer.rollbackOnReviewFailure('missing', ['reason'])
    })
  })

  describe('checkReviewIteration', () => {
    it('returns exceeded=false for first review', async () => {
      enforcer = new ReviewEnforcer(mockStore(artifacts), bus, mockFSM())
      const result = await enforcer.checkReviewIteration('t1')
      expect(result.exceeded).toBe(false)
      expect(result.iteration).toBe(0)
    })

    it('returns exceeded=true after 2 review failures', async () => {
      enforcer = new ReviewEnforcer(mockStore(artifacts), bus, mockFSM())
      bus.emit('review.required', { taskId: 't1' })
      bus.emit('review.failed', { taskId: 't1' })
      bus.emit('review.required', { taskId: 't1' })
      bus.emit('review.failed', { taskId: 't1' })

      const result = await enforcer.checkReviewIteration('t1')
      expect(result.exceeded).toBe(true)
      expect(result.iteration).toBeGreaterThanOrEqual(2)
    })
  })
})
