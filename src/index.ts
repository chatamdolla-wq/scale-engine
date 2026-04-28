// SCALE Engine v0.5.0 — Public API
// S · C · A · L · E: Scaffold · Control · Artifact · Learn · Evolve

// Core types
export * from './artifact/types.js'

// FSM
export { FSM, SpecFSM } from './artifact/fsm.js'

// Artifact Store
export { InMemoryArtifactStore } from './artifact/store.js'
export type { IArtifactStore } from './artifact/store.js'

// Core Infrastructure
export { EventBus } from './core/eventBus.js'
export type { IEventBus } from './core/eventBus.js'
export { Container, container, createToken } from './core/container.js'
export { logger } from './core/logger.js'

// Task Engine
export { TaskEngine } from './tasks/TaskEngine.js'

// Knowledge Base
export { KnowledgeBase } from './knowledge/KnowledgeBase.js'
export { SQLiteKnowledgeBase } from './knowledge/SQLiteKnowledgeBase.js'
export type { IKnowledgeBase } from './knowledge/KnowledgeBase.js'

// Evolution
export { BehaviorTracker } from './evolution/BehaviorTracker.js'
export { LessonExtractor, RuleProposer, HookGenerator, EvolutionEngine } from './evolution/EvolutionEngine.js'

// Guardrails
export { Gateway } from './guardrails/Gateway.js'
export { ROLES, getRole, listRoles } from './guardrails/roles.js'
export {
  BruteRetryDetector, IdleToolDetector, BusyLoopDetector,
  PrematureDoneDetector, BlameShiftDetector,
} from './guardrails/detectors.js'
export {
  DangerousCommandDetector, SecretLeakDetector, RoleGateDetector, ScopeCreepDetector,
  BUILT_IN_ROLES,
} from './guardrails/advancedDetectors.js'

// Context
export { ContextBuilder } from './context/ContextBuilder.js'

// Orchestration
export { wireEffects } from './orchestration/EffectsWiring.js'

// Routing
export { ModelRouter, DEFAULT_MODELS } from './routing/ModelRouter.js'

// Adapters (all 7 platforms)
export {
  ClaudeCodeAdapter,
  CodexAdapter,
  OpenCodeAdapter,
  CursorAdapter,
  GeminiAdapter,
  OpenClawAdapter,
  HermesAdapter,
  createAdapter,
  SUPPORTED_AGENTS,
} from './adapters/index.js'
export type { IAgentAdapter, AdapterConfig, InitResult, SettingsJson, HookEntry } from './adapters/ClaudeCodeAdapter.js'

// Skill Discovery
export { SkillDiscovery } from './skills/SkillDiscovery.js'

// Workflow Presets
export {
  WORKFLOW_PRESETS,
  getWorkflowPreset,
  listWorkflowPresets,
  getPresetsByScenario,
  BASIC_DEV,
  TDD_DEV,
  BUG_FIX,
  SDD,
  CODE_REVIEW,
  SECURITY_AUDIT,
  RALPH_LOOP,
  RAPID_PROTO,
  MASSIVE_REFACTOR,
  PARALLEL_EXEC,
} from './workflows/presets.js'

// API
export { Doctor } from './api/doctor.js'
export { ScaleMCPServer } from './api/mcp.js'
