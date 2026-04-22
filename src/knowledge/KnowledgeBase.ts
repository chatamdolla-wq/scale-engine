// SCALE Engine — Knowledge Base (W7 完整实现)
// 设计参考：docs/03-CORE-MODULES.md §3.4

import type { KnowledgeEntry, KnowledgeQuery } from '../artifact/types.js'
import type { IEventBus } from '../core/eventBus.js'
import { logger } from '../core/logger.js'

export interface IKnowledgeBase {
  add(entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'accessCount' | 'relevance'>): Promise<KnowledgeEntry>
  recall(query: KnowledgeQuery): Promise<KnowledgeEntry[]>
  recallByVector(text: string, topK: number): Promise<KnowledgeEntry[]>
  markHelpful(id: string, sessionId: string): Promise<void>
  markUseless(id: string, sessionId: string): Promise<void>
  verify(id: string, verifiedBy: string): Promise<void>
  decay(): Promise<void>
}

export class KnowledgeBase implements IKnowledgeBase {
  private entries = new Map<string, KnowledgeEntry>()
  private seq = 0

  constructor(private eventBus: IEventBus) {}

  async add(input: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'accessCount' | 'relevance'>): Promise<KnowledgeEntry> {
    const entry: KnowledgeEntry = {
      ...input,
      id: this.generateId(),
      createdAt: Date.now(),
      accessCount: 0,
      relevance: 0.5,
    }
    this.entries.set(entry.id, entry)
    this.eventBus.emit('lesson.proposed', { lessonId: entry.id }, { artifactId: input.sourceArtifact })
    return entry
  }

  async recall(query: KnowledgeQuery): Promise<KnowledgeEntry[]> {
    let results = Array.from(this.entries.values())
    if (query.type) {
      const types = Array.isArray(query.type) ? query.type : [query.type]
      results = results.filter((e) => types.includes(e.type))
    }
    if (query.tags) results = results.filter((e) => query.tags!.every((t) => e.tags.includes(t)))
    if (query.minRelevance) results = results.filter((e) => e.relevance >= query.minRelevance!)
    if (query.verifiedOnly) results = results.filter((e) => e.verified)
    results.sort((a, b) => b.relevance - a.relevance)
    return results.slice(0, query.limit ?? 10)
  }

  async recallByVector(text: string, topK: number): Promise<KnowledgeEntry[]> {
    // W7 实现：Qdrant 集成
    logger.debug({ text, topK }, 'recallByVector (skeleton, falling back to recall)')
    return this.recall({ verifiedOnly: true, limit: topK })
  }

  async markHelpful(id: string, sessionId: string): Promise<void> {
    const entry = this.entries.get(id)
    if (entry) {
      entry.relevance = Math.min(1, entry.relevance + 0.05)
      entry.accessCount += 1
      entry.lastAccessed = Date.now()
      this.eventBus.emit('lesson.helpful', { lessonId: id }, { sessionId })
    }
  }

  async markUseless(id: string, sessionId: string): Promise<void> {
    const entry = this.entries.get(id)
    if (entry) {
      entry.relevance = Math.max(0.05, entry.relevance - 0.1)
      this.eventBus.emit('lesson.useless', { lessonId: id }, { sessionId })
    }
  }

  async verify(id: string, verifiedBy: string): Promise<void> {
    const entry = this.entries.get(id)
    if (entry) {
      entry.verified = true
      entry.verifiedBy = verifiedBy
      entry.verifiedAt = Date.now()
      this.eventBus.emit('lesson.approved', { lessonId: id, verifiedBy })
    }
  }

  async decay(): Promise<void> {
    const DAY = 24 * 60 * 60 * 1000
    for (const entry of this.entries.values()) {
      const days = entry.lastAccessed ? (Date.now() - entry.lastAccessed) / DAY : 90
      const recency = Math.exp(-days / 30)
      entry.relevance = Math.max(0.05, entry.relevance * 0.95 + recency * 0.05)
    }
  }

  private generateId(): string {
    this.seq = (this.seq + 1) % 10000
    return `KB-${Date.now()}-${this.seq.toString().padStart(4, '0')}`
  }
}
