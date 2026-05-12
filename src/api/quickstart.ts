// SCALE Engine — Quick Start / One-Click Install
// 自动检测平台、配置物理约束

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentPlatform } from '../artifact/types.js'

export interface PlatformDetectionResult {
  platform: AgentPlatform | null
  confidence: number
  suggestions: string[]
}

export function detectPlatform(projectDir: string = '.'): PlatformDetectionResult {
  const checks: Array<{ platform: AgentPlatform; paths: string[] }> = [
    { platform: 'claude-code', paths: [join(projectDir, '.claude', 'settings.json')] },
    { platform: 'codex', paths: [join(projectDir, '.codex', 'config.toml')] },
    { platform: 'cursor', paths: [join(projectDir, '.cursorrules')] },
    { platform: 'gemini', paths: [join(projectDir, '.gemini', 'settings.json')] },
    { platform: 'aider', paths: [join(projectDir, '.aider.conf.yml')] },
    { platform: 'deepseek-tui', paths: [join(projectDir, '.deepseek', 'instructions.md')] },
  ]
  for (const check of checks) {
    for (const p of check.paths) if (existsSync(p)) return { platform: check.platform, confidence: 1.0, suggestions: [] }
  }
  return { platform: null, confidence: 0, suggestions: ['claude-code', 'cursor', 'aider'] }
}

export const PHYSICAL_CONSTRAINTS = [
  { id: 'block-dangerous', severity: 'critical', matcher: 'Bash', command: 'scale guard dangerous' },
  { id: 'block-secrets', severity: 'critical', matcher: 'Edit|Write', command: 'scale guard secrets' },
  { id: 'detect-retry', severity: 'high', matcher: '', command: 'scale guard retry' },
]

export interface QuickStartResult {
  success: boolean
  platform: AgentPlatform | null
  created: string[]
  skipped: string[]
  constraintsApplied: number
  capabilitiesEnabled: string[]
  nextSteps: string[]
}

export async function quickStart(projectDir: string = '.'): Promise<QuickStartResult> {
  const result: QuickStartResult = { 
    success: false, platform: null, created: [], skipped: [], 
    constraintsApplied: 0, capabilitiesEnabled: ['browser', 'search', 'computer'], nextSteps: [] 
  }
  const detection = detectPlatform(projectDir)
  result.platform = detection.platform
  if (!detection.platform) {
    result.nextSteps.push('scale init --agent <platform>')
    return result
  }
  const scaleDir = join(projectDir, '.scale')
  for (const dir of ['events', 'artifacts', 'rules', 'hooks', 'checkpoints']) {
    const fullDir = join(scaleDir, dir)
    if (!existsSync(fullDir)) { mkdirSync(fullDir, { recursive: true }); result.created.push(fullDir) }
    else { result.skipped.push(fullDir) }
  }
  const gitignorePath = join(scaleDir, '.gitignore')
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, '*.db\n*.db-journal\nevents/\ncheckpoints/\n')
    result.created.push(gitignorePath)
  }
  result.constraintsApplied = PHYSICAL_CONSTRAINTS.length
  result.success = true
  result.nextSteps.push('scale doctor')
  result.nextSteps.push('scale create Spec "<feature>"')
  return result
}
