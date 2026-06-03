// SCALE Orchestrator — Jira Tracker Adapter
// Real implementation using Jira REST API v3

import type { ITrackerAdapter, TrackerIssue, TrackerConfig, IssueState } from './TrackerAdapter.js'
import { logger } from '../core/logger.js'

export class JiraTrackerAdapter implements ITrackerAdapter {
  readonly config: TrackerConfig
  private baseUrl: string
  private email: string
  private apiToken: string
  private projectKey: string

  constructor(config: TrackerConfig) {
    const defaults: Partial<TrackerConfig> = {
      activeStates: ['open', 'in_progress'],
      terminalStates: ['resolved', 'closed', 'cancelled'],
      priorityLabels: { 'Highest': 0, 'High': 1, 'Medium': 2, 'Low': 3, 'Lowest': 4 },
    }
    this.config = { ...defaults, ...config } as TrackerConfig
    this.baseUrl = config.baseUrl ?? process.env.JIRA_BASE_URL ?? ''
    this.email = (config as any).email ?? process.env.JIRA_EMAIL ?? ''
    this.apiToken = config.token ?? process.env.JIRA_API_TOKEN ?? ''
    this.projectKey = config.projectKey ?? process.env.JIRA_PROJECT_KEY ?? ''

    if (!this.baseUrl || !this.apiToken) {
      logger.warn('Jira not configured — set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN')
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}/rest/api/3${path}`
    const auth = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64')

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Jira API error ${response.status}: ${text}`)
    }

    return response.json() as Promise<T>
  }

  async fetchCandidates(): Promise<TrackerIssue[]> {
    if (!this.baseUrl || !this.apiToken) return []

    const stateFilter = this.config.activeStates
      .map(s => `"${this.toJiraStatus(s)}"`)
      .join(', ')

    const jql = `project = "${this.projectKey}" AND status in (${stateFilter}) ORDER BY priority ASC, updated DESC`

    try {
      const result = await this.request<JiraSearchResult>(
        'GET',
        `/search?jql=${encodeURIComponent(jql)}&maxResults=50&fields=summary,description,status,priority,assignee,labels,created,updated,issuelinks`
      )

      return result.issues.map(issue => this.mapIssue(issue))
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'Jira fetchCandidates failed')
      return []
    }
  }

  async updateState(issueId: string, state: IssueState): Promise<void> {
    if (!this.baseUrl || !this.apiToken) return

    const jiraStatus = this.toJiraStatus(state)

    try {
      // Jira requires transitions, not direct status updates
      const transitions = await this.request<{ transitions: Array<{ id: string; name: string }> }>(
        'GET',
        `/issue/${issueId}/transitions`
      )

      const targetTransition = transitions.transitions.find(
        t => t.name.toLowerCase() === jiraStatus.toLowerCase()
      )

      if (targetTransition) {
        await this.request('POST', `/issue/${issueId}/transitions`, {
          transition: { id: targetTransition.id },
        })
      } else {
        logger.warn({ issueId, jiraStatus }, 'No matching Jira transition found')
      }
    } catch (err) {
      logger.error({ issueId, error: (err as Error).message }, 'Jira updateState failed')
    }
  }

  async addComment(issueId: string, body: string): Promise<void> {
    if (!this.baseUrl || !this.apiToken) return

    try {
      await this.request('POST', `/issue/${issueId}/comment`, {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: body }],
            },
          ],
        },
      })
    } catch (err) {
      logger.error({ issueId, error: (err as Error).message }, 'Jira addComment failed')
    }
  }

  async exists(issueId: string): Promise<boolean> {
    try {
      await this.request('GET', `/issue/${issueId}?fields=summary`)
      return true
    } catch {
      return false
    }
  }

  async getIssue(issueId: string): Promise<TrackerIssue | null> {
    if (!this.baseUrl || !this.apiToken) return null

    try {
      const result = await this.request<JiraIssue>(
        'GET',
        `/issue/${issueId}?fields=summary,description,status,priority,assignee,labels,created,updated,issuelinks`
      )
      return this.mapIssue(result)
    } catch {
      return null
    }
  }

  private mapIssue(issue: JiraIssue): TrackerIssue {
    const fields = issue.fields
    return {
      id: issue.key,
      title: fields.summary,
      description: this.extractText(fields.description),
      state: this.fromJiraStatus(fields.status?.name ?? 'To Do'),
      labels: fields.labels ?? [],
      assignee: fields.assignee?.displayName,
      priority: this.mapJiraPriority(fields.priority?.name ?? 'Medium'),
      createdAt: fields.created,
      updatedAt: fields.updated,
      blockedBy: this.extractBlockedBy(fields.issuelinks),
    }
  }

  private extractText(doc: unknown): string {
    if (!doc) return ''
    if (typeof doc === 'string') return doc
    // Jira ADF format — extract text from content nodes
    try {
      const d = doc as { content?: Array<{ content?: Array<{ text?: string }> }> }
      return d.content?.flatMap(c => c.content?.map(t => t.text ?? '') ?? []).join('') ?? ''
    } catch {
      return ''
    }
  }

  private extractBlockedBy(links: JiraIssueLink[]): string[] {
    return links
      .filter(l => l.type?.name === 'Blocks' && l.inwardIssue)
      .map(l => l.inwardIssue!.key)
  }

  private toJiraStatus(state: IssueState): string {
    const map: Record<IssueState, string> = {
      open: 'To Do',
      in_progress: 'In Progress',
      resolved: 'Done',
      closed: 'Done',
      cancelled: 'Canceled',
    }
    return map[state] ?? 'To Do'
  }

  private fromJiraStatus(jiraStatus: string): IssueState {
    const lower = jiraStatus.toLowerCase()
    if (lower.includes('progress')) return 'in_progress'
    if (lower.includes('done') || lower.includes('complete')) return 'resolved'
    if (lower.includes('cancel')) return 'cancelled'
    return 'open'
  }

  private mapJiraPriority(jiraPriority: string): number {
    const map: Record<string, number> = {
      'highest': 0, 'critical': 0,
      'high': 1,
      'medium': 2,
      'low': 3,
      'lowest': 4,
    }
    return map[jiraPriority.toLowerCase()] ?? 2
  }
}

// Jira API types
interface JiraSearchResult {
  issues: JiraIssue[]
}

interface JiraIssue {
  key: string
  fields: {
    summary: string
    description: unknown
    status: { name: string }
    priority: { name: string }
    assignee: { displayName: string } | null
    labels: string[]
    created: string
    updated: string
    issuelinks: JiraIssueLink[]
  }
}

interface JiraIssueLink {
  type: { name: string; inward: string; outward: string }
  inwardIssue?: { key: string }
  outwardIssue?: { key: string }
}
