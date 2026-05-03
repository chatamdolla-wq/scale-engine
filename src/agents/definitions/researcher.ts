// SCALE Engine — Researcher Agent Definition
// Purpose: Codebase exploration and information gathering

import type { AgentDefinition } from '../IAgent'

export const RESEARCHER_AGENT: AgentDefinition = {
  id: 'researcher',
  name: 'Researcher',
  description: 'Codebase exploration and information gathering specialist',
  triggers: ['explore', 'find', 'search', 'understand', 'what is', 'how does', 'where'],
  capabilities: [
    {
      name: 'codebase-search',
      description: 'Search for files, symbols, patterns in codebase',
      inputs: ['query'],
      outputs: ['results'],
    },
    {
      name: 'documentation-lookup',
      description: 'Find and read documentation',
      inputs: ['topic'],
      outputs: ['docs'],
    },
  ],
  toolAllowlist: ['Glob', 'Grep', 'Read'],
  toolDenylist: ['Write', 'Edit', 'Bash'],
  modelPreference: 'haiku',
  maxConcurrency: 3,
  timeoutMs: 60000,
  priority: 5,
}
