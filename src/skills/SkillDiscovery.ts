// SCALE Engine — Skill Discovery
// 检测平台 → 扫描技能目录 → 生成 skills.md
// 设计参考：SCALE v10.0 技能生态系统

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { AgentPlatform, SkillRef, SkillScanResult } from '../artifact/types.js'

// ============================================================================
// Platform Skills Directory Map
// ============================================================================

const PLATFORM_SKILLS_DIRS: Record<AgentPlatform, string | null> = {
  'claude-code': null, // Claude Code uses .claude/commands/, no dedicated skills dir
  'codex': null,       // Codex uses .codex/commands/
  'opencode': join(homedir(), '.config', 'opencode', 'skills'),
  'cursor': join('.cursor', 'skills'),
  'gemini': null,      // Gemini has no skills directory concept
  'openclaw': null,    // OpenClaw has no skills directory concept
  'hermes': null,      // Hermes has no skills directory concept
  'trae': null,        // Trae has no skills directory concept
  'workbuddy': null,   // WorkBuddy has no skills directory concept
  'vsc': null,         // VSC has no skills directory concept
  'qcoder': null,      // QCoder has no skills directory concept
}

// ============================================================================
// SkillDiscovery
// ============================================================================

export class SkillDiscovery {
  private projectDir: string

  constructor(projectDir: string = '.') {
    this.projectDir = projectDir
  }

  /**
   * Detect the active agent platform based on config files present in the project.
   * Returns the most likely platform, or null if indeterminate.
   */
  detectPlatform(): AgentPlatform | null {
    const checks: Array<{ platform: AgentPlatform; paths: string[] }> = [
      { platform: 'claude-code', paths: [join(this.projectDir, '.claude', 'settings.json')] },
      { platform: 'codex', paths: [join(this.projectDir, '.codex', 'hooks.json')] },
      { platform: 'opencode', paths: [join(homedir(), '.config', 'opencode', 'hooks.json')] },
      { platform: 'cursor', paths: [join(this.projectDir, '.cursor', 'settings.json')] },
      { platform: 'gemini', paths: [join(this.projectDir, '.gemini', 'settings.json')] },
      { platform: 'openclaw', paths: [join(this.projectDir, '.openclaw', 'settings.json')] },
      { platform: 'hermes', paths: [join(this.projectDir, '.hermes', 'settings.json')] },
      { platform: 'trae', paths: [join(this.projectDir, '.trae', 'settings.json')] },
      { platform: 'workbuddy', paths: [join(this.projectDir, '.workbuddy', 'settings.json')] },
      { platform: 'vsc', paths: [join(this.projectDir, '.vscode', 'scale.json')] },
      { platform: 'qcoder', paths: [join(this.projectDir, '.qwen', 'settings.json')] },
    ]

    for (const check of checks) {
      if (check.paths.some((p) => existsSync(p))) {
        return check.platform
      }
    }

    return null
  }

  /**
   * Scan the skills directory for a given platform.
   * Returns structured skill references.
   */
  scanSkills(platform: AgentPlatform): SkillScanResult {
    const skillsDir = PLATFORM_SKILLS_DIRS[platform]
    if (!skillsDir) {
      return {
        platform,
        skillsDir: '',
        skills: [],
        exists: false,
      }
    }

    const resolvedDir = platform === 'opencode'
      ? skillsDir
      : join(this.projectDir, skillsDir)

    if (!existsSync(resolvedDir)) {
      return {
        platform,
        skillsDir: resolvedDir,
        skills: [],
        exists: false,
      }
    }

    const skills: SkillRef[] = []

    try {
      const entries = readdirSync(resolvedDir)
      for (const entry of entries) {
        const entryPath = join(resolvedDir, entry)
        const stat = statSync(entryPath)

        if (stat.isFile() && (entry.endsWith('.md') || entry.endsWith('.json') || entry.endsWith('.yaml') || entry.endsWith('.yml'))) {
          const name = entry.replace(/\.(md|json|ya?ml)$/, '')
          let description = ''

          // Try to extract description from file content
          try {
            const content = readFileSync(entryPath, 'utf-8')
            // Extract first line as description for .md files
            if (entry.endsWith('.md')) {
              const firstLine = content.split('\n').find((l) => l.trim().length > 0) ?? ''
              description = firstLine.replace(/^#+\s*/, '').trim()
            } else if (entry.endsWith('.json')) {
              const parsed = JSON.parse(content)
              description = parsed.description ?? parsed.name ?? ''
            }
          } catch {
            description = ''
          }

          skills.push({
            id: `${platform}-${name}`,
            name,
            description,
            platform,
            path: entryPath,
            enabled: true,
          })
        } else if (stat.isDirectory()) {
          // Directory-based skills
          skills.push({
            id: `${platform}-${entry}`,
            name: entry,
            description: '',
            platform,
            path: entryPath,
            enabled: true,
          })
        }
      }
    } catch {
      // Permission or read error
    }

    return {
      platform,
      skillsDir: resolvedDir,
      skills,
      exists: true,
    }
  }

  /**
   * Generate a skills.md document from discovered skills.
   * Useful for injecting into agent knowledge docs.
   */
  generateSkillsMd(skills: SkillRef[]): string {
    if (skills.length === 0) {
      return '## Available Skills\n\nNo skills discovered.\n'
    }

    const grouped = new Map<AgentPlatform, SkillRef[]>()
    for (const skill of skills) {
      const group = grouped.get(skill.platform) ?? []
      group.push(skill)
      grouped.set(skill.platform, group)
    }

    const sections: string[] = ['## Available Skills\n']

    for (const [platform, platformSkills] of grouped) {
      sections.push(`### ${platform}`)
      sections.push('')
      for (const skill of platformSkills) {
        const desc = skill.description ? ` — ${skill.description}` : ''
        const status = skill.enabled ? '✅' : '❌'
        sections.push(`- ${status} **${skill.name}**${desc}`)
      }
      sections.push('')
    }

    return sections.join('\n')
  }

  /**
   * Full discovery pipeline: detect platform → scan → generate doc.
   */
  discover(): { platform: AgentPlatform | null; skills: SkillRef[]; skillsMd: string } {
    const platform = this.detectPlatform()
    let skills: SkillRef[] = []

    if (platform) {
      const result = this.scanSkills(platform)
      skills = result.skills
    }

    const skillsMd = this.generateSkillsMd(skills)

    return { platform, skills, skillsMd }
  }
}
