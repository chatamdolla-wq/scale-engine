// Tests: Linear and Jira Tracker Adapters
import { describe, it, expect, beforeEach } from 'vitest'
import { LinearTrackerAdapter } from '../../src/orchestrator/LinearTrackerAdapter.js'
import { JiraTrackerAdapter } from '../../src/orchestrator/JiraTrackerAdapter.js'
import { MockTrackerAdapter } from '../../src/orchestrator/TrackerAdapter.js'
import type { TrackerIssue } from '../../src/orchestrator/TrackerAdapter.js'

describe('Tracker Adapters', () => {
  describe('MockTrackerAdapter', () => {
    it('returns empty candidates when no issues', async () => {
      const adapter = new MockTrackerAdapter()
      const candidates = await adapter.fetchCandidates()
      expect(candidates).toEqual([])
    })

    it('returns active issues as candidates', async () => {
      const issues: TrackerIssue[] = [
        { id: '1', title: 'Open', description: '', state: 'open', labels: [], priority: 1, createdAt: '', updatedAt: '', blockedBy: [] },
        { id: '2', title: 'Done', description: '', state: 'closed', labels: [], priority: 2, createdAt: '', updatedAt: '', blockedBy: [] },
        { id: '3', title: 'In Progress', description: '', state: 'in_progress', labels: [], priority: 0, createdAt: '', updatedAt: '', blockedBy: [] },
      ]
      const adapter = new MockTrackerAdapter(issues)
      const candidates = await adapter.fetchCandidates()
      expect(candidates).toHaveLength(2)
      expect(candidates.map(c => c.id)).toContain('1')
      expect(candidates.map(c => c.id)).toContain('3')
    })

    it('updates issue state', async () => {
      const issues: TrackerIssue[] = [
        { id: '1', title: 'Test', description: '', state: 'open', labels: [], priority: 1, createdAt: '', updatedAt: '', blockedBy: [] },
      ]
      const adapter = new MockTrackerAdapter(issues)
      await adapter.updateState('1', 'in_progress')
      const issue = await adapter.getIssue('1')
      expect(issue?.state).toBe('in_progress')
    })

    it('checks issue existence', async () => {
      const issues: TrackerIssue[] = [
        { id: '1', title: 'Test', description: '', state: 'open', labels: [], priority: 1, createdAt: '', updatedAt: '', blockedBy: [] },
      ]
      const adapter = new MockTrackerAdapter(issues)
      expect(await adapter.exists('1')).toBe(true)
      expect(await adapter.exists('999')).toBe(false)
    })

    it('gets issue by id', async () => {
      const issues: TrackerIssue[] = [
        { id: '1', title: 'Test Issue', description: 'Details', state: 'open', labels: ['bug'], priority: 0, createdAt: '2026-01-01', updatedAt: '2026-01-02', blockedBy: [] },
      ]
      const adapter = new MockTrackerAdapter(issues)
      const issue = await adapter.getIssue('1')
      expect(issue).toBeDefined()
      expect(issue!.title).toBe('Test Issue')
      expect(issue!.labels).toEqual(['bug'])
    })

    it('returns null for non-existent issue', async () => {
      const adapter = new MockTrackerAdapter()
      expect(await adapter.getIssue('999')).toBeNull()
    })
  })

  describe('LinearTrackerAdapter', () => {
    it('creates with default config', () => {
      const adapter = new LinearTrackerAdapter({ type: 'linear', activeStates: ['open'], terminalStates: ['closed'], priorityLabels: {} })
      expect(adapter.config.type).toBe('linear')
      expect(adapter.config.activeStates).toContain('open')
    })

    it('returns empty candidates without API key', async () => {
      const adapter = new LinearTrackerAdapter({ type: 'linear', activeStates: ['open'], terminalStates: ['closed'], priorityLabels: {} })
      const candidates = await adapter.fetchCandidates()
      expect(candidates).toEqual([])
    })

    it('returns null for getIssue without API key', async () => {
      const adapter = new LinearTrackerAdapter({ type: 'linear', activeStates: ['open'], terminalStates: ['closed'], priorityLabels: {} })
      expect(await adapter.getIssue('TEST-1')).toBeNull()
    })

    it('returns false for exists without API key', async () => {
      const adapter = new LinearTrackerAdapter({ type: 'linear', activeStates: ['open'], terminalStates: ['closed'], priorityLabels: {} })
      expect(await adapter.exists('TEST-1')).toBe(false)
    })

    it('does not throw on updateState without API key', async () => {
      const adapter = new LinearTrackerAdapter({ type: 'linear', activeStates: ['open'], terminalStates: ['closed'], priorityLabels: {} })
      await adapter.updateState('TEST-1', 'in_progress')
    })

    it('does not throw on addComment without API key', async () => {
      const adapter = new LinearTrackerAdapter({ type: 'linear', activeStates: ['open'], terminalStates: ['closed'], priorityLabels: {} })
      await adapter.addComment('TEST-1', 'test comment')
    })
  })

  describe('JiraTrackerAdapter', () => {
    it('creates with default config', () => {
      const adapter = new JiraTrackerAdapter({ type: 'jira', activeStates: ['open'], terminalStates: ['closed'], priorityLabels: {} })
      expect(adapter.config.type).toBe('jira')
    })

    it('returns empty candidates without config', async () => {
      const adapter = new JiraTrackerAdapter({ type: 'jira', activeStates: ['open'], terminalStates: ['closed'], priorityLabels: {} })
      const candidates = await adapter.fetchCandidates()
      expect(candidates).toEqual([])
    })

    it('returns null for getIssue without config', async () => {
      const adapter = new JiraTrackerAdapter({ type: 'jira', activeStates: ['open'], terminalStates: ['closed'], priorityLabels: {} })
      expect(await adapter.getIssue('TEST-1')).toBeNull()
    })

    it('returns false for exists without config', async () => {
      const adapter = new JiraTrackerAdapter({ type: 'jira', activeStates: ['open'], terminalStates: ['closed'], priorityLabels: {} })
      expect(await adapter.exists('TEST-1')).toBe(false)
    })

    it('does not throw on updateState without config', async () => {
      const adapter = new JiraTrackerAdapter({ type: 'jira', activeStates: ['open'], terminalStates: ['closed'], priorityLabels: {} })
      await adapter.updateState('TEST-1', 'in_progress')
    })

    it('does not throw on addComment without config', async () => {
      const adapter = new JiraTrackerAdapter({ type: 'jira', activeStates: ['open'], terminalStates: ['closed'], priorityLabels: {} })
      await adapter.addComment('TEST-1', 'test comment')
    })
  })
})
