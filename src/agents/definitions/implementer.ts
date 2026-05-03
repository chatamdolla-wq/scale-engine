// SCALE Engine — Implementer Agent Definition
// Purpose: Code generation and implementation

import type { AgentDefinition } from '../IAgent'

export const IMPLEMENTER_AGENT: AgentDefinition = {
  id: 'implementer',
  name: 'Implementer',
  description: 'Code generation and implementation specialist',
  triggers: ['implement', 'code', 'write', 'create', 'add', 'build', 'develop'],
  capabilities: [
    {
      name: 'code-generation',
      description: 'Generate code from specs or plans',
      inputs: ['spec', 'plan'],
      outputs: ['code'],
    },
    {
      name: 'feature-implementation',
      description: 'Implement complete features',
      inputs: ['requirement', 'design'],
      outputs: ['code', 'tests'],
    },
  ],
  toolAllowlist: ['Read', 'Edit', 'Write', 'Bash'],
  toolDenylist: [],
  modelPreference: 'sonnet',
  maxConcurrency: 2,
  timeoutMs: 180000,
  priority: 8,
}
