/**
 * SCALE Engine — Core Types
 *
 * 这是整个系统的"灵魂"。
 * 所有 Artifact、Event、FSM 类型都在这里定义。
 * 修改这个文件需要 W4 末的"数据模型冻结评审"通过。
 *
 * 设计参考：docs/02-DATA-MODEL.md
 */

// ============================================================================
// 1. 通用类型
// ============================================================================

/** 行为者：可以是 AI、人类或系统 */
export type Actor =
  | { kind: 'ai'; role: string; model?: string }
  | { kind: 'human'; userId: string }
  | { kind: 'system'; component: string }

/** 时间戳（毫秒） */
export type Timestamp = number

/** 通用 ID 字符串。格式：{TYPE}-{YYYYMMDD}-{SEQ}，例如 SPEC-20260421-0007 */
export type ArtifactId = string
export type EventId = string
export type SessionId = string

// ============================================================================
// 2. Artifact 类型谱系
// ============================================================================

/** 11 种 Artifact 类型 */
export type ArtifactType =
  | 'Need'
  | 'Insight'
  | 'Spec'
  | 'Plan'
  | 'TestPlan'
  | 'Task'
  | 'Change'
  | 'Evidence'
  | 'Defect'
  | 'Lesson'
  | 'Release'

// ============================================================================
// 3. Artifact 通用结构
// ============================================================================

export interface Artifact<TPayload = unknown> {
  // 标识
  id: ArtifactId
  type: ArtifactType
  version: number

  // 状态
  status: string
  statusHistory: StatusChange[]

  // 关系
  parents: ArtifactId[]
  children: ArtifactId[]
  supersedes?: ArtifactId

  // 内容
  title: string
  contentRef: string                  // 内容文件路径
  payload: TPayload

  // 质量门
  gates: Gate[]

  // 元数据
  createdBy: Actor
  createdAt: Timestamp
  updatedAt: Timestamp
  closedAt?: Timestamp
  tags: string[]
  labels: Record<string, string>
}

export interface StatusChange {
  from: string
  to: string
  at: Timestamp
  by: Actor
  reason?: string
  eventId: EventId
}

export interface Gate {
  name: string
  required: boolean
  threshold?: string
  actual?: unknown
  passed: boolean
  checkedAt?: Timestamp
  checkedBy?: Actor
}

// ============================================================================
// 4. 各类型的 Payload
// ============================================================================

/** Need —— 用户原始诉求 */
export interface NeedPayload {
  rawText: string
  ambiguityScore?: number
  stakeholders: string[]
}

/** Insight —— 探索学习产出 */
export interface InsightPayload {
  category: 'fact' | 'constraint' | 'risk' | 'opportunity'
  evidence: Array<{ type: 'file' | 'doc' | 'test' | 'log'; ref: string }>
  confidence: number
  contradictsArtifact?: ArtifactId
}

/** Spec —— 需求契约 (WHAT) */
export interface SpecPayload {
  what: string
  successCriteria: string[]
  outOfScope: string[]
  edgeCases: string[]
  northStar: string
}

/** Plan —— 技术方案 (HOW) */
export interface PlanPayload {
  approach: string
  techChoices: Array<{
    decision: string
    rationale: string
    alternatives: string[]
  }>
  modules: Array<{
    path: string
    action: 'create' | 'modify' | 'delete'
    reason: string
  }>
  rollbackStrategy: string
  estimatedComplexity: number
}

/** TestPlan —— 验证方案 */
export interface TestPlanPayload {
  unitTests: TestSpec[]
  integrationTests: TestSpec[]
  manualChecks: string[]
  perfBudgets?: Array<{ metric: string; target: string }>
}

export interface TestSpec {
  name: string
  given: string
  when: string
  then: string
  command?: string
}

/** Task —— 原子可执行单元 */
export interface TaskPayload {
  description: string
  estimatedTokens?: number
  estimatedDurationMs?: number
  filesInvolved: string[]
  dependsOn: ArtifactId[]
  requiredRole: string
  requiredCapabilities: string[]

  // 代码质量验证字段（防止虚假完成）
  buildStatus?: 'pending' | 'success' | 'failed'
  buildExitCode?: number
  lintStatus?: 'pending' | 'success' | 'failed'
  testPassed?: boolean
  testCoverage?: number
}

/** Change —— 实际代码变更 */
export interface ChangePayload {
  commitSha?: string
  prUrl?: string
  filesChanged: Array<{ path: string; additions: number; deletions: number }>
  diffSummary: string
  reverted?: boolean
}

/** Evidence —— 验证证据 */
export interface EvidencePayload {
  testPlanId: ArtifactId
  toolUsed: string
  passed: boolean
  output: string
  duration: number
  artifacts: string[]
}

/** Defect —— 缺陷 */
export interface DefectPayload {
  symptom: string
  rootCauseCategory:
    | 'requirement_ambiguity'
    | 'design_flaw'
    | 'implementation_bug'
    | 'test_gap'
    | 'environment_issue'
    | 'unknown'
  rootCauseDetail: string
  fixChangeIds: ArtifactId[]
  similarTo: ArtifactId[]
  lesson?: ArtifactId
}

/** Lesson —— 沉淀经验 */
export interface LessonPayload {
  type:
    | 'lesson'
    | 'pattern'
    | 'best_practice'
    | 'anti_pattern'
    | 'decision'
    | 'troubleshooting'
    | 'workflow'
    | 'reference'
  problem: string
  solution: string
  prevention: string
  sourceDefects: ArtifactId[]
  applicableContexts: string[]
  verified: boolean
  promotedToRule?: string
}

/** Release —— 发布单 */
export interface ReleasePayload {
  version: string
  includesSpecs: ArtifactId[]
  includesChanges: ArtifactId[]
  rolloutStrategy: 'canary' | 'blue_green' | 'rolling' | 'all_at_once'
  rolledBack?: boolean
  rollbackReason?: string
}

/** 类型映射：根据 ArtifactType 推断 Payload 类型 */
export type PayloadOf<T extends ArtifactType> = T extends 'Need'
  ? NeedPayload
  : T extends 'Insight'
  ? InsightPayload
  : T extends 'Spec'
  ? SpecPayload
  : T extends 'Plan'
  ? PlanPayload
  : T extends 'TestPlan'
  ? TestPlanPayload
  : T extends 'Task'
  ? TaskPayload
  : T extends 'Change'
  ? ChangePayload
  : T extends 'Evidence'
  ? EvidencePayload
  : T extends 'Defect'
  ? DefectPayload
  : T extends 'Lesson'
  ? LessonPayload
  : T extends 'Release'
  ? ReleasePayload
  : never

// ============================================================================
// 5. Event 类型系统
// ============================================================================

export type EventType =
  // Artifact 生命周期
  | 'artifact.created'
  | 'artifact.updated'
  | 'artifact.transitioned'
  | 'artifact.gate_checked'
  | 'artifact.deleted'
  // 工具调用
  | 'tool.called'
  | 'tool.completed'
  | 'tool.failed'
  | 'tool.blocked'
  // 护栏
  | 'gate.checked'
  | 'gate.passed'
  | 'gate.failed'
  // 行为模式
  | 'behavior.brute_retry'
  | 'behavior.idle_tool'
  | 'behavior.busy_loop'
  | 'behavior.premature_done'
  | 'behavior.blame_shift'
  // Role
  | 'role.activated'
  | 'role.denied'
  // Session
  | 'session.started'
  | 'session.ended'
  | 'session.compacted'
  | 'session.cleared'
  // Knowledge
  | 'lesson.proposed'
  | 'lesson.approved'
  | 'lesson.rejected'
  | 'lesson.recalled'
  | 'lesson.helpful'
  | 'lesson.useless'
  // Task
  | 'task.scheduled'
  | 'task.started'
  | 'task.checkpointed'
  | 'task.paused'
  | 'task.resumed'
  | 'task.restored'
  | 'task.completed'
  | 'task.failed'
  | 'task.cancelled'
  | 'task.drift_detected'
  | 'task.step_started'
  | 'task.step_completed'
  | 'task.step_failed'
  | 'task.step_retrying'
  | 'task.decomposed'
  | `task.custom.${string}`
  // Evolution
  | 'rule.proposed'
  | 'rule.enforced'
  | 'hook.generated'
  | 'evolution.cycle_completed'
  | 'pattern.extracted'
  | 'pattern.verified'
  | 'skill.proposed'
  | 'skill.published'
  // Context
  | 'context.built'

export interface Event<TPayload = unknown> {
  id: EventId
  type: EventType
  timestamp: Timestamp
  sessionId: SessionId
  actor: Actor
  artifactId?: ArtifactId
  payload: TPayload
  causedBy?: EventId
  correlationId?: string
}

// ============================================================================
// 6. FSM 类型
// ============================================================================

export interface FSMDefinition<S extends string = string, A extends string = string> {
  type: ArtifactType
  states: readonly S[]
  initial: S
  terminal: readonly S[]
  transitions: ReadonlyArray<TransitionDef<S, A>>
}

export interface TransitionDef<S extends string, A extends string> {
  from: S
  action: A
  to: S
  guards?: Guard[]
  effects?: Effect[]
}

export interface Guard {
  name: string
  check: (artifact: Artifact, context: TransitionContext) => boolean | Promise<boolean>
  errorMessage: string
}

export interface Effect {
  name: string
  run: (artifact: Artifact, context: TransitionContext) => void | Promise<void>
}

export interface TransitionContext {
  actor: Actor
  reason?: string
  payload?: Record<string, unknown>
}

export interface TransitionResult {
  success: boolean
  artifact?: Artifact
  blockedBy?: GuardFailure[]
  effectsExecuted: string[]
}

export interface GuardFailure {
  guard: string
  message: string
}

// ============================================================================
// 7. Session 类型
// ============================================================================

export interface Session {
  id: SessionId
  agent: AgentPlatform | 'unknown'
  startedAt: Timestamp
  endedAt?: Timestamp
  activeRole?: string
  scenarioMode?: ScenarioMode
  metadata: Record<string, unknown>
}

// ============================================================================
// 8. Hook / Gate 类型
// ============================================================================

export interface ToolUseInput {
  sessionId: SessionId
  tool: string
  args: Record<string, unknown>
  timestamp?: Timestamp
}

export interface ToolResultInput {
  sessionId: SessionId
  tool: string
  args: Record<string, unknown>
  exitCode?: number
  output?: string
  duration?: number
  timestamp?: Timestamp
}

export interface StopInput {
  sessionId: SessionId
  aiOutput?: string
  projectType?: string
}

export interface GateDecision {
  allow: boolean
  reason?: string
  suggestion?: string
  injectContext?: string[]
}

export interface DetectorResult {
  triggered: boolean
  severity?: 'warn' | 'block' | 'deny'
  reason?: string
  suggestion?: string
}

// ============================================================================
// 9. KnowledgeBase 类型
// ============================================================================

export interface KnowledgeEntry {
  id: string
  type: LessonPayload['type']
  title: string
  tags: string[]
  contentRef: string                  // 内容文件路径
  embeddingId?: string                // Qdrant point id
  relevance: number                   // 0-1
  accessCount: number
  lastAccessed?: Timestamp
  verified: boolean
  verifiedBy?: string
  verifiedAt?: Timestamp
  createdAt: Timestamp
  sourceArtifact?: ArtifactId
}

export interface KnowledgeQuery {
  type?: LessonPayload['type'] | LessonPayload['type'][]
  tags?: string[]
  minRelevance?: number
  verifiedOnly?: boolean
  limit?: number
}

// ============================================================================
// 10. Role 类型
// ============================================================================

export interface RoleDefinition {
  name: string
  canCreateArtifacts: ArtifactType[]
  canModifyArtifacts?: Array<{ type: ArtifactType; statuses: string[] }>
  canReadArtifacts?: ArtifactType[]
  allowedTools: string[]
  deniedTools?: string[]
  requiresUpstream?: Array<{ type: ArtifactType; status?: string; allMatch?: string }>
  mustRunAfterEdit?: string[]
}

// ============================================================================
// 11. 错误类型
// ============================================================================

export class ScaleError extends Error {
  constructor(message: string, public code: string, public details?: unknown) {
    super(message)
    this.name = 'ScaleError'
  }
}

export class InvalidTransitionError extends ScaleError {
  constructor(from: string, action: string) {
    super(`State '${from}' does not support action '${action}'`, 'INVALID_TRANSITION', {
      from,
      action,
    })
  }
}

export class GuardFailedError extends ScaleError {
  constructor(public failures: GuardFailure[]) {
    super(`Transition blocked by guards: ${failures.map((f) => f.guard).join(', ')}`, 'GUARD_FAILED', {
      failures,
    })
  }
}

export class RoleDeniedError extends ScaleError {
  constructor(role: string, reason: string) {
    super(`Role '${role}' denied: ${reason}`, 'ROLE_DENIED', { role, reason })
  }
}

export class ArtifactNotFoundError extends ScaleError {
  constructor(id: string) {
    super(`Artifact '${id}' not found`, 'ARTIFACT_NOT_FOUND', { id })
  }
}

// ============================================================================
// 12. Scenario Mode 类型
// ============================================================================

/** 场景模式：控制检测器敏感度、上下文规则、权限级别 */
export type ScenarioMode = 'sandbox' | 'standard' | 'critical'

/** 场景模式配置 */
export interface ScenarioModeConfig {
  mode: ScenarioMode
  detectorSensitivity: 'low' | 'medium' | 'high'
  verificationRequired: boolean
  humanConfirmationRequired: boolean
  auditTrail: boolean
  maxRetries: number
}

/** 场景模式预设配置 */
export const SCENARIO_MODE_CONFIGS: Record<ScenarioMode, ScenarioModeConfig> = {
  sandbox: {
    mode: 'sandbox',
    detectorSensitivity: 'low',
    verificationRequired: false,
    humanConfirmationRequired: false,
    auditTrail: false,
    maxRetries: 10,
  },
  standard: {
    mode: 'standard',
    detectorSensitivity: 'medium',
    verificationRequired: true,
    humanConfirmationRequired: false,
    auditTrail: true,
    maxRetries: 5,
  },
  critical: {
    mode: 'critical',
    detectorSensitivity: 'high',
    verificationRequired: true,
    humanConfirmationRequired: true,
    auditTrail: true,
    maxRetries: 3,
  },
}

// ============================================================================
// 13. Skill Ecosystem 类型
// ============================================================================

/** Agent 平台类型 */
export type AgentPlatform =
  | 'claude-code'
  | 'codex'
  | 'opencode'
  | 'cursor'
  | 'gemini'
  | 'openclaw'
  | 'hermes'
  | 'trae'
  | 'workbuddy'
  | 'vsc'
  | 'qcoder'

/** Skill 引用 */
export interface SkillRef {
  id: string
  name: string
  description: string
  platform: AgentPlatform
  path: string
  enabled: boolean
}

/** Skill 目录扫描结果 */
export interface SkillScanResult {
  platform: AgentPlatform
  skillsDir: string
  skills: SkillRef[]
  exists: boolean
}

// ============================================================================
// 14. Workflow Preset 类型
// ============================================================================

/** 工作流步骤 */
export interface WorkflowStep {
  stepId: string
  skillId?: string
  action: string
  verificationGate?: string
  isMandatory: boolean
  description?: string
}

/** 工作流预设 */
export interface WorkflowPreset {
  id: string
  name: string
  nameZh: string
  description: string
  steps: WorkflowStep[]
  scenarioMode: ScenarioMode
  requiredArtifacts: Array<{ type: ArtifactType; status?: string }>
}

/** Agent 类型扩展（支持所有 11 种 Agent） */
export type AgentType = AgentPlatform

