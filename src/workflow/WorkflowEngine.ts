// SCALE Engine — Workflow Integration
// 工作流与 CLI/MCP 的集成层

import type { IEventBus } from '../core/eventBus.js'
import type { ICapabilityRegistry } from '../capabilities/types.js'
import type { ISkillRegistry } from '../skills/SkillRegistry.js'
import { GateSystem } from './gates/GateSystem.js'
import type { VerificationCommandConfig } from './VerificationCommands.js'
import { AmbiguityScorer } from './cognitive/AmbiguityScorer.js'
import { ConsensusPlanner } from './cognitive/ConsensusPlanner.js'
import { SocraticQuestioner } from './cognitive/SocraticQuestioner.js'
import { RalphEngine, PRDManager } from './execution/RalphEngine.js'
import { UltraworkEngine, ModelRouter } from './execution/UltraworkEngine.js'
import { HonestDelivery } from './quality/HonestDelivery.js'
import { KarpathyEvaluator } from './quality/KarpathyEvaluator.js'
import type { PRDDocument, UserStory, TaskDefinition, GateStage, AmbiguityScoreResult, SocraticSession } from './types.js'

export interface WorkflowEngineConfig {
  eventBus: IEventBus
  capabilityRegistry?: ICapabilityRegistry
  skillRegistry?: ISkillRegistry
  verificationCommands?: VerificationCommandConfig
}

export class WorkflowEngine {
  private eventBus: IEventBus
  private capabilityRegistry?: ICapabilityRegistry
  private skillRegistry?: ISkillRegistry

  // Core workflow modules
  private gateSystem: GateSystem
  private ambiguityScorer: AmbiguityScorer
  private consensusPlanner: ConsensusPlanner
  private socraticQuestioner: SocraticQuestioner
  private ralphEngine: RalphEngine
  private ultraworkEngine: UltraworkEngine
  private prdManager: PRDManager
  private modelRouter: ModelRouter
  private karpathyEvaluator: KarpathyEvaluator

  constructor(config: WorkflowEngineConfig) {
    this.eventBus = config.eventBus
    this.capabilityRegistry = config.capabilityRegistry
    this.skillRegistry = config.skillRegistry

    // Initialize workflow modules
    this.gateSystem = new GateSystem(this.eventBus, config.verificationCommands)
    this.ambiguityScorer = new AmbiguityScorer()
    this.consensusPlanner = new ConsensusPlanner(this.eventBus)
    this.socraticQuestioner = new SocraticQuestioner(this.eventBus)
    this.ralphEngine = new RalphEngine(this.eventBus)
    this.ultraworkEngine = new UltraworkEngine(this.eventBus)
    this.prdManager = new PRDManager()
    this.modelRouter = new ModelRouter()
    this.karpathyEvaluator = new KarpathyEvaluator()
  }

  // Phase 1: Exploration with Gate G1
  async explore(requirement: string): Promise<{ ambiguityScore: number; gateResult: unknown; socraticSession?: SocraticSession }> {
    // G1: Exploration gate
    const gateResult = await this.gateSystem.executeGate('G1')

    // Analyze requirement ambiguity
    const ambiguityResult = this.ambiguityScorer.analyzeRequirement(requirement)

    // If ambiguity > 20%, start Socratic session
    let socraticSession: SocraticSession | undefined = undefined
    if (ambiguityResult.requiresQuestioning) {
      socraticSession = this.socraticQuestioner.startSession(requirement, ambiguityResult)
    }

    return {
      ambiguityScore: ambiguityResult.totalScore,
      gateResult,
      socraticSession
    }
  }

  // Continue Socratic refinement session
  refineRequirement(session: SocraticSession, questionId: string, answer: string): SocraticSession {
    this.socraticQuestioner.recordAnswer(session.sessionId, questionId, answer)
    const progress = this.socraticQuestioner.evaluateProgress(session)

    // If refined, generate refined requirement
    if (progress.refined) {
      const refined = this.socraticQuestioner.generateRefinedRequirement(session)
      session.status = 'refined'
      // Store refined requirement in session
      if (session.finalAmbiguity) {
        session.finalAmbiguity.totalScore = progress.newAmbiguity
      }
    }

    return session
  }

  // Get next question for refinement
  getNextQuestion(session: SocraticSession): import('./types.js').SocraticQuestion | null {
    return this.socraticQuestioner.askNextQuestion(session)
  }

  // Phase 2: Planning with Consensus
  async plan(requirement: string): Promise<unknown> {
    // Run consensus planner
    const consensusResult = await this.consensusPlanner.execute(requirement)

    // G2: Planning gate (if L-level task)
    if (consensusResult.viableOptions.length > 1) {
      await this.gateSystem.executeGate('G2')
    }

    return consensusResult
  }

  // Phase 3: Build with Task orchestration
  async build(tasks: TaskDefinition[]): Promise<Map<string, unknown>> {
    this.ultraworkEngine.addTasks(tasks)
    return await this.ultraworkEngine.executeParallel()
  }

  // Phase 4: Verify with build and quality gates
  async verify(commandOverrides?: VerificationCommandConfig): Promise<import('./types.js').GateResult[]> {
    if (commandOverrides) {
      this.gateSystem = new GateSystem(this.eventBus, commandOverrides)
    }
    const results = await this.gateSystem.executeAll(['G0', 'G4', 'G5', 'G6', 'G7'])
    return results
  }

  // Phase 5: PRD-driven execution with Ralph
  async executePRD(title: string, stories: UserStory[]): Promise<PRDDocument> {
    const prd = this.prdManager.createPRD(title, stories)
    this.ralphEngine.setPRD(prd)
    return await this.ralphEngine.run()
  }

  // Karpathy principles check
  checkKarpathy(context: {
    hypothesesListed: boolean
    hasExtraFeatures: boolean
    changesTraceable: boolean
    hasVerifiableGoal: boolean
  }): unknown {
    return this.karpathyEvaluator.evaluateAll(context)
  }

  // Generate honest delivery report
  generateDeliveryReport(): string {
    return this.ralphEngine.generateDeliveryReport()
  }

  // Execute skill (MCP integration)
  async executeSkill(skillId: string, input: Record<string, unknown>): Promise<unknown> {
    if (!this.skillRegistry) {
      throw new Error('Skill registry not configured')
    }
    // This would integrate with SkillExecutor
    const skill = this.skillRegistry.get(skillId)
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`)
    }
    return { skillId, input, status: 'delegated' }
  }

  // Execute MCP capability
  async executeMCPCapability(toolName: string, input: Record<string, unknown>): Promise<unknown> {
    if (!this.capabilityRegistry) {
      throw new Error('Capability registry not configured')
    }
    // Route to appropriate capability
    if (toolName.includes('browser')) {
      const browser = this.capabilityRegistry.getBrowser()
      if (!browser) throw new Error('Browser capability not available')
      return { capability: 'browser', toolName, input }
    }
    if (toolName.includes('search') || toolName.includes('fetch')) {
      const search = this.capabilityRegistry.getSearch()
      if (!search) throw new Error('Search capability not available')
      return { capability: 'search', toolName, input }
    }
    if (toolName.includes('exa')) {
      const exa = this.capabilityRegistry.getExa()
      if (!exa) throw new Error('Exa capability not available')
      return { capability: 'exa', toolName, input }
    }
    throw new Error(`Unknown MCP tool: ${toolName}`)
  }

  // Model routing for task execution
  routeModel(taskType: string): string {
    return this.modelRouter.route(taskType)
  }

  // Getters for individual modules
  getGates(): GateSystem { return this.gateSystem }
  getAmbiguityScorer(): AmbiguityScorer { return this.ambiguityScorer }
  getConsensusPlanner(): ConsensusPlanner { return this.consensusPlanner }
  getSocraticQuestioner(): SocraticQuestioner { return this.socraticQuestioner }
  getRalphEngine(): RalphEngine { return this.ralphEngine }
  getUltraworkEngine(): UltraworkEngine { return this.ultraworkEngine }
  getPRDManager(): PRDManager { return this.prdManager }
  getKarpathyEvaluator(): KarpathyEvaluator { return this.karpathyEvaluator }
}
