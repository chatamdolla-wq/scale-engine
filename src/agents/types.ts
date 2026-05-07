// SCALE Engine — Agent System Types (v0.8.0)
// 多 Agent 协作系统核心类型定义

import type { ArtifactId, Timestamp, Actor, AgentPlatform } from '../artifact/types.js'

// ============================================================================
// 1. Agent Domain & Profile Types
// ============================================================================

/** Agent 专业领域 */
export type AgentDomain =
  | 'frontend'      // UI/UX, React/Vue, CSS, Animation
  | 'backend'       // API, Database, Auth, Performance
  | 'testing'       // TDD, E2E, Coverage, Mocking
  | 'ui-design'     // Visual Design, Accessibility, UX
  | 'operations'    // Deploy, CI/CD, Monitoring, Infra
  | 'product'       // Requirements, User Story, Analytics
  | 'code-review'   // Quality, Security, Patterns, Best Practices
  | 'security'      // OWASP, Auth, Crypto, Compliance
  | 'documentation' // Docs, API Reference, Tutorials
  | 'planning'      // Architecture, Design, Estimation
  | 'exploration'   // Codebase Search, Knowledge Graph
  | 'database'      // Migrations, Schema Design, Query Optimization
  | 'performance'   // Profiling, Benchmarking, Optimization
  | 'architecture'  // System Design, Scalability, Patterns

/** 模型层级偏好 */
export type ModelTier = 'fast' | 'balanced' | 'powerful'

/** 输出规范 */
export interface OutputSpec {
  fileTypes: string[]           // ['.tsx', '.css']
  style: string                 // 'component-based' | 'layered-architecture'
}

/** 协作偏好 */
export interface CollaborationSpec {
  reportsTo?: string            // 上游 Agent ID
  sharesWith: string[]          // 共享输出的 Agent IDs
}

/** Agent Profile：专业 Agent 定义 */
export interface AgentProfile {
  id: string                    // 'frontend-agent' | 'backend-agent'
  name: string                  // 'Frontend Developer'
  domain: AgentDomain           // 专业领域
  inheritsRole: string          // 继承的现有 Role（权限）
  capabilities: string[]        // 专业能力标签
  preferredModel: ModelTier     // 模型偏好
  outputFormat: OutputSpec      // 输出规范
  collaboration: CollaborationSpec // 协作偏好
  description: string           // 简短描述
}

// ============================================================================
// 2. Agent Runtime & Status Types
// ============================================================================

/** Agent 实例状态 */
export type AgentStatus =
  | 'idle'       // 空闲，可分配任务
  | 'running'    // 执行中
  | 'blocked'    // 等待依赖
  | 'completed'  // 已完成
  | 'failed'     // 失败
  | 'recycled'   // 已回收

/** 消息类型 */
export type MessageType =
  | 'task-request'      // 请求任务
  | 'task-complete'     // 任务完成
  | 'task-fail'         // 任务失败
  | 'dependency-block'  // 依赖阻塞
  | 'dependency-resolve'// 依赖解决
  | 'output-share'      // 输出共享
  | 'review-request'    // 审核请求
  | 'review-result'     // 审核结果
  | 'help-request'      // 求助
  | 'status-update'     // 状态更新

/** Agent 消息 */
export interface AgentMessage {
  id: string                    // 消息 ID
  from: string                  // 发送者 Agent ID
  to: string | 'broadcast'      // 接收者 Agent ID 或广播
  type: MessageType             // 消息类型
  payload: unknown              // 消息内容
  timestamp: Timestamp          // 发送时间
}

/** Agent 实例运行时 */
export interface AgentRuntime {
  id: string                    // 实例 ID: 'AGENT-{profile}-{seq}'
  profile: AgentProfile         // 关联的 Profile
  status: AgentStatus           // 运行状态
  assignedTask?: ArtifactId     // 当前任务
  model: ModelConfig            // 实际使用的模型
  startedAt: Timestamp          // 启动时间
  completedAt?: Timestamp       // 完成时间
  outputArtifacts: ArtifactId[] // 输出产物
  messages: AgentMessage[]      // 发送/接收的消息
  blockedBy?: string[]          // 阻塞依赖
  retryCount: number            // 重试次数
  error?: string                // 错误信息（失败时）
}

/** 模型配置 */
export interface ModelConfig {
  provider: AgentPlatform | 'anthropic' | 'openai' | 'google'
  modelId: string               // 'claude-sonnet-4' | 'gpt-4o'
  tier: ModelTier
}

// ============================================================================
// 3. Agent Team Types
// ============================================================================

/** Agent 团队 */
export interface AgentTeam {
  id: string                    // 'TEAM-{timestamp}'
  agents: AgentRuntime[]        // 团队成员
  leader: AgentRuntime          // 团队 Leader
  startedAt: Timestamp          // 创建时间
  completedAt?: Timestamp       // 完成时间
  dissolvedAt?: Timestamp       // 解散时间
  taskId?: ArtifactId           // 关联的任务 ID
  scenarioMode?: 'sandbox' | 'standard' | 'critical'
}

/** 团队执行结果 */
export interface TeamExecutionResult {
  teamId: string
  success: boolean
  outputArtifacts: ArtifactId[]
  duration: number              // 执行时长（ms）
  agentResults: Map<string, AgentResult>
}

/** 单个 Agent 执行结果 */
export interface AgentResult {
  agentId: string
  status: AgentStatus
  outputArtifacts: ArtifactId[]
  duration: number
  retryCount: number
}

/** Agent 执行结果（兼容旧版） */
export interface AgentExecutionResult {
  agentId: string
  success: boolean
  outputArtifacts: ArtifactId[]
  duration: number
  error?: string
}

/** 团队配置 */
export interface TeamConfig {
  profiles: string[]            // 需要的 Agent Profiles
  parallelism: number           // 并行度（最多同时运行的 Agent 数）
  timeout?: number              // 总超时（ms）
  onConflict: 'abort' | 'retry' | 'skip' // 冲突处理策略
  scenarioMode?: 'sandbox' | 'standard' | 'critical'
}

// ============================================================================
// 4. Agent Dispatcher Types
// ============================================================================

/** 任务依赖解析结果 */
export interface DependencyResolution {
  taskId: ArtifactId
  blockedBy: ArtifactId[]       // 阻塞的任务 IDs
  ready: boolean                // 是否可执行
}

/** 任务分组（按依赖关系） */
export interface TaskGroups {
  independent: ArtifactId[]     // 无依赖，可并行
  dependent: DependentTask[]    // 有依赖，需串行
}

/** 有依赖的任务 */
export interface DependentTask {
  taskId: ArtifactId
  dependencies: ArtifactId[]    // 依赖的任务 IDs
}

/** 任务 → Profile 映射 */
export type TaskProfileMap = Record<string, string[]>

// ============================================================================
// 5. Progress & Monitoring Types
// ============================================================================

/** 进度报告 */
export interface ProgressReport {
  teamId: string
  taskId?: ArtifactId           // 关联的任务 ID
  total: number                 // 总任务数
  completed: number             // 已完成
  running: number               // 运行中
  blocked: number               // 阻塞中
  failed: number                // 失败
  idle: number                  // 空闲
  agents: AgentStatusReport[]   // 各 Agent 状态
}

/** Agent 状态报告 */
export interface AgentStatusReport {
  agentId: string
  profileId: string
  status: AgentStatus
  task?: ArtifactId
  duration: number              // 已运行时长（ms）
}
