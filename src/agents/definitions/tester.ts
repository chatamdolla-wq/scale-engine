// SCALE Engine — Tester Agent Definition
// Purpose: TDD workflow and test coverage

import type { AgentDefinition } from '../IAgent'

export const TESTER_AGENT: AgentDefinition = {
  id: 'tester',
  name: 'Tester',
  description: 'TDD workflow and test coverage specialist',
  triggers: ['test', 'tdd', 'coverage', 'spec', 'verify', 'assert'],
  capabilities: [
    {
      name: 'tdd-red',
      description: 'Write failing tests first (RED phase)',
      inputs: ['requirement'],
      outputs: ['test'],
    },
    {
      name: 'tdd-green',
      description: 'Implement to pass tests (GREEN phase)',
      inputs: ['test'],
      outputs: ['code'],
    },
    {
      name: 'coverage-check',
      description: 'Verify test coverage meets threshold',
      inputs: ['code'],
      outputs: ['report'],
    },
  ],
  toolAllowlist: ['Read', 'Edit', 'Write', 'Bash'],
  toolDenylist: [],
  modelPreference: 'sonnet',
  maxConcurrency: 2,
  timeoutMs: 120000,
  priority: 9,
}
