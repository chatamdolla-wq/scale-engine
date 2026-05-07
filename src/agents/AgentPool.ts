// SCALE Engine — Agent Pool
// Agent 实例池管理

import type { AgentRuntime, AgentStatus } from './types.js'
import type { ArtifactId } from '../artifact/types.js'
import type { IEventBus } from '../core/eventBus.js'
import type { IAgentRegistry } from './AgentRegistry.js'
import type { IModelRouter } from '../routing/ModelRouter.js'
import { logger } from '../core/logger.js'

export interface IAgentPool {
  spawn(profileId: string): AgentRuntime
  get(agentId: string): AgentRuntime | undefined
  getIdleAgents(profileId?: string): AgentRuntime[]
  getRunningAgents(): AgentRuntime[]
  assignTask(agentId: string, taskId: ArtifactId): void
  updateStatus(agentId: string, status: AgentStatus): void
  complete(agentId: string, outputArtifacts: ArtifactId[]): void
  fail(agentId: string, error: string): void
  recycle(agentId: string): void
  getAll(): AgentRuntime[]
  size(): number
}

export class AgentPool implements IAgentPool {
  private agents = new Map<string, AgentRuntime>()
  private seq = 0

  constructor(
    private registry: IAgentRegistry,
    private modelRouter: IModelRouter,
    private eventBus: IEventBus,
  ) {}

  spawn(profileId: string): AgentRuntime {
    const profile = this.registry.get(profileId)
    if (!profile) {
      throw new Error(`Agent profile not found: ${profileId}`)
    }

    const id = `AGENT-${profileId}-${++this.seq}`
    const modelConfig = this.modelRouter.route({
      taskComplexity: 0.5,
      artifactType: 'Task',
    })

    const runtime: AgentRuntime = {
      id,
      profile,
      status: 'idle',
      model: modelConfig.name,
      startedAt: Date.now(),
      outputArtifacts: [],
      messages: [],
    }

    this.agents.set(id, runtime)
    this.eventBus.emit('agent.spawned', { agentId: id, profileId }, { sessionId: 'system' })
    logger.info({ agentId: id, profileId, model: runtime.model }, 'Agent spawned')
    
    return runtime
  }

  get(agentId: string): AgentRuntime | undefined {
    return this.agents.get(agentId)
  }

  getIdleAgents(profileId?: string): AgentRuntime[] {
    return Array.from(this.agents.values())
      .filter(a => a.status === 'idle')
      .filter(a => !profileId || a.profile.id === profileId)
  }

  getRunningAgents(): AgentRuntime[] {
    return Array.from(this.agents.values()).filter(a => a.status === 'running')
  }

  assignTask(agentId: string, taskId: ArtifactId): void {
    const agent = this.agents.get(agentId)
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`)
    }
    if (agent.status !== 'idle') {
      throw new Error(`Agent not available (status: ${agent.status})`)
    }

    agent.status = 'running'
    agent.assignedTask = taskId

    this.eventBus.emit('agent.task_assigned', { agentId, taskId }, { artifactId: taskId })
    logger.info({ agentId, taskId }, 'Task assigned to agent')
  }

  updateStatus(agentId: string, status: AgentStatus): void {
    const agent = this.agents.get(agentId)
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`)
    }
    agent.status = status
  }

  complete(agentId: string, outputArtifacts: ArtifactId[]): void {
    const agent = this.agents.get(agentId)
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`)
    }

    agent.status = 'completed'
    agent.completedAt = Date.now()
    agent.outputArtifacts = outputArtifacts

    this.eventBus.emit('agent.completed', { agentId, outputs: outputArtifacts }, { sessionId: 'system' })
    logger.info({ agentId, outputs: outputArtifacts.length }, 'Agent completed task')
  }

  fail(agentId: string, error: string): void {
    const agent = this.agents.get(agentId)
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`)
    }

    agent.status = 'failed'
    agent.completedAt = Date.now()
    agent.error = error

    this.eventBus.emit('agent.failed', { agentId, error }, { sessionId: 'system' })
    logger.error({ agentId, error }, 'Agent failed')
  }

  recycle(agentId: string): void {
    const agent = this.agents.get(agentId)
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`)
    }

    this.agents.delete(agentId)
    this.eventBus.emit('agent.recycled', { agentId }, { sessionId: 'system' })
    logger.info({ agentId }, 'Agent recycled')
  }

  getAll(): AgentRuntime[] {
    return Array.from(this.agents.values())
  }

  size(): number {
    return this.agents.size
  }
}
