// SCALE Engine — Reviewer Agent Definition
// Purpose: Code quality and best practices review

import type { AgentDefinition } from '../IAgent'

export const REVIEWER_AGENT: AgentDefinition = {
  id: 'reviewer',
  name: 'Reviewer',
  description: 'Code quality and best practices review specialist',
  triggers: ['review', 'check', 'quality', 'audit', 'improve', 'refactor'],
  capabilities: [
    {
      name: 'code-review',
      description: 'Review code for quality, patterns, best practices',
      inputs: ['code'],
      outputs: ['feedback', 'issues'],
    },
    {
      name: 'quality-check',
      description: 'Check code against quality standards',
      inputs: ['code', 'rules'],
      outputs: ['report'],
    },
  ],
  toolAllowlist: ['Read', 'Grep', 'Bash'],
  toolDenylist: ['Write', 'Edit'],
  modelPreference: 'sonnet',
  maxConcurrency: 2,
  timeoutMs: 90000,
  priority: 7,
}
