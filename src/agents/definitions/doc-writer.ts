// SCALE Engine — Doc Writer Agent Definition
// Purpose: Documentation and README generation

import type { AgentDefinition } from '../IAgent'

export const DOC_WRITER_AGENT: AgentDefinition = {
  id: 'doc-writer',
  name: 'Doc Writer',
  description: 'Documentation and README generation specialist',
  triggers: ['document', 'readme', 'doc', 'guide', 'manual', 'explain'],
  capabilities: [
    {
      name: 'readme-generation',
      description: 'Generate README files',
      inputs: ['project', 'code'],
      outputs: ['readme'],
    },
    {
      name: 'api-documentation',
      description: 'Document API endpoints',
      inputs: ['code'],
      outputs: ['docs'],
    },
  ],
  toolAllowlist: ['Read', 'Write'],
  toolDenylist: ['Edit', 'Bash'],
  modelPreference: 'haiku',
  maxConcurrency: 3,
  timeoutMs: 60000,
  priority: 3,
}
