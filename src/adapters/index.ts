// SCALE Engine — Unified Adapter Factory
// 统一导出所有 Agent Adapter + createAdapter 工厂函数

import type { IAgentAdapter } from './ClaudeCodeAdapter.js'
import { ClaudeCodeAdapter } from './ClaudeCodeAdapter.js'
import { CodexAdapter } from './CodexAdapter.js'
import { OpenCodeAdapter } from './OpenCodeAdapter.js'
import { CursorAdapter } from './CursorAdapter.js'
import { GeminiAdapter } from './GeminiAdapter.js'
import { OpenClawAdapter } from './OpenClawAdapter.js'
import { HermesAdapter } from './HermesAdapter.js'
import { TraeAdapter } from './TraeAdapter.js'
import { WorkBuddyAdapter } from './WorkBuddyAdapter.js'
import { VSCAdapter } from './VSCAdapter.js'
import { QCoderAdapter } from './QCoderAdapter.js'
import { DeepSeekTuiAdapter } from './DeepSeekTuiAdapter.js'
import type { AgentPlatform } from '../artifact/types.js'

// Re-export all adapters and shared types
export type { IAgentAdapter, AdapterConfig, InitResult, SettingsJson, HookEntry } from './ClaudeCodeAdapter.js'
export { ClaudeCodeAdapter } from './ClaudeCodeAdapter.js'
export { CodexAdapter } from './CodexAdapter.js'
export { OpenCodeAdapter } from './OpenCodeAdapter.js'
export { CursorAdapter } from './CursorAdapter.js'
export { GeminiAdapter } from './GeminiAdapter.js'
export { OpenClawAdapter } from './OpenClawAdapter.js'
export { HermesAdapter } from './HermesAdapter.js'
export { TraeAdapter } from './TraeAdapter.js'
export { WorkBuddyAdapter } from './WorkBuddyAdapter.js'
export { VSCAdapter } from './VSCAdapter.js'
export { QCoderAdapter } from './QCoderAdapter.js'
export { DeepSeekTuiAdapter } from './DeepSeekTuiAdapter.js'

// ============================================================================
// Adapter Registry
// ============================================================================

const ADAPTER_MAP: Record<AgentPlatform, new () => IAgentAdapter> = {
  'claude-code': ClaudeCodeAdapter,
  'codex': CodexAdapter,
  'opencode': OpenCodeAdapter,
  'cursor': CursorAdapter,
  'gemini': GeminiAdapter,
  'openclaw': OpenClawAdapter,
  'hermes': HermesAdapter,
  'trae': TraeAdapter,
  'workbuddy': WorkBuddyAdapter,
  'vsc': VSCAdapter,
  'qcoder': QCoderAdapter,
  'deepseek-tui': DeepSeekTuiAdapter,
}

/** All supported agent type identifiers */
export const SUPPORTED_AGENTS = Object.keys(ADAPTER_MAP) as AgentPlatform[]

/**
 * Create an adapter instance for the given agent type.
 * Throws if agent type is not supported.
 */
export function createAdapter(agentType: string): IAgentAdapter {
  const AdapterClass = ADAPTER_MAP[agentType as AgentPlatform]
  if (!AdapterClass) {
    throw new Error(
      `Unsupported agent type: "${agentType}". Supported: ${SUPPORTED_AGENTS.join(', ')}`,
    )
  }
  return new AdapterClass()
}
