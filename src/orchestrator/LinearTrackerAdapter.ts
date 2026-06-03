// SCALE Orchestrator — Linear Tracker Adapter
// Real implementation using Linear GraphQL API

import type { ITrackerAdapter, TrackerIssue, TrackerConfig, IssueState } from './TrackerAdapter.js'
import { logger } from '../core/logger.js'

export class LinearTrackerAdapter implements ITrackerAdapter {
  readonly config: TrackerConfig
  private apiKey: string
  private teamId: string
  private baseUrl = 'https://api.linear.app/graphql'

  constructor(config: TrackerConfig) {
    const defaults: Partial<TrackerConfig> = {
      activeStates: ['open', 'in_progress'],
      terminalStates: ['resolved', 'closed', 'cancelled'],
      priorityLabels: { 'Urgent': 0, 'High': 1, 'Medium': 2, 'Low': 3 },
    }
    this.config = { ...defaults, ...config } as TrackerConfig
    this.apiKey = config.token ?? process.env.LINEAR_API_KEY ?? ''
    this.teamId = (config as any).teamId ?? process.env.LINEAR_TEAM_ID ?? ''

    if (!this.apiKey) {
      logger.warn('Linear API key not configured — set LINEAR_API_KEY or pass token in config')
    }
  }

  private async graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey,
      },
      body: JSON.stringify({ query, variables }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Linear API error ${response.status}: ${text}`)
    }

    const data = await response.json() as { data?: T; errors?: Array<{ message: string }> }
    if (data.errors?.length) {
      throw new Error(`Linear GraphQL error: ${data.errors.map(e => e.message).join(', ')}`)
    }
    return data.data as T
  }

  async fetchCandidates(): Promise<TrackerIssue[]> {
    if (!this.apiKey) return []

    const stateFilter = this.config.activeStates.map(s => this.toLinearState(s))

    const query = `
      query($teamId: String!, $states: [String!]) {
        issues(filter: {
          team: { id: { eq: $teamId } }
          state: { name: { in: $states } }
        }, first: 50) {
          nodes {
            id identifier title description
            state { name }
            labels { nodes { name } }
            assignee { name email }
            priority
            createdAt updatedAt
            blockedBy { nodes { identifier } }
          }
        }
      }
    `

    try {
      const result = await this.graphql<{ issues: { nodes: Array<{
        id: string; identifier: string; title: string; description: string
        state: { name: string }; labels: { nodes: Array<{ name: string }> }
        assignee: { name: string; email: string } | null
        priority: number; createdAt: string; updatedAt: string
        blockedBy: { nodes: Array<{ identifier: string }> }
      }> } }>(query, { teamId: this.teamId, states: stateFilter })

      return result.issues.nodes.map(node => ({
        id: node.identifier,
        title: node.title,
        description: node.description ?? '',
        state: this.fromLinearState(node.state.name),
        labels: node.labels?.nodes?.map(l => l.name) ?? [],
        assignee: node.assignee?.name ?? node.assignee?.email,
        priority: this.mapLinearPriority(node.priority),
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        blockedBy: node.blockedBy?.nodes?.map(b => b.identifier) ?? [],
      }))
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'Linear fetchCandidates failed')
      return []
    }
  }

  async updateState(issueId: string, state: IssueState): Promise<void> {
    if (!this.apiKey) return

    const linearState = this.toLinearState(state)

    // First get the issue ID from identifier
    const issue = await this.getIssue(issueId)
    if (!issue) return

    const query = `
      mutation($id: String!, $state: String!) {
        issueUpdate(id: $id, input: { state: $state }) {
          success
        }
      }
    `

    try {
      await this.graphql(query, { id: issueId, state: linearState })
    } catch (err) {
      logger.error({ issueId, error: (err as Error).message }, 'Linear updateState failed')
    }
  }

  async addComment(issueId: string, body: string): Promise<void> {
    if (!this.apiKey) return

    const query = `
      mutation($issueId: String!, $body: String!) {
        commentCreate(input: { issueId: $issueId, body: $body }) {
          success
        }
      }
    `

    try {
      await this.graphql(query, { issueId, body })
    } catch (err) {
      logger.error({ issueId, error: (err as Error).message }, 'Linear addComment failed')
    }
  }

  async exists(issueId: string): Promise<boolean> {
    return (await this.getIssue(issueId)) !== null
  }

  async getIssue(issueId: string): Promise<TrackerIssue | null> {
    if (!this.apiKey) return null

    const query = `
      query($id: String!) {
        issue(id: $id) {
          id identifier title description
          state { name }
          labels { nodes { name } }
          assignee { name email }
          priority
          createdAt updatedAt
          blockedBy { nodes { identifier } }
        }
      }
    `

    try {
      const result = await this.graphql<{ issue: any }>(query, { id: issueId })
      if (!result.issue) return null

      const node = result.issue
      return {
        id: node.identifier,
        title: node.title,
        description: node.description ?? '',
        state: this.fromLinearState(node.state.name),
        labels: node.labels?.nodes?.map((l: { name: string }) => l.name) ?? [],
        assignee: node.assignee?.name ?? node.assignee?.email,
        priority: this.mapLinearPriority(node.priority),
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        blockedBy: node.blockedBy?.nodes?.map((b: { identifier: string }) => b.identifier) ?? [],
      }
    } catch {
      return null
    }
  }

  private toLinearState(state: IssueState): string {
    const map: Record<IssueState, string> = {
      open: 'Backlog',
      in_progress: 'In Progress',
      resolved: 'Done',
      closed: 'Canceled',
      cancelled: 'Canceled',
    }
    return map[state] ?? 'Backlog'
  }

  private fromLinearState(linearState: string): IssueState {
    const lower = linearState.toLowerCase()
    if (lower.includes('progress')) return 'in_progress'
    if (lower.includes('done') || lower.includes('complete')) return 'resolved'
    if (lower.includes('cancel')) return 'cancelled'
    return 'open'
  }

  private mapLinearPriority(linearPriority: number): number {
    // Linear: 0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low
    const map: Record<number, number> = { 0: 3, 1: 0, 2: 1, 3: 2, 4: 3 }
    return map[linearPriority] ?? 2
  }
}
