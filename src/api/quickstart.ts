// SCALE Engine — Quick Start / One-Click Install
// 自动检测平台、配置物理约束、可选安装知识图谱

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
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
    { platform: 'windsurf', paths: [join(projectDir, '.windsurf', 'settings.json'), join(projectDir, '.windsurfrc')] },
    { platform: 'kimi', paths: [join(projectDir, '.kimi', 'settings.json')] },
    { platform: 'doubao', paths: [join(projectDir, '.doubao', 'settings.json')] },
  ]
  for (const check of checks) {
    for (const p of check.paths) if (existsSync(p)) return { platform: check.platform, confidence: 1.0, suggestions: [] }
  }
  return { platform: null, confidence: 0, suggestions: ['claude-code', 'cursor', 'aider', 'windsurf'] }
}

export const PHYSICAL_CONSTRAINTS = [
  { id: 'block-dangerous', severity: 'critical', matcher: 'Bash', command: 'scale guard dangerous' },
  { id: 'block-secrets', severity: 'critical', matcher: 'Edit|Write', command: 'scale guard secrets' },
  { id: 'detect-retry', severity: 'high', matcher: '', command: 'scale guard retry' },
]

export interface KnowledgeGraphResult {
  available: boolean
  pythonVersion?: string
  graphifyInstalled: boolean
  graphifyVersion?: string
  instructions?: string[]
}

export interface QuickStartResult {
  success: boolean
  platform: AgentPlatform | null
  created: string[]
  skipped: string[]
  constraintsApplied: number
  capabilitiesEnabled: string[]
  knowledgeGraph?: KnowledgeGraphResult
  nextSteps: string[]
}

export async function quickStart(projectDir: string = '.', options?: { installKnowledgeGraph?: boolean }): Promise<QuickStartResult> {
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

  // Optional: Install knowledge graph (graphify)
  if (options?.installKnowledgeGraph) {
    result.knowledgeGraph = await installKnowledgeGraph()
    if (result.knowledgeGraph.available) {
      result.nextSteps.push('scale graphify .  # Build code knowledge graph')
    }
  } else {
    result.knowledgeGraph = checkKnowledgeGraphAvailability()
  }

  result.success = true
  result.nextSteps.push('scale doctor')
  result.nextSteps.push('scale create Spec "<feature>"')
  return result
}

/**
 * Check if Python and graphify are available (without installing)
 */
export function checkKnowledgeGraphAvailability(): KnowledgeGraphResult {
  const result: KnowledgeGraphResult = { available: false, graphifyInstalled: false }

  // Check Python
  try {
    const version = execSync('python3 --version', { encoding: 'utf-8', timeout: 5000 }).trim()
    result.pythonVersion = version
  } catch {
    try {
      const version = execSync('python --version', { encoding: 'utf-8', timeout: 5000 }).trim()
      result.pythonVersion = version
    } catch {
      result.instructions = ['Install Python 3.8+: https://python.org/downloads']
      return result
    }
  }

  // Check graphify
  try {
    const info = execSync('pip show graphifyy', { encoding: 'utf-8', timeout: 5000 })
    const match = info.match(/Version: (\S+)/)
    result.graphifyInstalled = true
    result.graphifyVersion = match?.[1] ?? 'unknown'
    result.available = true
  } catch {
    try {
      execSync('pip3 show graphifyy', { encoding: 'utf-8', timeout: 5000 })
      result.graphifyInstalled = true
      result.available = true
    } catch {
      result.instructions = [
        'pip install graphifyy',
        'graphify install',
      ]
    }
  }

  return result
}

/**
 * Attempt to install graphify (requires Python already installed)
 */
export async function installKnowledgeGraph(): Promise<KnowledgeGraphResult> {
  const result = checkKnowledgeGraphAvailability()

  if (!result.pythonVersion) {
    return result // Python not installed, can't proceed
  }

  if (!result.graphifyInstalled) {
    try {
      // Try pip install
      execSync('pip install graphifyy', { encoding: 'utf-8', timeout: 60000 })
      result.graphifyInstalled = true
      result.graphifyVersion = 'latest'
    } catch {
      try {
        execSync('pip3 install graphifyy', { encoding: 'utf-8', timeout: 60000 })
        result.graphifyInstalled = true
        result.graphifyVersion = 'latest'
      } catch {
        result.instructions = [
          'Manual install required:',
          'pip install graphifyy',
          'graphify install',
        ]
        return result
      }
    }

    // Try graphify install
    try {
      execSync('graphify install', { encoding: 'utf-8', timeout: 30000 })
    } catch {
      // Non-blocking - user can run manually
      result.instructions?.push('graphify install  # Initialize graphify')
    }
  }

  result.available = result.graphifyInstalled
  return result
}
