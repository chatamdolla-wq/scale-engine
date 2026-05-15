import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { skillRoutingPolicyTemplate } from '../skills/routing/SkillPolicy.js'

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
  const result: GovernanceTemplateResult = { created: [], skipped: [] }

  writeIfMissing(result, join(projectDir, 'docs', 'workflow', 'README.md'), workflowReadme(projectName, mode))
  writeIfMissing(result, join(projectDir, 'docs', 'workflow', 'templates', 'explore.md'), governanceTemplateContent('explore.md'))
  writeIfMissing(result, join(projectDir, 'docs', 'workflow', 'templates', 'mini-prd.md'), governanceTemplateContent('mini-prd.md'))
  writeIfMissing(result, join(projectDir, 'docs', 'workflow', 'templates', 'skill-plan.md'), governanceTemplateContent('skill-plan.md'))
  writeIfMissing(result, join(projectDir, 'docs', 'workflow', 'templates', 'ui-spec.md'), governanceTemplateContent('ui-spec.md'))
  writeIfMissing(result, join(projectDir, 'docs', 'workflow', 'templates', 'visual-review.md'), governanceTemplateContent('visual-review.md'))
  writeIfMissing(result, join(projectDir, 'docs', 'workflow', 'templates', 'api-contract.md'), governanceTemplateContent('api-contract.md'))
  writeIfMissing(result, join(projectDir, 'docs', 'workflow', 'templates', 'security-review.md'), governanceTemplateContent('security-review.md'))
  writeIfMissing(result, join(projectDir, 'docs', 'workflow', 'templates', 'db-change-plan.md'), governanceTemplateContent('db-change-plan.md'))
  writeIfMissing(result, join(projectDir, 'docs', 'workflow', 'templates', 'e2e-plan.md'), governanceTemplateContent('e2e-plan.md'))
  writeIfMissing(result, join(projectDir, 'docs', 'workflow', 'templates', 'plan.md'), governanceTemplateContent('plan.md'))
  writeIfMissing(result, join(projectDir, 'docs', 'workflow', 'templates', 'verification.md'), governanceTemplateContent('verification.md'))
  writeIfMissing(result, join(projectDir, 'docs', 'workflow', 'templates', 'review.md'), governanceTemplateContent('review.md'))
  writeIfMissing(result, join(projectDir, 'docs', 'workflow', 'templates', 'summary.md'), governanceTemplateContent('summary.md'))
  writeIfMissing(result, join(projectDir, 'docs', 'workflow', 'templates', 'github-actions-scale-preflight.yml'), githubActionsPreflightTemplate())
  writeIfMissing(result, join(projectDir, 'docs', 'workflow', 'templates', 'pre-push-scale-preflight.sh'), prePushPreflightTemplate())
  writeIfMissing(result, join(projectDir, 'docs', 'worklog', 'metrics.md'), metricsTemplate())
  writeIfMissing(result, join(projectDir, '.scale', 'verification.json'), verificationMatrixTemplate(mode))
  writeIfMissing(result, join(projectDir, '.scale', 'skills.json'), skillRoutingPolicyTemplate(mode))

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

function writeIfMissing(result: GovernanceTemplateResult, path: string, content: string): void {
  if (existsSync(path)) {
    result.skipped.push(path)
    return
  }
  const dir = path.split(/[\\/]/).slice(0, -1).join('/')
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(path, content, 'utf-8')
  result.created.push(path)
}

function workflowReadme(projectName: string, mode: GovernanceMode): string {
  return `# ${projectName} Workflow

Governance mode: ${mode}

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

- 

## Current Behavior


## Main Conflict


## Affected Modules


## Evidence


`
}

function miniPrdTemplate(): string {
  return `# Mini-PRD

## Background


## Target Users


## Core Scenario


## Non-Goals


## User Path


## Permission Rules


## Data Impact


## Exception Scenarios

1. 
2. 
3. 

## Acceptance Criteria

- [ ] 

## Rollback Or Disable Strategy


`
}

function skillPlanTemplate(): string {
  return `# Skill Plan

## Detected Intents

| Domain | Score | Evidence |
| --- | ---: | --- |
|  |  |  |

## Required Skills

- 

## Recommended Skills

- 

## Required Artifacts

- 

## Required Verification Evidence

- 

## Skipped Skills

| Skill | Reason | Fallback Evidence |
| --- | --- | --- |
|  |  |  |
`
}

function uiSpecTemplate(): string {
  return `# UI Spec

## User Goal


## Primary Flow


## Interaction States

- Default:
- Loading:
- Empty:
- Error:
- Success:

## Responsive Behavior


## Accessibility Requirements


## Acceptance Criteria

- [ ] 
`
}

function visualReviewTemplate(): string {
  return `# Visual Review

## Screenshots Or Evidence


## Layout And Responsiveness


## Text Fit And Overlap


## Accessibility Notes


## Final Verdict


`
}

function apiContractTemplate(): string {
  return `# API Contract

## Endpoint Or Interface


## Request


## Response


## Errors


## Permission Rules


## Compatibility Notes


## Acceptance Criteria

- [ ] 
`
}

function securityReviewTemplate(): string {
  return `# Security Review

## Assets And Trust Boundaries


## Authorization Rules


## Abuse Cases

1. 
2. 
3. 

## Sensitive Data Impact


## Rollback Or Disable Strategy


## Final Verdict


`
}

function dbChangePlanTemplate(): string {
  return `# DB Change Plan

## Schema Or Data Change


## Backward Compatibility


## Migration Steps


## Rollback Plan


## Verification


`
}

function e2ePlanTemplate(): string {
  return `# E2E Plan

## User Paths


## Browser Coverage


## Test Data


## Assertions


## Evidence


`
}

function planTemplate(): string {
  return `# Plan

## Approach


## Boundaries


## Exception Contract

1. 
2. 
3. 

## Rollback Plan


## Test Strategy


`
}

function verificationTemplate(): string {
  return `# Verification

## Commands Run

| Command | Result | Notes |
| --- | --- | --- |
|  |  |  |

## Output Summary


## Failures And Fixes


## Final Status


`
}

function reviewTemplate(): string {
  return `# Review

## Code Review


## Security Review


## Same-Pattern Scan


## Residual Risks


`
}

function summaryTemplate(): string {
  return `# Summary

## Delivered Changes


## Remaining Risks


## Follow-Ups


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


### Slowest Gates


### Documentation Gaps


### Product Design Misses


### Proposed Workflow Changes


`
}

function verificationMatrixTemplate(mode: GovernanceMode): string {
  return JSON.stringify({
    version: 1,
    defaultProfile: 'default',
    profiles: {
      default: {
        commands: {},
        services: [],
      },
    },
    services: [],
    exclude: ['node_modules', 'dist', 'tmp', 'vendor'],
    policy: {
      mode,
      optionalToolsWarnOnly: true,
      artifactGate: mode === 'critical' ? 'block' : 'warn',
      artifactGateLevels: ['M', 'L', 'CRITICAL'],
    },
  }, null, 2) + '\n'
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
