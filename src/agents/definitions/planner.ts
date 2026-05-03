// SCALE Engine — Planner Agent Definition
// Purpose: Architecture and implementation planning specialist

import type { AgentDefinition } from '../IAgent'

export const PLANNER_AGENT: AgentDefinition = {
  id: 'planner',
  name: 'Planner',
  description: 'Architecture and implementation planning specialist',
  triggers: ['plan', 'design', 'architecture', 'implement', 'how to', 'approach'],
  capabilities: [
    {
      name: 'architecture-design',
      description: 'Design system architecture and module structure',
      inputs: ['requirement', 'context'],
      outputs: ['spec', 'plan'],
    },
    {
      name: 'implementation-plan',
      description: 'Create step-by-step implementation plan',
      inputs: ['spec', 'task'],
      outputs: ['plan', 'task-list'],
    },
  ],
  toolAllowlist: ['Read', 'Glob', 'Grep', 'Write'],
  toolDenylist: ['Bash', 'Edit'],
  modelPreference: 'opus',
  maxConcurrency: 1,
  timeoutMs: 120000,
  priority: 10,
}
