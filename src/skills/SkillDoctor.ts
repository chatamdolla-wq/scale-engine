import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { WORKFLOW_AGENT_SKILL_CATALOG } from './SkillCatalog.js'
import type { WorkflowSkillCatalogEntry } from './SkillCatalog.js'

export interface SkillDoctorOptions {
  projectDir?: string
  homeDir?: string
}

export interface SkillDoctorEntry {
  id: string
  name: string
  description: string
  source: string
  installCommand: string
  trust: WorkflowSkillCatalogEntry['trust']
  executionType: string
  declaredPath?: string
  checkedPaths: string[]
  installed: boolean
  detectedPath?: string
  status: 'installed' | 'missing'
  missingReason?: string
}

export interface SkillDoctorReport {
  ok: boolean
  total: number
  installed: number
  missing: number
  skills: SkillDoctorEntry[]
}

export interface RequiredSkillInstallationReport {
  ok: boolean
  required: string[]
  installed: string[]
  missing: string[]
  unknown: string[]
  skills: SkillDoctorEntry[]
}

export function inspectWorkflowSkills(options: SkillDoctorOptions = {}): SkillDoctorReport {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const homeDir = options.homeDir ?? homedir()
  const skills = WORKFLOW_AGENT_SKILL_CATALOG.map(entry => inspectWorkflowSkill(entry, projectDir, homeDir))
  const installed = skills.filter(skill => skill.installed).length
  const missing = skills.length - installed
  return {
    ok: missing === 0,
    total: skills.length,
    installed,
    missing,
    skills,
  }
}

export function inspectRequiredWorkflowSkills(requiredSkills: string[], options: SkillDoctorOptions = {}): RequiredSkillInstallationReport {
  const required = unique(requiredSkills.map(skill => skill.trim()).filter(Boolean))
  const report = inspectWorkflowSkills(options)
  const byId = new Map(report.skills.map(skill => [skill.id, skill]))
  const installed: string[] = []
  const missing: string[] = []
  const unknown: string[] = []
  const skills: SkillDoctorEntry[] = []

  for (const id of required) {
    const skill = byId.get(id)
    if (!skill) {
      unknown.push(id)
      missing.push(id)
      continue
    }
    skills.push(skill)
    if (skill.installed) installed.push(id)
    else missing.push(id)
  }

  return {
    ok: missing.length === 0,
    required,
    installed,
    missing,
    unknown,
    skills,
  }
}

function inspectWorkflowSkill(entry: WorkflowSkillCatalogEntry, projectDir: string, homeDir: string): SkillDoctorEntry {
  const declaredPath = entry.definition.execution.config.skillPath
  const checkedPaths = unique([
    declaredPath ? resolveSkillPath(declaredPath, projectDir, homeDir) : undefined,
    join(homeDir, '.agents', 'skills', entry.id, 'SKILL.md'),
    join(homeDir, '.codex', 'skills', entry.id, 'SKILL.md'),
    join(homeDir, '.claude', 'skills', entry.id, 'SKILL.md'),
    join(homeDir, '.gemini', 'skills', entry.id, 'SKILL.md'),
    join(homeDir, '.omx', 'skills', entry.id, 'SKILL.md'),
    join(projectDir, 'skills', entry.id, 'SKILL.md'),
    join(projectDir, '.scale', 'skills', entry.id, 'SKILL.md'),
  ].filter((path): path is string => Boolean(path)))

  const detectedPath = checkedPaths.find(path => existsSync(path))
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    source: entry.source,
    installCommand: entry.installCommand,
    trust: entry.trust,
    executionType: entry.definition.execution.type,
    declaredPath,
    checkedPaths,
    installed: Boolean(detectedPath),
    detectedPath,
    status: detectedPath ? 'installed' : 'missing',
    missingReason: detectedPath ? undefined : 'Skill file not found in declared or fallback paths.',
  }
}

function resolveSkillPath(path: string, projectDir: string, homeDir: string): string {
  if (path === '~') return homeDir
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(homeDir, path.slice(2))
  if (isAbsolute(path)) return path
  return resolve(projectDir, path)
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}
