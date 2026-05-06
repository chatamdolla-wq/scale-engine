// SCALE Engine — Agent System Entry Point

export type {
  IAgentManager,
  IAgent,
  AgentDefinition,
  AgentTaskContext,
  AgentResult,
  AgentCapability,
} from './IAgent.js'

export { AGENT_MANAGER_TOKEN } from './IAgent.js'
export { AgentManager, initializeAgentManager } from './AgentManager.js'

export { PLANNER_AGENT } from './definitions/planner.js'
export { RESEARCHER_AGENT } from './definitions/researcher.js'
export { IMPLEMENTER_AGENT } from './definitions/implementer.js'
export { REVIEWER_AGENT } from './definitions/reviewer.js'
export { TESTER_AGENT } from './definitions/tester.js'
export { SECURITY_AGENT } from './definitions/security.js'
export { DEBUGGER_AGENT } from './definitions/debugger.js'
export { DOC_WRITER_AGENT } from './definitions/doc-writer.js'

import { PLANNER_AGENT } from './definitions/planner.js'
import { RESEARCHER_AGENT } from './definitions/researcher.js'
import { IMPLEMENTER_AGENT } from './definitions/implementer.js'
import { REVIEWER_AGENT } from './definitions/reviewer.js'
import { TESTER_AGENT } from './definitions/tester.js'
import { SECURITY_AGENT } from './definitions/security.js'
import { DEBUGGER_AGENT } from './definitions/debugger.js'
import { DOC_WRITER_AGENT } from './definitions/doc-writer.js'

import type { AgentDefinition } from './IAgent.js'

export const ALL_AGENTS: AgentDefinition[] = [
  PLANNER_AGENT,
  RESEARCHER_AGENT,
  IMPLEMENTER_AGENT,
  REVIEWER_AGENT,
  TESTER_AGENT,
  SECURITY_AGENT,
  DEBUGGER_AGENT,
  DOC_WRITER_AGENT,
]

import type { AgentManager } from './AgentManager.js'

export function registerAllAgents(manager: AgentManager): void {
  for (const def of ALL_AGENTS) manager.register(def)
}
