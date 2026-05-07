/**
 * SCALE Engine — Agent System Types
 */

import type { ArtifactId, Timestamp } from '../artifact/types.js'
import type { ModelTier } from '../routing/ModelRouter.js'

export type AgentDomain =
  | 'frontend' | 'backend' | 'testing' | 'ui-design'
  | 'operations' | 'product' | 'code-review' | 'security' | 'documentation'
  | 'database' | 'performance' | 'architecture'

export interface OutputSpec {
  fileTypes: string[]
  style: OutputStyle
}

export type OutputStyle =
  | 'component-based' | 'layered-architecture' | 'aaa-pattern'
  | 'design-spec' | 'automation' | 'user-centric' | 'review-report' | 'documentation'

export interface CollaborationSpec {
  reportsTo?: string
  sharesWith?: string[]
  reviewsFrom?: string[]
}

export interface AgentProfile {
  id: string
  name: string
  domain: AgentDomain
  inheritsRole: string
  capabilities: string[]
  preferredModel: ModelTier
  outputFormat: OutputSpec
  collaboration: CollaborationSpec
  description?: string
}

export type AgentStatus = 'idle' | 'running' | 'blocked' | 'completed' | 'failed'

export type MessageType =
  | 'task-request' | 'task-complete' | 'task-fail' | 'dependency-block'
  | 'dependency-resolve' | 'output-share' | 'review-request' | 'review-result'
  | 'help-request' | 'status-update'

export interface AgentMessage {
  id: string
  from: string
  to: string | 'broadcast'
  type: MessageType
  payload: unknown
  timestamp: Timestamp
  correlationId?: string
}

export interface AgentRuntime {
  id: string
  profile: AgentProfile
  status: AgentStatus
  assignedTask?: ArtifactId
  model: string
  startedAt: Timestamp
  completedAt?: Timestamp
  outputArtifacts: ArtifactId[]
  messages: AgentMessage[]
  error?: string
}

export interface AgentTeam {
  id: string
  agents: AgentRuntime[]
  leader: AgentRuntime
  startedAt: Timestamp
  dissolvedAt?: Timestamp
  taskId?: ArtifactId
}

export interface TeamConfig {
  profiles: string[]
  parallelism: number
  timeout?: number
  onConflict: ConflictStrategy
}

export type ConflictStrategy = 'abort' | 'retry' | 'skip'

export interface TeamExecutionResult {
  teamId: string
  success: boolean
  outputArtifacts: ArtifactId[]
  duration: number
  agentResults: Map<string, AgentExecutionResult>
  error?: string
}

export interface AgentExecutionResult {
  agentId: string
  success: boolean
  outputArtifacts: ArtifactId[]
  duration: number
  error?: string
}

export interface ProgressReport {
  teamId?: string
  taskId?: ArtifactId
  total: number
  completed: number
  running: number
  blocked: number
  failed: number
  idle: number
}

export interface TaskProfileMapping {
  taskType: string
  profiles: string[]
  priority?: number
  dependencies?: string[]
}

export const TASK_PROFILE_MAPPINGS: TaskProfileMapping[] = [
  { taskType: 'frontend', profiles: ['frontend-agent', 'ui-design-agent'], priority: 1 },
  { taskType: 'backend', profiles: ['backend-agent'], priority: 1 },
  { taskType: 'testing', profiles: ['test-agent'], priority: 2, dependencies: ['frontend', 'backend'] },
  { taskType: 'deployment', profiles: ['ops-agent'], priority: 3, dependencies: ['testing'] },
  { taskType: 'review', profiles: ['code-review-agent', 'security-agent'], priority: 2 },
  { taskType: 'spec', profiles: ['product-agent', 'ui-design-agent'], priority: 0 },
  // 新增任务类型映射
  { taskType: 'database', profiles: ['database-agent'], priority: 1 },
  { taskType: 'migration', profiles: ['database-agent'], priority: 1, dependencies: ['backend'] },
  { taskType: 'performance', profiles: ['performance-agent'], priority: 2, dependencies: ['frontend', 'backend'] },
  { taskType: 'docs', profiles: ['docs-agent'], priority: 3, dependencies: ['frontend', 'backend', 'testing'] },
  { taskType: 'architecture', profiles: ['architect-agent'], priority: 0 },
  { taskType: 'system-design', profiles: ['architect-agent', 'backend-agent'], priority: 0 },
]
