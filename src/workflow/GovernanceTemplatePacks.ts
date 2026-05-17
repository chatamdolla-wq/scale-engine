import type { GovernanceMode } from './GovernanceTemplates.js'
import type { VerificationService } from './VerificationProfile.js'
import { workspaceTopologyTemplate } from './WorkspaceTopology.js'

export type GovernancePackId =
  | 'standard'
  | 'project-scaffold'
  | 'moe-workspace'
  | 'resource-governance'
  | 'go-service-matrix'
  | 'node-library'
  | 'frontend-app'

export interface GovernanceGeneratedFile {
  path: string
  kind: 'doc' | 'template' | 'script' | 'config'
  owned: boolean
  content: string
}

export interface GovernancePackModeConfig {
  artifactGate: 'off' | 'warn' | 'block'
  skillRoutingMode: 'off' | 'warn' | 'block'
}

export interface GovernanceTemplatePack {
  id: GovernancePackId
  version: number
  description: string
  modeDefaults: Record<GovernanceMode, GovernancePackModeConfig>
  defaultServices?: VerificationService[]
  exclude?: string[]
  generatedFiles: GovernanceGeneratedFile[]
}

export function listGovernanceTemplatePacks(): GovernanceTemplatePack[] {
  return PACKS
}

export function resolveGovernanceTemplatePack(id: string | undefined): GovernanceTemplatePack {
  const normalized = (id || 'standard') as GovernancePackId
  const pack = PACKS.find(candidate => candidate.id === normalized)
  if (!pack) {
    const supported = PACKS.map(candidate => candidate.id).join(', ')
    throw new Error(`Unknown governance pack "${id}". Supported packs: ${supported}`)
  }
  return pack
}

const modeDefaults: GovernanceTemplatePack['modeDefaults'] = {
  minimal: { artifactGate: 'off', skillRoutingMode: 'warn' },
  standard: { artifactGate: 'warn', skillRoutingMode: 'warn' },
  critical: { artifactGate: 'block', skillRoutingMode: 'block' },
}

const PACKS: GovernanceTemplatePack[] = [
  {
    id: 'standard',
    version: 1,
    description: 'Generic SCALE governance output.',
    modeDefaults,
    generatedFiles: [],
  },
  {
    id: 'project-scaffold',
    version: 1,
    description: 'Reference project governance scaffold with workflow wrappers.',
    modeDefaults,
    generatedFiles: [
      { path: 'scripts/workflow/new-task.sh', kind: 'script', owned: true, content: workflowWrapper('new-task', 'create-prd') },
      { path: 'scripts/workflow/explore.sh', kind: 'script', owned: true, content: workflowWrapper('explore', 'skill scan') },
      { path: 'scripts/workflow/resume.sh', kind: 'script', owned: true, content: workflowWrapper('resume', 'status') },
      { path: 'scripts/workflow/verify.sh', kind: 'script', owned: true, content: workflowWrapper('verify', 'preflight') },
      { path: 'scripts/gates/all.sh', kind: 'script', owned: true, content: workflowWrapper('gates/all', 'preflight --service all') },
    ],
  },
  {
    id: 'moe-workspace',
    version: 1,
    description: 'MOE multi-repository workspace governance with explicit topology and finish policy.',
    modeDefaults,
    generatedFiles: [
      { path: '.scale/workspace.json', kind: 'config', owned: true, content: workspaceTopologyTemplate({ topology: 'moe' }) },
      { path: 'docs/workflow/moe-workspace.md', kind: 'doc', owned: true, content: moeWorkspaceGuide() },
    ],
  },
  {
    id: 'resource-governance',
    version: 1,
    description: 'Project resource lifecycle governance for docs, media, reports, scripts, and temporary outputs.',
    modeDefaults,
    generatedFiles: [
      { path: 'docs/workflow/resource-governance.md', kind: 'doc', owned: true, content: resourceGovernanceGuide() },
      { path: 'docs/modules/README.md', kind: 'doc', owned: true, content: moduleDocsIndex() },
      { path: 'docs/workflow/templates/.gitignore.scale-assets.example', kind: 'template', owned: true, content: resourceGitignoreExample() },
    ],
  },
  {
    id: 'go-service-matrix',
    version: 1,
    description: 'Go multi-service repository governance.',
    modeDefaults,
    defaultServices: [
      { name: 'netdisk', path: 'amdox-go-netdisk', type: 'go', required: true },
      { name: 'auth', path: 'amdox-go-auth', type: 'go', required: true },
      { name: 'gateway', path: 'amdox-go-gateway', type: 'go', required: true },
    ],
    exclude: ['OpenList', 'gfast', 'mcp-zero'],
    generatedFiles: [],
  },
  {
    id: 'node-library',
    version: 1,
    description: 'Node/npm library governance with build, test, diff, and pack checks.',
    modeDefaults,
    generatedFiles: [],
  },
  {
    id: 'frontend-app',
    version: 1,
    description: 'Frontend app governance with UI and visual evidence requirements.',
    modeDefaults,
    generatedFiles: [],
  },
]

function workflowWrapper(label: string, scaleCommand: string): string {
  return `#!/usr/bin/env bash
set -euo pipefail

run_scale() {
  if command -v scale >/dev/null 2>&1; then
    scale "$@"
  else
    npx @hongmaple0820/scale-engine@latest "$@"
  fi
}

echo "[scale-engine] compatibility wrapper: scripts/${label}.sh -> scale ${scaleCommand}" >&2
run_scale ${scaleCommand} "$@"
`
}

function moeWorkspaceGuide(): string {
  return `# MOE Workspace Governance

MOE workspaces are multi-repository engineering environments where the root checkout, nested repositories, submodules, and temporary agent worktrees must be finished as one coordinated unit.

## Source Of Truth

- \`.scale/workspace.json\`: repository topology, branch policy, and finish policy.
- \`.scale/verification.json\`: service matrix and verification commands.
- \`docs/worklog/tasks/<task>/\`: task artifacts, verification evidence, and cross-repository impact.

## Required Finish Checks

Before deleting an agent worktree or reporting a task complete:

1. Run \`scale workspace map --json\` to confirm the expected repositories are known.
2. Run \`scale workspace finish --summary\` for the short blocker list; use \`--json\` only when full audit detail is needed.
3. Commit and push child repository work in each repository's own remote.
4. Review whether the root repository needs a submodule pointer, lock file, integration metadata, or documentation update.
5. Run service-aware verification for every touched service.

\`scale ship <task-id>\` performs the same child-repository boundary check before creating a root commit. Dirty or unpushed child repositories block shipping; raw \`git add .\` bypasses this protection and is not allowed for governed MOE workspaces.

## Branch Naming

Use readable branches with author/platform/scope/date context, for example:

\`\`\`text
feature/maple-codex-storage-policy-0515
fix/zpei-claude-upload-retry-0515
codex/moe-workspace-governance-0515
\`\`\`

Protected branches such as \`main\` and \`master\` require explicit human authorization before direct pushes.
`
}

function resourceGovernanceGuide(): string {
  return `# Resource Governance

This project uses SCALE resource governance to keep generated outputs, maintained documentation, task evidence, media, and temporary files from collapsing into one unmanaged document pile.

## Source Of Truth

- \`.scale/resource-policy.json\`: asset classes, retention rules, owners, module mapping, and size limits.
- \`.scale/assets.json\`: explicit long-lived resource catalog and source-of-truth declarations.
- \`docs/modules/\`: maintained module-level product, architecture, API, and operations documentation.
- \`docs/decisions/\`: ADRs and superseded architecture decisions.

## Default Git Policy

| Resource | Default policy |
| --- | --- |
| Module docs, standards, ADRs, contracts, reusable scripts | Commit |
| Task worklog artifacts | Review before commit |
| E2E reports, coverage, screenshots, videos, logs | Ignore or external artifact storage |
| Temporary scripts and scratch files | Ignore and delete after settlement |
| Large media | Git LFS or external storage |

## Required Finish Behavior

Before reporting a M/L/CRITICAL task complete:

1. Run \`scale assets scan --json\`.
2. Run \`scale assets doctor --json\`.
3. Run \`scale assets settle --task-id <task-id> --artifact-dir <task-dir>\`.
4. Promote final product or architecture truth into maintained docs.
5. Keep raw reports, screenshots, videos, and logs out of Git unless they are deliberately promoted.
6. Delete or archive expired temporary files.
`
}

function moduleDocsIndex(): string {
  return `# Module Documentation

Use one directory per maintained module:

\`\`\`text
docs/modules/<module>/
├── README.md
├── product.md
├── architecture.md
├── api.md
└── operations.md
\`\`\`

Keep task-specific drafts in \`docs/worklog/tasks/\`. Promote only final, durable decisions and user-facing behavior into module documentation.
`
}

function resourceGitignoreExample(): string {
  return `# SCALE resource governance runtime outputs
.scale/tmp/
.scale/reports/
.scale/resource-reports/
tmp/
temp/
test-results/
playwright-report/
coverage/

# Raw generated media should be promoted deliberately or stored externally
*.webm
*.mp4
*.mov
*.wav
*.mp3
`
}
