// SCALE Engine — Agent Manager
// Purpose: Central registry and dispatcher for subagents

import type {
  IAgentManager,
  IAgent,
  AgentDefinition,
  AgentTaskContext,
  AgentResult,
} from './IAgent'
import { AGENT_MANAGER_TOKEN } from './IAgent'
import { container, createToken } from '../core/container'
import { logger } from '../core/logger'

/**
 * Default agent implementation that delegates to Agent tool
 */
class DefaultAgent implements IAgent {
  constructor(readonly definition: AgentDefinition) {}

  canHandle(userInput: string): boolean {
    const lower = userInput.toLowerCase()
    return this.definition.triggers.some(t => lower.includes(t.toLowerCase()))
  }

  getConfidence(userInput: string): number {
    const lower = userInput.toLowerCase()
    let matches = 0
    for (const trigger of this.definition.triggers) {
      if (lower.includes(trigger.toLowerCase())) matches++
    }
    return Math.min(matches / this.definition.triggers.length, 1)
  }

  async execute(context: AgentTaskContext): Promise<AgentResult> {
    const start = Date.now()
    logger.info(`Agent ${this.definition.id} executing: ${context.userInput.slice(0, 50)}...`)

    // In real implementation, this would invoke the Agent tool
    // For now, return a placeholder result
    return {
      success: true,
      output: `Agent ${this.definition.name} processed task`,
      durationMs: Date.now() - start,
      modelUsed: this.definition.modelPreference,
    }
  }
}

/**
 * Agent Manager - Central registry and dispatcher
 */
export class AgentManager implements IAgentManager {
  private agents: Map<string, IAgent> = new Map()
  private definitions: Map<string, AgentDefinition> = new Map()

  register(definition: AgentDefinition, implementation?: IAgent): void {
    const agent = implementation ?? new DefaultAgent(definition)
    this.agents.set(definition.id, agent)
    this.definitions.set(definition.id, definition)
    logger.debug(`Registered agent: ${definition.id} (${definition.name})`)
  }

  findBestAgent(userInput: string): AgentDefinition | null {
    const candidates: Array<{ def: AgentDefinition; confidence: number }> = []

    for (const def of this.definitions.values()) {
      const agent = this.agents.get(def.id)
      if (!agent) continue

      if (agent.canHandle(userInput)) {
        candidates.push({
          def,
          confidence: agent.getConfidence(userInput),
        })
      }
    }

    if (candidates.length === 0) return null

    // Sort by priority (higher first) then confidence
    candidates.sort((a, b) => {
      if (a.def.priority !== b.def.priority) return b.def.priority - a.def.priority
      return b.confidence - a.confidence
    })

    return candidates[0].def
  }

  async dispatch(context: AgentTaskContext): Promise<AgentResult> {
    const best = this.findBestAgent(context.userInput)
    if (!best) {
      return {
        success: false,
        error: 'No agent available for this task',
        durationMs: 0,
        modelUsed: 'none',
      }
    }

    const agent = this.agents.get(best.id)
    if (!agent) {
      return {
        success: false,
        error: `Agent ${best.id} not registered`,
        durationMs: 0,
        modelUsed: 'none',
      }
    }

    return agent.execute(context)
  }

  listAll(): AgentDefinition[] {
    return Array.from(this.definitions.values())
  }

  getById(id: string): IAgent | undefined {
    return this.agents.get(id)
  }

  hasHandler(userInput: string): boolean {
    return this.findBestAgent(userInput) !== null
  }
}

/**
 * Register AgentManager in container
 */
export function initializeAgentManager(): AgentManager {
  const manager = new AgentManager()
  container.registerInstance(AGENT_MANAGER_TOKEN, manager)
  return manager
}

export { AGENT_MANAGER_TOKEN }
