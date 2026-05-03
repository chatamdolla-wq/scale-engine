// SCALE Engine — Debugger Agent Definition
// Purpose: Root cause analysis and bug fixing

import type { AgentDefinition } from '../IAgent'

export const DEBUGGER_AGENT: AgentDefinition = {
  id: 'debugger',
  name: 'Debugger',
  description: 'Root cause analysis and systematic debugging specialist',
  triggers: ['debug', 'fix', 'error', 'bug', 'investigate', 'trace', 'fail'],
  capabilities: [
    {
      name: 'root-cause-analysis',
      description: 'Identify root cause of issues',
      inputs: ['error', 'context'],
      outputs: ['diagnosis'],
    },
    {
      name: 'bug-fix',
      description: 'Fix identified bugs',
      inputs: ['diagnosis'],
      outputs: ['fix'],
    },
  ],
  toolAllowlist: ['Read', 'Grep', 'Bash', 'Edit'],
  toolDenylist: ['Write'],
  modelPreference: 'sonnet',
  maxConcurrency: 2,
  timeoutMs: 180000,
  priority: 12,
}
