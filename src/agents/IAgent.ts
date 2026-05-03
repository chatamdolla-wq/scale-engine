// SCALE Engine — Agent System Interface
// Purpose: Define contracts for subagent delegation

import type { ArtifactId } from '../artifact/types'
import type { Token } from '../core/container'

/**
 * Capability that an agent provides
 */
export interface AgentCapability {
  name: string
  description: string
  inputs: string[]
  outputs: string[]
}

/**
 * Task context for agent dispatch
 */
export interface AgentTaskContext {
  sessionId: string
  parentArtifactId?: ArtifactId
  userInput: string
  workingDirectory: string
  techStack?: string[]
  constraints?: Record<string, unknown>
}

/**
 * Result from agent execution
 */
export interface AgentResult {
  success: boolean
  output?: string
  artifactsCreated?: ArtifactId[]
  error?: string
  durationMs: number
  modelUsed: string
  tokensUsed?: number
}

/**
 * Agent definition for registration
 */
export interface AgentDefinition {
  id: string
  name: string
  description: string
  triggers: string[]
  capabilities: AgentCapability[]
  toolAllowlist: string[]
  toolDenylist?: string[]
  modelPreference: 'haiku' | 'sonnet' | 'opus'
  maxConcurrency: number
  timeoutMs?: number
  priority: number
}

/**
 * Agent interface for execution
 */
export interface IAgent {
  readonly definition: AgentDefinition
  execute(context: AgentTaskContext): Promise<AgentResult>
  canHandle(userInput: string): boolean
  getConfidence(userInput: string): number
}

/**
 * Agent manager interface
 */
export interface IAgentManager {
  register(definition: AgentDefinition, implementation?: IAgent): void
  dispatch(context: AgentTaskContext): Promise<AgentResult>
  findBestAgent(userInput: string): AgentDefinition | null
  listAll(): AgentDefinition[]
  getById(id: string): IAgent | undefined
  hasHandler(userInput: string): boolean
}

/**
 * Token for DI container
 */
export const AGENT_MANAGER_TOKEN = Symbol('AgentManager') as Token<IAgentManager>
