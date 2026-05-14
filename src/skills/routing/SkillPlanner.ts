import type {
  ResolvedSkillRoutingPolicy,
  SkillPlan,
  SkillTaskLevel,
  TaskIntent,
  TaskIntentInput,
} from './SkillRoutingTypes.js'
import { TaskIntentClassifier } from './TaskIntentClassifier.js'

export interface CreateSkillPlanOptions extends TaskIntentInput {
  taskId: string
  taskName: string
  policy: ResolvedSkillRoutingPolicy
}

export function createSkillPlan(options: CreateSkillPlanOptions): SkillPlan {
  const level = options.level ?? 'M'
  const intents = new TaskIntentClassifier(options.policy).classify(options)
  const domainPolicies = intents.map(intent => options.policy.domains[intent.domain]).filter(Boolean)
  const required = options.policy.policy.requireSkillPlan && options.policy.policy.enforceLevels.includes(level)

  const requiredArtifacts = unique([
    ...(required ? ['skill-plan.md'] : []),
    ...domainPolicies.flatMap(policy => policy.requiredArtifacts ?? []),
  ])
  const recommendedArtifacts = unique(domainPolicies.flatMap(policy => policy.recommendedArtifacts ?? []))
  const requiredSkills = unique(domainPolicies.flatMap(policy => policy.requiredSkills ?? []))
  const recommendedSkills = unique(domainPolicies.flatMap(policy => policy.recommendedSkills ?? []))
    .filter(skill => !requiredSkills.includes(skill))
  const requiredVerification = unique(domainPolicies.flatMap(policy => policy.requiredVerification ?? []))

  return {
    taskId: options.taskId,
    taskName: options.taskName,
    level,
    intents,
    requiredSkills,
    recommendedSkills,
    requiredArtifacts,
    recommendedArtifacts,
    requiredVerification,
    mode: resolvePlanMode(level, intents, options.policy),
    required,
    generatedAt: new Date().toISOString(),
  }
}

export function skillPlanMarkdown(plan: SkillPlan): string {
  const intentRows = plan.intents.length
    ? plan.intents.map(intent => `| ${intent.domain} | ${intent.score} | ${intent.reasons.join(', ')} |`).join('\n')
    : '| none | 0 | no domain-specific intent detected |'

  return `# Skill Plan

**Task ID**: ${plan.taskId}
**Task**: ${plan.taskName}
**Level**: ${plan.level}
**Mode**: ${plan.mode}
**Required**: ${plan.required ? 'yes' : 'no'}
**Generated**: ${plan.generatedAt}

## Detected Intents

| Domain | Score | Evidence |
| --- | ---: | --- |
${intentRows}

## Required Skills

${list(plan.requiredSkills)}

## Recommended Skills

${list(plan.recommendedSkills)}

## Required Artifacts

${list(plan.requiredArtifacts)}

## Recommended Artifacts

${list(plan.recommendedArtifacts)}

## Required Verification Evidence

${list(plan.requiredVerification)}

## Skipped Skills

| Skill | Reason | Fallback Evidence |
| --- | --- | --- |
|  |  |  |
`
}

function resolvePlanMode(level: SkillTaskLevel, intents: TaskIntent[], policy: ResolvedSkillRoutingPolicy): 'off' | 'warn' | 'block' {
  if (policy.policy.mode === 'off') return 'off'
  if (policy.policy.mode === 'block') return 'block'
  const hasBlockingIntent = intents.some(intent => policy.domains[intent.domain]?.blockLevels?.includes(level))
  return hasBlockingIntent ? 'block' : 'warn'
}

function list(items: string[]): string {
  return items.length ? items.map(item => `- ${item}`).join('\n') : '- none'
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}
