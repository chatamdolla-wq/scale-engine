import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { skillRoutingPolicyTemplate } from '../skills/routing/SkillPolicy.js'
import { readGovernanceLock, writeGovernanceLock } from './GovernanceLock.js'
import {
  resolveGovernanceTemplatePack,
  type GovernanceGeneratedFile,
  type GovernancePackId,
} from './GovernanceTemplatePacks.js'
import type { VerificationService } from './VerificationProfile.js'

export type GovernanceMode = 'minimal' | 'standard' | 'critical'
export type GovernanceArtifactTemplateName =
  | 'explore.md'
  | 'mini-prd.md'
  | 'skill-plan.md'
  | 'ui-spec.md'
  | 'visual-review.md'
  | 'api-contract.md'
  | 'security-review.md'
  | 'db-change-plan.md'
  | 'e2e-plan.md'
  | 'plan.md'
  | 'verification.md'
  | 'review.md'
  | 'summary.md'

export interface GovernanceTemplateOptions {
  mode?: GovernanceMode
  projectName?: string
  pack?: GovernancePackId | string
  services?: VerificationService[]
  exclude?: string[]
}

export interface GovernanceTemplateResult {
  created: string[]
  skipped: string[]
}

export function writeGovernanceTemplates(
  projectDir = process.cwd(),
  options: GovernanceTemplateOptions = {},
): GovernanceTemplateResult {
  const mode = options.mode ?? 'standard'
  const projectName = options.projectName ?? 'Project'
  const pack = resolveGovernanceTemplatePack(options.pack)
  const packMode = pack.modeDefaults[mode]
  const services = options.services ?? pack.defaultServices ?? []
  const exclude = options.exclude ?? pack.exclude ?? ['node_modules', 'dist', 'tmp', 'vendor']
  const result: GovernanceTemplateResult = { created: [], skipped: [] }
  const lockFiles = new Map<string, { path: string; owned: boolean; sha256?: string }>()
  for (const file of readGovernanceLock(projectDir)?.files ?? []) {
    lockFiles.set(file.path, file)
  }

  writeTracked(result, lockFiles, projectDir, 'docs/workflow/README.md', workflowReadme(projectName, mode, pack.id))
  writeTracked(result, lockFiles, projectDir, 'docs/workflow/templates/explore.md', governanceTemplateContent('explore.md'))
  writeTracked(result, lockFiles, projectDir, 'docs/workflow/templates/mini-prd.md', governanceTemplateContent('mini-prd.md'))
  writeTracked(result, lockFiles, projectDir, 'docs/workflow/templates/skill-plan.md', governanceTemplateContent('skill-plan.md'))
  writeTracked(result, lockFiles, projectDir, 'docs/workflow/templates/ui-spec.md', governanceTemplateContent('ui-spec.md'))
  writeTracked(result, lockFiles, projectDir, 'docs/workflow/templates/visual-review.md', governanceTemplateContent('visual-review.md'))
  writeTracked(result, lockFiles, projectDir, 'docs/workflow/templates/api-contract.md', governanceTemplateContent('api-contract.md'))
  writeTracked(result, lockFiles, projectDir, 'docs/workflow/templates/security-review.md', governanceTemplateContent('security-review.md'))
  writeTracked(result, lockFiles, projectDir, 'docs/workflow/templates/db-change-plan.md', governanceTemplateContent('db-change-plan.md'))
  writeTracked(result, lockFiles, projectDir, 'docs/workflow/templates/e2e-plan.md', governanceTemplateContent('e2e-plan.md'))
  writeTracked(result, lockFiles, projectDir, 'docs/workflow/templates/plan.md', governanceTemplateContent('plan.md'))
  writeTracked(result, lockFiles, projectDir, 'docs/workflow/templates/verification.md', governanceTemplateContent('verification.md'))
  writeTracked(result, lockFiles, projectDir, 'docs/workflow/templates/review.md', governanceTemplateContent('review.md'))
  writeTracked(result, lockFiles, projectDir, 'docs/workflow/templates/summary.md', governanceTemplateContent('summary.md'))
  writeTracked(result, lockFiles, projectDir, 'docs/workflow/templates/github-actions-scale-preflight.yml', githubActionsPreflightTemplate())
  writeTracked(result, lockFiles, projectDir, 'docs/workflow/templates/pre-push-scale-preflight.sh', prePushPreflightTemplate())
  writeTracked(result, lockFiles, projectDir, 'docs/worklog/metrics.md', metricsTemplate())
  writeTracked(result, lockFiles, projectDir, '.scale/verification.json', verificationMatrixTemplate(mode, {
    services,
    exclude,
    artifactGate: packMode.artifactGate,
  }))
  writeTracked(result, lockFiles, projectDir, '.scale/skills.json', skillRoutingPolicyTemplate(mode))

  for (const file of pack.generatedFiles) {
    writePackGeneratedFile(result, lockFiles, projectDir, pack.id, pack.version, file)
  }

  const lockPath = join(projectDir, '.scale', 'governance.lock.json')
  writeGovernanceLock(projectDir, {
    pack: pack.id,
    packVersion: pack.version,
    scaleVersion: packageVersion(),
    files: [...lockFiles.values()],
  })
  result.created.push(lockPath)

  return result
}

export function governanceTemplateContent(name: GovernanceArtifactTemplateName): string {
  switch (name) {
    case 'explore.md': return exploreTemplate()
    case 'mini-prd.md': return miniPrdTemplate()
    case 'skill-plan.md': return skillPlanTemplate()
    case 'ui-spec.md': return uiSpecTemplate()
    case 'visual-review.md': return visualReviewTemplate()
    case 'api-contract.md': return apiContractTemplate()
    case 'security-review.md': return securityReviewTemplate()
    case 'db-change-plan.md': return dbChangePlanTemplate()
    case 'e2e-plan.md': return e2ePlanTemplate()
    case 'plan.md': return planTemplate()
    case 'verification.md': return verificationTemplate()
    case 'review.md': return reviewTemplate()
    case 'summary.md': return summaryTemplate()
  }
}

function writeIfMissing(result: GovernanceTemplateResult, path: string, content: string): boolean {
  if (existsSync(path)) {
    result.skipped.push(path)
    return false
  }
  const dir = path.split(/[\\/]/).slice(0, -1).join('/')
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(path, content, 'utf-8')
  result.created.push(path)
  return true
}

function writeTracked(
  result: GovernanceTemplateResult,
  lockFiles: Map<string, { path: string; owned: boolean; sha256?: string }>,
  projectDir: string,
  relativePath: string,
  content: string,
): void {
  const created = writeIfMissing(result, join(projectDir, relativePath), content)
  if (created) lockFiles.set(relativePath, { path: relativePath, owned: true })
}

function writePackGeneratedFile(
  result: GovernanceTemplateResult,
  lockFiles: Map<string, { path: string; owned: boolean; sha256?: string }>,
  projectDir: string,
  packId: string,
  packVersion: number,
  file: GovernanceGeneratedFile,
): void {
  const content = shouldUseGeneratedHeader(file)
    ? generatedHeader(packId, packVersion) + file.content
    : file.content
  const created = writeIfMissing(result, join(projectDir, file.path), content)
  if (created) lockFiles.set(file.path, { path: file.path, owned: file.owned })
}

function shouldUseGeneratedHeader(file: GovernanceGeneratedFile): boolean {
  return file.kind === 'doc' || file.kind === 'template' || file.kind === 'script'
}

function generatedHeader(packId: string, packVersion: number): string {
  return `# Generated by scale-engine governance pack: ${packId}@${packVersion}
# Edit policy: prefer editing the pack in scale-engine; local overrides should be documented.

`
}

function workflowReadme(projectName: string, mode: GovernanceMode, packId = 'standard'): string {
  return `# ${projectName} Workflow

Governance mode: ${mode}
Governance pack: ${packId}

## Task Levels

| Level | Use for | Required artifacts |
| --- | --- | --- |
| S | typo, comments, small local edits | relevant validation only |
| M | bug fixes, new APIs, 2-5 files | explore, skill plan, plan, verification, review, summary |
| L | cross-module or architecture changes | full artifacts plus human confirmation |
| CRITICAL | auth, permissions, migrations, production config | rollback plan, security review, full verification |

## Standard Task Directory

\`\`\`text
docs/worklog/tasks/<yyyy-mm-dd>-<task-slug>/
├── explore.md
├── mini-prd.md
├── plan.md
├── verification.md
├── review.md
└── summary.md
\`\`\`

## Verification

Use service-aware verification when configured:

\`\`\`bash
scale preflight --service all
scale verify <task-id> --profile default
scale verify <task-id> --service <service-name>
scale verify <task-id> --artifact-gate warn
scale verify <task-id> --artifact-gate block
scale task-artifacts check --dir docs/worklog/tasks/<task-dir> --level L
\`\`\`

Keep \`.scale/verification.json\` as the source of truth for profiles and service commands.
Keep \`.scale/skills.json\` as the source of truth for active skill routing policy.
Use \`artifactGate: "warn"\` while introducing the workflow, then move M/L/CRITICAL work to \`"block"\` once templates and local gates are stable.

## Active Skill Routing

SCALE plans required skills from task description, service selection, and changed files. UI/API work requires a Mini-PRD plus domain evidence such as \`ui-spec.md\`, \`visual-review.md\`, or \`api-contract.md\`. Security and database work require explicit review or rollback artifacts.

When a task records \`servicesTouched\`, \`scale verify <task-id>\` uses those services automatically. You can still override selection with \`--service all\`, \`--service api\`, or \`--service api,gateway\`.

## Workspace Lifecycle

Before finishing an agent-created branch or deleting a temporary worktree, inspect root and child repository state:

\`\`\`bash
scale workspace status --json
scale workspace finish --json
scale workspace cleanup --dir <temporary-worktree> --dry-run --json
scale workspace cleanup --dir <temporary-worktree> --apply --confirm <branch-or-head> --json
\`\`\`

Do not remove a temporary worktree while any submodule or nested repository has uncommitted or unpushed work. Child repositories must be committed and reviewed in their own remotes, then the root repository can record any required pointer or governance updates. Cleanup defaults to dry-run. Applying cleanup requires the reported confirmation token, normally the temporary branch name.

## Automation Templates

Optional automation templates are generated under \`docs/workflow/templates/\`:

- \`github-actions-scale-preflight.yml\`: CI workflow that runs \`scale preflight --service all\`.
- \`pre-push-scale-preflight.sh\`: local pre-push hook template for the same checks.

Keep these templates advisory until \`scale preflight --service all\` is reliable locally for the project.
`
}

function exploreTemplate(): string {
  return `# Explore

## Files Read

- TBD

## Current Behavior

TBD

## Main Conflict

TBD

## Affected Modules

TBD

## Evidence
TBD
`
}

function miniPrdTemplate(): string {
  return `# Mini-PRD

## Background

TBD

## Target Users

TBD

## Core Scenario

TBD

## Non-Goals

TBD

## User Path

TBD

## Permission Rules

TBD

## Data Impact

TBD

## Exception Scenarios

1. TBD
2. TBD
3. TBD

## Acceptance Criteria

- [ ] TBD

## Rollback Or Disable Strategy
TBD
`
}

function skillPlanTemplate(): string {
  return `# Skill Plan

## Detected Intents

| Domain | Score | Evidence |
| --- | ---: | --- |
|  |  |  |

## Required Skills

- TBD

## Recommended Skills

- TBD

## Required Artifacts

- TBD

## Required Verification Evidence

- TBD

## Skipped Skills

| Skill | Reason | Fallback Evidence |
| --- | --- | --- |
|  |  |  |
`
}

function uiSpecTemplate(): string {
  return `# UI Spec

## User Goal

TBD

## Primary Flow

TBD

## Interaction States

- Default:
- Loading:
- Empty:
- Error:
- Success:

## Responsive Behavior

TBD

## Accessibility Requirements

TBD

## Acceptance Criteria

- [ ] TBD
`
}

function visualReviewTemplate(): string {
  return `# Visual Review

## Screenshots Or Evidence

TBD

## Layout And Responsiveness

TBD

## Text Fit And Overlap

TBD

## Accessibility Notes

TBD

## Final Verdict
TBD
`
}

function apiContractTemplate(): string {
  return `# API Contract

## Endpoint Or Interface

TBD

## Request

TBD

## Response

TBD

## Errors

TBD

## Permission Rules

TBD

## Compatibility Notes

TBD

## Acceptance Criteria

- [ ] TBD
`
}

function securityReviewTemplate(): string {
  return `# Security Review

## Assets And Trust Boundaries

TBD

## Authorization Rules

TBD

## Abuse Cases

1. TBD
2. TBD
3. TBD

## Sensitive Data Impact

TBD

## Rollback Or Disable Strategy

TBD

## Final Verdict
TBD
`
}

function dbChangePlanTemplate(): string {
  return `# DB Change Plan

## Schema Or Data Change

TBD

## Backward Compatibility

TBD

## Migration Steps

TBD

## Rollback Plan

TBD

## Verification
TBD
`
}

function e2ePlanTemplate(): string {
  return `# E2E Plan

## User Paths

TBD

## Browser Coverage

TBD

## Test Data

TBD

## Assertions

TBD

## Evidence
TBD
`
}

function planTemplate(): string {
  return `# Plan

## Approach

TBD

## Boundaries

TBD

## Exception Contract

1. TBD
2. TBD
3. TBD

## Rollback Plan

TBD

## Test Strategy
TBD
`
}

function verificationTemplate(): string {
  return `# Verification

## Commands Run

| Command | Result | Notes |
| --- | --- | --- |
|  |  |  |

## Output Summary

TBD

## Failures And Fixes

TBD

## Final Status
TBD
`
}

function reviewTemplate(): string {
  return `# Review

## Code Review

TBD

## Security Review

TBD

## Same-Pattern Scan

TBD

## Residual Risks
TBD
`
}

function summaryTemplate(): string {
  return `# Summary

## Delivered Changes

TBD

## Remaining Risks

TBD

## Follow-Ups

TBD

## Metric Row

| Date | Task | Level | Services | Files Changed | First Verification Pass | Fix Iterations | Artifact Complete | Residual Risk | Final Gate |
| --- | --- | --- | --- | ---: | --- | ---: | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |  |
`
}

function metricsTemplate(): string {
  return `# Workflow Metrics

<!-- SCALE_METRICS:START -->
| Date | Task | Level | Services | Files Changed | First Verification Pass | Fix Iterations | Rework Needed | Artifact Complete | Residual Risk | Final Gate |
| --- | --- | --- | --- | ---: | --- | ---: | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |  |  |
<!-- SCALE_METRICS:END -->

## Monthly Review

### Repeated Failure Patterns

TBD

### Slowest Gates

TBD

### Documentation Gaps

TBD

### Product Design Misses

TBD

### Proposed Workflow Changes
TBD
`
}

function verificationMatrixTemplate(
  mode: GovernanceMode,
  options: { services?: VerificationService[]; exclude?: string[]; artifactGate?: 'off' | 'warn' | 'block' } = {},
): string {
  return JSON.stringify({
    version: 1,
    defaultProfile: 'default',
    profiles: {
      default: {
        commands: {},
        services: options.services?.filter(service => service.required !== false).map(service => service.name) ?? [],
      },
    },
    services: options.services ?? [],
    exclude: options.exclude ?? ['node_modules', 'dist', 'tmp', 'vendor'],
    policy: {
      mode,
      optionalToolsWarnOnly: true,
      artifactGate: options.artifactGate ?? (mode === 'critical' ? 'block' : 'warn'),
      artifactGateLevels: ['M', 'L', 'CRITICAL'],
    },
  }, null, 2) + '\n'
}

function packageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')) as { version?: string }
    return pkg.version ?? '0.0.0-dev'
  } catch {
    return '0.0.0-dev'
  }
}

function githubActionsPreflightTemplate(): string {
  return `name: SCALE Preflight

on:
  pull_request:
  push:
    branches:
      - main
      - master

jobs:
  preflight:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install project dependencies when present
        shell: bash
        run: |
          if [ -f package-lock.json ]; then
            npm ci
          elif [ -f package.json ]; then
            npm install
          fi

      - name: Run SCALE preflight
        run: npx @hongmaple0820/scale-engine@latest preflight --service all
`
}

function prePushPreflightTemplate(): string {
  return `#!/usr/bin/env sh
set -eu

if command -v scale >/dev/null 2>&1; then
  scale preflight --service all
else
  npx @hongmaple0820/scale-engine@latest preflight --service all
fi
`
}
