// SCALE Engine — Workflow Orchestrator (v0.10.0)
// DAG 工作流编排器：解析 YAML 工作流、并行执行步骤、管理状态

import type {
  WorkflowDefinition,
  WorkflowStepDef,
  WorkflowStepResult,
  WorkflowExecutionResult,
  DAGExecutionGraph,
  WorkflowLLMConfig
} from '../agents/types.js'
import { DAGBuilder } from './DAGBuilder.js'
import { AgentPool } from '../agents/AgentPool.js'
import { AgentDispatcher } from '../agents/AgentDispatcher.js'

/**
 * WorkflowOrchestrator — 工作流编排器
 * 
 * 核心功能：
 * - 解析 YAML WorkflowDefinition
 * - 构建 DAG 执行图
 * - 并行执行无依赖步骤
 * - 管理步骤状态和输出变量
 */
export class WorkflowOrchestrator {
  private dagBuilder = new DAGBuilder()
  private agentPool: AgentPool
  private dispatcher: AgentDispatcher
  private outputs = new Map<string, string>() // 输出变量存储
  
  constructor(agentPool: AgentPool, dispatcher: AgentDispatcher) {
    this.agentPool = agentPool
    this.dispatcher = dispatcher
  }
  
  /**
   * 执行工作流
   * @param workflow Workflow 定义
   * @returns 执行结果
   */
  async execute(workflow: WorkflowDefinition): Promise<WorkflowExecutionResult> {
    const startTime = Date.now()
    const stepResults = new Map<string, WorkflowStepResult>()
    const executionLog: string[] = []
    
    executionLog.push(`[${new Date().toISOString()}] Workflow started: ${workflow.name}`)
    
    try {
      // 1. 构建 DAG 执行图
      const graph = this.dagBuilder.buildGraph(workflow.steps)
      executionLog.push(`[${new Date().toISOString()}] DAG built: ${graph.maxLevel + 1} levels, ${graph.nodes.size} nodes`)
      
      // 2. 初始化所有步骤状态为 pending
      for (const [id] of graph.nodes) {
        stepResults.set(id, {
          stepId: id,
          status: 'pending'
        })
      }
      
      // 3. 按层级并行执行
      const completedIds = new Set<string>()
      const concurrency = workflow.concurrency || 3
      
      for (const level of graph.levels) {
        // 同层级步骤可并行执行
        const parallelSteps = level.map(n => n.step)
        const batchSize = Math.min(parallelSteps.length, concurrency)
        
        executionLog.push(`[${new Date().toISOString()}] Level ${level[0]?.level}: Executing ${parallelSteps.length} steps (batch: ${batchSize})`)
        
        // 分批并行执行
        for (let i = 0; i < parallelSteps.length; i += batchSize) {
          const batch = parallelSteps.slice(i, i + batchSize)
          const batchResults = await Promise.all(
            batch.map(step => this.executeStep(step, workflow.llm, stepResults, executionLog))
          )
          
          // 收集输出变量
          for (const result of batchResults) {
            if (result.output) {
              const step = workflow.steps.find(s => s.id === result.stepId)
              if (step?.output) {
                this.outputs.set(step.output, result.output)
                executionLog.push(`[${new Date().toISOString()}] Output: ${step.output} = ${result.output.slice(0, 50)}...`)
              }
            }
            completedIds.add(result.stepId)
          }
        }
      }
      
      // 4. 统计结果
      const duration = Date.now() - startTime
      const completedSteps = Array.from(stepResults.values()).filter(r => r.status === 'completed').length
      const failedSteps = Array.from(stepResults.values()).filter(r => r.status === 'failed').length
      
      executionLog.push(`[${new Date().toISOString()}] Workflow completed: ${completedSteps}/${workflow.steps.length} steps, ${duration}ms`)
      
      return {
        workflowName: workflow.name,
        success: failedSteps === 0,
        totalSteps: workflow.steps.length,
        completedSteps,
        failedSteps,
        duration,
        stepResults,
        outputs: Object.fromEntries(this.outputs),
        executionLog
      }
      
    } catch (error) {
      const duration = Date.now() - startTime
      executionLog.push(`[${new Date().toISOString()}] Workflow failed: ${error}`)
      
      return {
        workflowName: workflow.name,
        success: false,
        totalSteps: workflow.steps.length,
        completedSteps: 0,
        failedSteps: workflow.steps.length,
        duration,
        stepResults,
        outputs: Object.fromEntries(this.outputs),
        executionLog
      }
    }
  }
  
  /**
   * 执行单个步骤
   */
  private async executeStep(
    step: WorkflowStepDef,
    llmConfig: WorkflowLLMConfig,
    stepResults: Map<string, WorkflowStepResult>,
    executionLog: string[]
  ): Promise<WorkflowStepResult> {
    const startTime = Date.now()
    const result: WorkflowStepResult = {
      stepId: step.id,
      status: 'running',
      retryCount: 0
    }
    
    stepResults.set(step.id, result)
    executionLog.push(`[${new Date().toISOString()}] Step ${step.id} started: role=${step.role}`)
    
    try {
      // 1. 解析任务描述中的变量
      const resolvedTask = this.resolveVariables(step.task)
      
      // 2. 选择 Agent Profile
      const profileId = step.role.replace('engineering/', '').replace('roles/', '')
      
      // 3. Spawn Agent（如果池中没有空闲的）
      const idleAgents = this.agentPool.getIdleAgents(profileId)
      const agent = idleAgents.length > 0 
        ? idleAgents[0]
        : this.agentPool.spawn(profileId)
      
      result.agentId = agent.id
      
      // 4. 执行任务（模拟 - 实际应调用 LLM）
      const output = await this.simulateExecution(agent, resolvedTask, llmConfig)
      
      // 5. 完成
      result.status = 'completed'
      result.output = output
      result.duration = Date.now() - startTime
      
      this.agentPool.complete(agent.id, [])
      
      executionLog.push(`[${new Date().toISOString()}] Step ${step.id} completed: ${result.duration}ms`)
      
    } catch (error) {
      result.status = 'failed'
      result.error = String(error)
      result.duration = Date.now() - startTime
      
      executionLog.push(`[${new Date().toISOString()}] Step ${step.id} failed: ${error}`)
      
      // 重试逻辑
      const currentRetryCount = result.retryCount ?? 0
      if (step.retry && currentRetryCount < step.retry) {
        result.retryCount = currentRetryCount + 1
        executionLog.push(`[${new Date().toISOString()}] Step ${step.id} retrying (${result.retryCount}/${step.retry})`)
        return this.executeStep(step, llmConfig, stepResults, executionLog)
      }
    }
    
    return result
  }
  
  /**
   * 解析变量（{{output_name}} → 实际值）
   */
  private resolveVariables(template: string): string {
    let resolved = template
    for (const [name, value] of this.outputs) {
      resolved = resolved.replace(new RegExp(`\{\{${name}\}\}`, 'g'), value)
    }
    return resolved
  }
  
  /**
   * 模拟执行（实际应调用 LLM）
   * TODO: 集成真实 LLM 调用
   */
  private async simulateExecution(
    agent: { id: string; profile: { id: string } },
    task: string,
    llmConfig: WorkflowLLMConfig
  ): Promise<string> {
    // 模拟输出
    return `Simulated output from ${agent.profile.id} for task: ${task.slice(0, 30)}...`
  }
  
  /**
   * 获取输出变量
   */
  getOutput(name: string): string | undefined {
    return this.outputs.get(name)
  }
  
  /**
   * 清除输出变量
   */
  clearOutputs(): void {
    this.outputs.clear()
  }
}

/** 创建 WorkflowOrchestrator 实例 */
export function createWorkflowOrchestrator(
  agentPool: AgentPool,
  dispatcher: AgentDispatcher
): WorkflowOrchestrator {
  return new WorkflowOrchestrator(agentPool, dispatcher)
}
