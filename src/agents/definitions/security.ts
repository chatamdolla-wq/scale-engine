// SCALE Engine — Security Agent Definition
// Purpose: Security audit and vulnerability detection

import type { AgentDefinition } from '../IAgent'

export const SECURITY_AGENT: AgentDefinition = {
  id: 'security',
  name: 'Security',
  description: 'Security audit and vulnerability detection specialist',
  triggers: ['security', 'audit', 'vulnerability', 'owasp', 'auth', 'inject', 'xss'],
  capabilities: [
    {
      name: 'security-review',
      description: 'Review code for security vulnerabilities',
      inputs: ['code'],
      outputs: ['issues', 'recommendations'],
    },
    {
      name: 'owasp-check',
      description: 'Check against OWASP Top 10',
      inputs: ['code'],
      outputs: ['report'],
    },
  ],
  toolAllowlist: ['Read', 'Grep', 'Bash'],
  toolDenylist: ['Write', 'Edit'],
  modelPreference: 'opus',
  maxConcurrency: 1,
  timeoutMs: 150000,
  priority: 15,
}
