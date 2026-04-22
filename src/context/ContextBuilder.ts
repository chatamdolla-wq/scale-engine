// SCALE Engine — Context Builder (W6 完整实现)
// 分层上下文加载 + Token 预算
// 设计参考：docs/03-CORE-MODULES.md §3.6

import type { ArtifactId, SessionId } from '../artifact/types.js'
import type { IArtifactStore } from '../artifact/store.js'
import type { IKnowledgeBase } from '../knowledge/KnowledgeBase.js'
import type { IEventBus } from '../core/eventBus.js'

export interface ContextLayer {
  name: string
  content: string
  priority: number
  estimatedTokens: number
}

export interface BuiltContext {
  system: string
  metadata: { totalTokens: number; layers: string[] }
}

export interface ContextStatus {
  sessionId: SessionId
  role: string
  allowedTools: string[]
  deniedTools: string[]
  activeArtifacts: Array<{ id: ArtifactId; type: string; status: string; current?: boolean }>
  constraints: string[]
}

export interface IContextBuilder {
  build(opts: { roleId?: string; currentArtifactId?: ArtifactId; sessionId: SessionId }): Promise<BuiltContext>
  getStatus(sessionId: SessionId, roleGate: { getRole(): { id: string; allowedTools: string[]; deniedTools?: string[] } }): Promise<ContextStatus>
}

export class ContextBuilder implements IContextBuilder {
  private budget = { total: 200_000, reserved: 30_000 }

  constructor(
    private store: IArtifactStore,
    private kb: IKnowledgeBase,
    private eventBus: IEventBus
  ) {}

  async build(opts: { roleId?: string; currentArtifactId?: ArtifactId; sessionId: SessionId }): Promise<BuiltContext> {
    const layers: ContextLayer[] = []
    layers.push({ name: 'system_rules', content: '## SCALE Core Rules\n...', priority: 1, estimatedTokens: 3000 })

    if (opts.roleId) {
      layers.push({ name: 'role_prompt', content: `## Active Role: ${opts.roleId}\n...`, priority: 2, estimatedTokens: 1500 })
    }

    if (opts.currentArtifactId) {
      const artifact = await this.store.get(opts.currentArtifactId)
      if (artifact) {
        layers.push({ name: 'current_artifact', content: `## ${artifact.title}\n${JSON.stringify(artifact.payload, null, 2)}`, priority: 3, estimatedTokens: 5000 })
      }
    }

    // P5: 召回 lessons (W7 集成)
    if (opts.currentArtifactId) {
      const artifact = await this.store.get(opts.currentArtifactId)
      if (artifact) {
        const lessons = await this.kb.recallByVector(artifact.title, 3)
        if (lessons.length > 0) {
          const content = '## 相关历史经验\n' + lessons.map((l) => `- ${l.title}`).join('\n')
          layers.push({ name: 'recalled_lessons', content, priority: 5, estimatedTokens: 1500 })
        }
      }
    }

    const available = this.budget.total - this.budget.reserved
    const selected: ContextLayer[] = []
    let used = 0
    for (const layer of layers.sort((a, b) => a.priority - b.priority)) {
      if (used + layer.estimatedTokens > available) break
      selected.push(layer)
      used += layer.estimatedTokens
    }

    this.eventBus.emit('context.built', { layers: selected.map((l) => l.name), totalTokens: used }, { sessionId: opts.sessionId })

    return {
      system: selected.map((l) => l.content).join('\n\n---\n\n'),
      metadata: { totalTokens: used, layers: selected.map((l) => l.name) },
    }
  }

  async getStatus(sessionId: SessionId, roleGate: { getRole(): { id: string; allowedTools: string[]; deniedTools?: string[] } }): Promise<ContextStatus> {
    const role = roleGate.getRole()

    // Query active artifacts for this session (linked via events)
    const events = await this.eventBus.query({
      sessionId,
      types: ['artifact.created', 'artifact.transitioned'],
      limit: 50
    })

    const artifactIds = new Set<ArtifactId>()
    for (const event of events) {
      if (event.artifactId) {
        artifactIds.add(event.artifactId)
      }
    }

    const activeArtifacts = await Promise.all(
      Array.from(artifactIds).map(async (id) => {
        const artifact = await this.store.get(id)
        return artifact ? {
          id: artifact.id,
          type: artifact.type,
          status: artifact.status,
        } : null
      })
    )

    const validArtifacts = activeArtifacts.filter((a) => a !== null) as Array<{ id: ArtifactId; type: string; status: string }>

    // Extract constraints from artifacts and FSM definitions
    const constraints: string[] = []
    for (const artifact of validArtifacts) {
      if (artifact.type === 'Spec' && artifact.status !== 'FROZEN') {
        constraints.push(`Spec must be FROZEN before writing code (current: ${artifact.status})`)
      }
      if (artifact.type === 'Plan' && artifact.status === 'DRAFT') {
        constraints.push(`Plan must be approved before implementation`)
      }
      if (artifact.type === 'Task' && artifact.status === 'TODO') {
        constraints.push(`Task must be READY before implementation`)
      }
    }

    return {
      sessionId,
      role: role.id,
      allowedTools: role.allowedTools,
      deniedTools: role.deniedTools ?? [],
      activeArtifacts: validArtifacts,
      constraints,
    }
  }
}
