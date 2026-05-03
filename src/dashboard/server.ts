// SCALE Engine — Dashboard Server
// Purpose: Observable interface for operators

import type { IArtifactStore } from '../artifact/store.js'
import type { IKnowledgeBase } from '../knowledge/KnowledgeBase.js'
import type { IEventBus } from '../core/eventBus.js'
import type { IAgentManager } from '../agents/IAgent.js'
import type { EvolutionStats } from '../evolution/EvolutionEngine.js'
import { logger } from '../core/logger.js'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface DashboardConfig {
  port: number
  host: string
  artifactStore: IArtifactStore
  knowledgeBase: IKnowledgeBase
  eventBus: IEventBus
  agentManager: IAgentManager
  evolutionStats?: () => EvolutionStats
}

export interface DashboardData {
  artifacts: Array<{
    id: string
    type: string
    status: string
    title: string
    createdAt: number
  }>
  sessions: Array<{
    id: string
    startedAt: number
    artifacts: number
  }>
  knowledge: Array<{
    id: string
    type: string
    title: string
    relevance: number
  }>
  evolution: EvolutionStats
  agents: Array<{
    id: string
    name: string
    dispatchCount: number
    successRate: number
  }>
}

export class DashboardServer {
  private server: ReturnType<typeof createServer> | null = null
  private viewsDir: string

  constructor(private config: DashboardConfig) {
    this.viewsDir = join(import.meta.dirname ?? __dirname, 'views')
  }

  start(): void {
    this.server = createServer(async (req, res) => {
      try {
        await this.handleRequest(req, res)
      } catch (error) {
        logger.error({ error, url: req.url }, 'Dashboard request error')
        res.statusCode = 500
        res.end('Internal Server Error')
      }
    })

    this.server.listen(this.config.port, this.config.host, () => {
      logger.info({ port: this.config.port, host: this.config.host }, 'Dashboard started')
    })
  }

  stop(): void {
    if (this.server) {
      this.server.close()
      this.server = null
      logger.info('Dashboard stopped')
    }
  }

  private async handleRequest(req: any, res: any): Promise<void> {
    const url = req.url ?? '/'
    
    // API routes
    if (url.startsWith('/api/')) {
      await this.handleApi(url, res)
      return
    }

    // Static views
    const viewMap: Record<string, string> = {
      '/': 'artifact-flow.html',
      '/artifacts': 'artifact-flow.html',
      '/sessions': 'session-timeline.html',
      '/knowledge': 'knowledge-graph.html',
      '/evolution': 'evolution-metrics.html',
      '/agents': 'agent-stats.html',
    }

    const viewFile = viewMap[url] ?? 'artifact-flow.html'
    const viewPath = join(this.viewsDir, viewFile)

    try {
      const content = await readFile(viewPath, 'utf-8')
      res.setHeader('Content-Type', 'text/html')
      res.end(content)
    } catch {
      res.statusCode = 404
      res.end('View not found')
    }
  }

  private async handleApi(url: string, res: any): Promise<void> {
    res.setHeader('Content-Type', 'application/json')

    const data = await this.collectData()

    if (url === '/api/artifacts') {
      res.end(JSON.stringify(data.artifacts))
    } else if (url === '/api/sessions') {
      res.end(JSON.stringify(data.sessions))
    } else if (url === '/api/knowledge') {
      res.end(JSON.stringify(data.knowledge))
    } else if (url === '/api/evolution') {
      res.end(JSON.stringify(data.evolution))
    } else if (url === '/api/agents') {
      res.end(JSON.stringify(data.agents))
    } else if (url === '/api/all') {
      res.end(JSON.stringify(data))
    } else {
      res.statusCode = 404
      res.end(JSON.stringify({ error: 'Not found' }))
    }
  }

  private async collectData(): Promise<DashboardData> {
    // Collect artifact data
    const artifacts = await this.config.artifactStore.query({})
    const artifactData = artifacts.map(a => ({
      id: a.id,
      type: a.type,
      status: a.status,
      title: a.title,
      createdAt: a.createdAt,
    }))

    // Collect session data
    const sessions = await this.config.artifactStore.query({})
    const sessionMap = new Map<string, { startedAt: number; artifacts: number }>()
    for (const a of artifacts) {
      const sid = a.sessionId ?? 'default'
      const entry = sessionMap.get(sid) ?? { startedAt: a.createdAt, artifacts: 0 }
      entry.artifacts++
      sessionMap.set(sid, entry)
    }
    const sessionData = Array.from(sessionMap.entries()).map(([id, data]) => ({
      id,
      ...data,
    }))

    // Collect knowledge data
    const knowledge = await this.config.knowledgeBase.recall({})
    const knowledgeData = knowledge.map(k => ({
      id: k.id,
      type: k.type,
      title: k.title,
      relevance: k.relevance,
    }))

    // Evolution stats
    const evolution = this.config.evolutionStats?.() ?? {
      lessonsExtracted: 0,
      rulesProposed: 0,
      rulesApproved: 0,
      hooksGenerated: 0,
    }

    // Agent stats
    const agents = this.config.agentManager.listAll().map(def => ({
      id: def.id,
      name: def.name,
      dispatchCount: 0, // Would need tracking
      successRate: 1.0,
    }))

    return {
      artifacts: artifactData,
      sessions: sessionData,
      knowledge: knowledgeData,
      evolution,
      agents,
    }
  }
}
