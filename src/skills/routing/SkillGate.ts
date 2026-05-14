import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import type { SkillGateResult, SkillPlan, SkillRoutingMode, SkillTaskLevel } from './SkillRoutingTypes.js'

export interface EvaluateSkillGateOptions {
  projectDir?: string
  artifactsDir?: string
  level: SkillTaskLevel
  plan?: Pick<SkillPlan, 'mode' | 'required' | 'requiredArtifacts'> | null
  requiredArtifacts?: string[]
  mode?: SkillRoutingMode
  enforceLevels?: SkillTaskLevel[]
}

export function evaluateSkillGate(options: EvaluateSkillGateOptions): SkillGateResult {
  const mode = options.mode ?? options.plan?.mode ?? 'warn'
  const enforceLevels = options.enforceLevels ?? ['M', 'L', 'CRITICAL']
  const applies = mode !== 'off' && enforceLevels.includes(options.level)
  const required = unique([
    ...(options.plan?.required ? ['skill-plan.md'] : []),
    ...(options.plan?.requiredArtifacts ?? []),
    ...(options.requiredArtifacts ?? []),
  ])
  if (!applies) {
    return { mode, applies, checked: false, complete: true, blocked: false, required: [], missing: [], incomplete: [], warnings: [] }
  }

  if (!options.artifactsDir) {
    return {
      mode,
      applies,
      checked: true,
      complete: required.length === 0,
      blocked: mode === 'block' && required.length > 0,
      required,
      missing: required,
      incomplete: [],
      warnings: ['No task artifact directory available for skill gate.'],
    }
  }

  const projectDir = resolve(options.projectDir ?? process.cwd())
  const dir = isAbsolute(options.artifactsDir) ? options.artifactsDir : resolve(projectDir, options.artifactsDir)
  const missing: string[] = []
  const incomplete: Array<{ file: string; reason: string }> = []

  for (const artifact of required) {
    const path = join(dir, artifact)
    if (!existsSync(path)) {
      missing.push(artifact)
      continue
    }
    const reason = incompleteReason(artifact, readFileSync(path, 'utf-8'))
    if (reason) incomplete.push({ file: artifact, reason })
  }

  const complete = missing.length === 0 && incomplete.length === 0
  return {
    mode,
    applies,
    checked: true,
    complete,
    blocked: mode === 'block' && !complete,
    required,
    missing,
    incomplete,
    warnings: [],
  }
}

function incompleteReason(file: string, content: string): string | null {
  if (file === 'skill-plan.md' && /## Detected Intents[\s\S]+## Required Skills/i.test(content)) return null
  const substantive = content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => !line.startsWith('#'))
    .filter(line => !line.startsWith('**Task'))
    .filter(line => !line.startsWith('**Level'))
    .filter(line => !line.startsWith('**Mode'))
    .filter(line => !line.startsWith('**Required'))
    .filter(line => !line.startsWith('**Generated'))
    .filter(line => !/^\|?[\s:-]+\|[\s|:-]*$/.test(line))
    .filter(line => !/^\|\s*\|/.test(line))
    .filter(line => !/^[-*]\s*(\[ \])?\s*$/.test(line))
  return substantive.length >= 2 ? null : `contains only template placeholders (${substantive.length}/2 substantive lines)`
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}
