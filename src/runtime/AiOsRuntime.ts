import { resolve } from 'node:path'
import {
  buildContextPack,
  scanContextBudget,
  type ContextPack as BudgetedContextPack,
} from '../context/ContextBudget.js'
import {
  createGovernanceRoiReport,
  type GovernanceRoiReport,
} from '../governance/GovernanceRoi.js'
import {
  evaluateProgressiveGovernance,
  type GovernanceMode,
  type ProgressiveGovernanceReport,
} from '../governance/ProgressiveGovernance.js'
import type { IKnowledgeBase } from '../knowledge/KnowledgeBase.js'
import {
  MemoryFabric,
  recallMemoryProviders,
  type ContextPack as MemoryContextPack,
  type MemoryProviderRecallItem,
} from '../memory/index.js'
import {
  createSkillPlan,
  loadSkillRoutingPolicy,
  type SkillPlan,
  type SkillTaskLevel,
} from '../skills/routing/index.js'
import { SCALE_ENGINE_VERSION } from '../version.js'

export interface AiOsRuntimeInput {
  projectDir?: string
  scaleDir?: string
  taskId?: string
  task: string
  level?: SkillTaskLevel | string
  files?: string[]
  services?: string[]
  budget?: number
  requestedMode?: GovernanceMode
  memoryTopK?: number
  knowledgeBase?: Pick<IKnowledgeBase, 'recall' | 'recallByVector'>
}

export interface AiOsMemoryRuntimeSummary {
  providerOrder: string[]
  selectedProviders: string[]
  fallbackUsed: boolean
  items: MemoryProviderRecallItem[]
  warnings: string[]
  contextPack: MemoryContextPack
}

export interface AiOsAdaptiveWorkflow {
  strategy: 'risk-adaptive-runtime-v1'
  mode: GovernanceMode
  requiredBehaviors: string[]
  gates: string[]
  exitCriteria: string[]
}

export interface AiOsRuntimePlan {
  version: string
  generatedAt: string
  task: {
    taskId?: string
    task: string
    level: SkillTaskLevel
    files: string[]
    services: string[]
  }
  governance: ProgressiveGovernanceReport
  adaptiveWorkflow: AiOsAdaptiveWorkflow
  context: BudgetedContextPack
  memory: AiOsMemoryRuntimeSummary
  skillPlan: SkillPlan
  roi: GovernanceRoiReport
  recommendations: string[]
}

export async function createAiOsPlan(input: AiOsRuntimeInput): Promise<AiOsRuntimePlan> {
  const projectDir = resolve(input.projectDir ?? process.cwd())
  const scaleDir = input.scaleDir ?? '.scale'
  const level = normalizeSkillTaskLevel(input.level)
  const files = input.files ?? []
  const services = input.services ?? []
  const taskId = input.taskId
  const budget = input.budget ?? 8_000

  const governance = evaluateProgressiveGovernance({
    task: input.task,
    changedFiles: files,
    requestedMode: input.requestedMode,
  })
  const contextBudget = scanContextBudget({ projectDir, scaleDir, maxTaskTokens: budget })
  const context = buildContextPack({
    projectDir,
    scaleDir,
    task: input.task,
    taskId,
    level,
    files,
    budget,
  })
  const memoryRecall = await recallMemoryProviders({
    projectDir,
    scaleDir,
    query: [input.task, files.join(' ')].filter(Boolean).join('\n'),
    task: input.task,
    files,
    limit: input.memoryTopK ?? 5,
  })
  const memoryPack = await new MemoryFabric({
    projectDir,
    scaleDir,
    knowledgeBase: input.knowledgeBase,
  }).createContextPack({
    task: input.task,
    taskId,
    level,
    files,
    budgetTokens: Math.max(1, Math.floor(budget / 2)),
    knowledgeTopK: input.memoryTopK,
  })
  const skillPolicy = loadSkillRoutingPolicy(projectDir, scaleDir)
  const skillPlan = createSkillPlan({
    taskId: taskId ?? `AIOS-${Date.now()}`,
    taskName: input.task,
    description: input.task,
    level,
    files,
    services,
    policy: skillPolicy,
  })
  const adaptiveWorkflow = createAdaptiveWorkflow(governance, skillPlan)
  const roi = createGovernanceRoiReport({
    taskId,
    contextBudget,
    contextPack: context,
    governance,
    memoryRecall,
    skillPlan,
  })

  return {
    version: SCALE_ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    task: {
      taskId,
      task: input.task,
      level,
      files,
      services,
    },
    governance,
    adaptiveWorkflow,
    context,
    memory: {
      providerOrder: memoryRecall.providerOrder,
      selectedProviders: memoryRecall.selectedProviders,
      fallbackUsed: memoryRecall.fallbackUsed,
      items: memoryRecall.items,
      warnings: memoryRecall.warnings,
      contextPack: memoryPack,
    },
    skillPlan,
    roi,
    recommendations: recommendations({ governance, context, memoryRecall, skillPlan }),
  }
}

function createAdaptiveWorkflow(governance: ProgressiveGovernanceReport, skillPlan: SkillPlan): AiOsAdaptiveWorkflow {
  const gates = new Set<string>()
  gates.add('context-compiler')
  gates.add('memory-provider-recall')
  if (skillPlan.required || skillPlan.executionPlan.steps.length > 0) gates.add('skill-evidence')
  gates.add('runtime-evidence')
  if (governance.effectiveMode === 'expanded' || governance.effectiveMode === 'critical') gates.add('impact-analysis')
  if (governance.effectiveMode === 'critical') gates.add('security-review')
  return {
    strategy: 'risk-adaptive-runtime-v1',
    mode: governance.effectiveMode,
    requiredBehaviors: governance.requiredBehaviors,
    gates: Array.from(gates),
    exitCriteria: [
      'Context compiler explains included and omitted sections.',
      'Memory recall records provider, score, and evidence paths.',
      'Skill plan lists required proof and fallback policy.',
      'Governance ROI states benefit and overhead before completion.',
    ],
  }
}

function recommendations(options: {
  governance: ProgressiveGovernanceReport
  context: BudgetedContextPack
  memoryRecall: Awaited<ReturnType<typeof recallMemoryProviders>>
  skillPlan: SkillPlan
}): string[] {
  const output: string[] = []
  if (options.context.compiler?.estimatedTokenSavings) {
    output.push(`Keep context compiler active; estimated savings ${options.context.compiler.estimatedTokenSavings} tokens for this task pack.`)
  }
  if (options.memoryRecall.items.length === 0) {
    output.push('No memory recall result found; continue with local evidence and settle reusable knowledge after verification.')
  }
  if (options.skillPlan.executionPlan.steps.length > 0) {
    output.push(`Follow ${options.skillPlan.executionPlan.steps.length} skill routing step(s) and record evidence before ship.`)
  }
  if (options.governance.effectiveMode === 'critical') {
    output.push('Critical workflow mode requires security review and rollback or disable strategy.')
  }
  return output
}

function normalizeSkillTaskLevel(value: unknown): SkillTaskLevel {
  const normalized = String(value ?? 'M').trim().toUpperCase()
  if (normalized === 'S' || normalized === 'M' || normalized === 'L' || normalized === 'CRITICAL') return normalized
  throw new Error(`Invalid task level "${String(value)}"; expected S, M, L, or CRITICAL.`)
}
