// SCALE Engine — Agent System Entry Point
// Purpose: Export all agent definitions and initialization

export {
  IAgentManager,
  IAgent,
  AgentDefinition,
  AgentTaskContext,
  AgentResult,
  AgentCapability,
  AGENT_MANAGER_TOKEN,
} from './IAgent'

export { AgentManager, initializeAgentManager } from './AgentManager'

// Agent definitions
export { PLANNER_AGENT } from './definitions/planner'
export { RESEARCHER_AGENT } from './definitions/researcher'
export { IMPLEMENTER_AGENT } from './definitions/implementer'
export { REVIEWER_AGENT } from './definitions/reviewer'
export { TESTER_AGENT } from './definitions/tester'
export { SECURITY_AGENT } from './definitions/security'
export { DEBUGGER_AGENT } from './definitions/debugger'
export { DOC_WRITER_AGENT } from './definitions/doc-writer'

// All agent definitions array
import { PLANNER_AGENT } from './definitions/planner'
import { RESEARCHER_AGENT } from './definitions/researcher'
import { IMPLEMENTER_AGENT } from './definitions/implementer'
import { REVIEWER_AGENT } from './definitions/reviewer'
import { TESTER_AGENT } from './definitions/tester'
import { SECURITY_AGENT } from './definitions/security'
import { DEBUGGER_AGENT } from './definitions/debugger'
import { DOC_WRITER_AGENT } from './definitions/doc-writer'

export const ALL_AGENTS = [
  PLANNER_AGENT,
  RESEARCHER_AGENT,
  IMPLEMENTER_AGENT,
  REVIEWER_AGENT,
  TESTER_AGENT,
  SECURITY_AGENT,
  DEBUGGER_AGENT,
  DOC_WRITER_AGENT,
]

import type { AgentManager } from './AgentManager'

/**
 * Register all built-in agents
 */
export function registerAllAgents(manager: AgentManager): void {
  for (const def of ALL_AGENTS) {
    manager.register(def)
  }
}
