// SCALE Engine — Model Router (W9)
// 基于任务复杂度选择模型
// 设计参考：docs/01-ARCHITECTURE.md §二 L4

import type { IEventBus } from '../core/eventBus.js'
import { logger } from '../core/logger.js'

export type ModelTier = 'fast' | 'balanced' | 'powerful' | 'local'

export interface ModelConfig {
  tier: ModelTier
  name: string
  maxTokens: number
  costPerMToken: number // $ per million tokens
}

export const DEFAULT_MODELS: Record<ModelTier, ModelConfig> = {
  fast: { tier: 'fast', name: 'claude-haiku', maxTokens: 200_000, costPerMToken: 0.25 },
  balanced: { tier: 'balanced', name: 'claude-sonnet', maxTokens: 200_000, costPerMToken: 3.0 },
  powerful: { tier: 'powerful', name: 'claude-opus', maxTokens: 200_000, costPerMToken: 15.0 },
  local: { tier: 'local', name: 'local-llm', maxTokens: 32_000, costPerMToken: 0.0 },
}

export interface RoutingContext {
  taskComplexity?: number    // 0-1, from BehaviorTracker or manual
  artifactType?: string
  stepCount?: number
  previousFailures?: number
  budget?: 'low' | 'medium' | 'high'
}

export interface IModelRouter {
  route(ctx: RoutingContext): ModelConfig
  getModels(): Record<ModelTier, ModelConfig>
  setModel(tier: ModelTier, config: ModelConfig): void
}

export class ModelRouter implements IModelRouter {
  private models: Record<ModelTier, ModelConfig>

  constructor(
    private eventBus: IEventBus,
    models?: Partial<Record<ModelTier, ModelConfig>>,
  ) {
    this.models = { ...DEFAULT_MODELS, ...models }
  }

  route(ctx: RoutingContext): ModelConfig {
    let tier: ModelTier

    // Rule 1: Budget override
    if (ctx.budget === 'low') {
      tier = 'fast'
    } else if (ctx.budget === 'high') {
      tier = 'powerful'
    }
    // Rule 2: High complexity or repeated failures → powerful
    else if ((ctx.taskComplexity ?? 0) > 0.7 || (ctx.previousFailures ?? 0) >= 2) {
      tier = 'powerful'
    }
    // Rule 3: Simple tasks → fast
    else if ((ctx.taskComplexity ?? 0.5) < 0.3 && (ctx.stepCount ?? 1) <= 2) {
      tier = 'fast'
    }
    // Rule 4: Default → balanced
    else {
      tier = 'balanced'
    }

    const model = this.models[tier]

    logger.debug({ ctx, selectedTier: tier, model: model.name }, 'Model routed')
    this.eventBus.emit('tool.called', {
      tool: 'ModelRouter',
      routedTo: model.name,
      tier,
      reason: this.explainRouting(ctx, tier),
    })

    return model
  }

  getModels(): Record<ModelTier, ModelConfig> {
    return { ...this.models }
  }

  setModel(tier: ModelTier, config: ModelConfig): void {
    this.models[tier] = config
  }

  private explainRouting(ctx: RoutingContext, tier: ModelTier): string {
    if (ctx.budget === 'low') return 'budget=low → fast'
    if (ctx.budget === 'high') return 'budget=high → powerful'
    if ((ctx.previousFailures ?? 0) >= 2) return `${ctx.previousFailures} failures → powerful`
    if ((ctx.taskComplexity ?? 0) > 0.7) return `complexity=${ctx.taskComplexity} → powerful`
    if ((ctx.taskComplexity ?? 0.5) < 0.3) return `complexity=${ctx.taskComplexity} → fast`
    return `default → ${tier}`
  }
}

