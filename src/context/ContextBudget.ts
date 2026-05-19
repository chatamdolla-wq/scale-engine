import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'

export type ContextBudgetCategory = 'always' | 'on-demand' | 'evidence' | 'archive' | 'generated'

export interface ContextBudgetEntry {
  path: string
  category: ContextBudgetCategory
  bytes: number
  estimatedTokens: number
  reason: string
}

export interface ContextBudgetSummary {
  totalFiles: number
  totalTokens: number
  byCategory: Record<ContextBudgetCategory, { files: number; tokens: number }>
  alwaysTokens: number
  onDemandTokens: number
}

export interface ContextBudgetReport {
  projectDir: string
  scaleDir: string
  generatedAt: string
  thresholds: {
    maxAlwaysTokens: number
    maxTaskTokens: number
  }
  entries: ContextBudgetEntry[]
  summary: ContextBudgetSummary
  recommendations: string[]
}

export interface ContextPackSection {
  id: string
  category: ContextBudgetCategory
  included: boolean
  estimatedTokens: number
  reason: string
  paths: string[]
}

export interface ContextPack {
  task: {
    taskId?: string
    task: string
    level: string
    files: string[]
    budget: number
  }
  generatedAt: string
  totalEstimatedTokens: number
  lazyLoaded: Array<{ id: string; reason: string }>
  omitted: Array<{ id: string; reason: string; estimatedTokens: number }>
  sections: ContextPackSection[]
}

export interface ContextBudgetDoctorReport {
  ok: boolean
  checks: Array<{ name: string; status: 'pass' | 'warn' | 'fail'; message: string }>
  report: ContextBudgetReport
}

const CATEGORIES: ContextBudgetCategory[] = ['always', 'on-demand', 'evidence', 'archive', 'generated']

const DEFAULT_MAX_ALWAYS_TOKENS = 2500
const DEFAULT_MAX_TASK_TOKENS = 8000

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  'tmp',
  '.worktrees',
])

const SCANNED_EXTENSIONS = new Set(['.md', '.json', '.yml', '.yaml', '.html', '.txt'])

export interface ContextBudgetOptions {
  projectDir?: string
  scaleDir?: string
  maxAlwaysTokens?: number
  maxTaskTokens?: number
}

export interface ContextPackOptions extends ContextBudgetOptions {
  taskId?: string
  task: string
  level?: string
  files?: string[]
  budget?: number
}

export function estimateTokens(content: string): number {
  if (content.length === 0) return 0
  return Math.max(1, Math.ceil(content.length / 4))
}

export function scanContextBudget(options: ContextBudgetOptions = {}): ContextBudgetReport {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const scaleDir = options.scaleDir ?? '.scale'
  const scaleRoot = resolveScaleRoot(projectDir, scaleDir)
  const entries = discoverContextFiles(projectDir, scaleDir)
    .map(file => contextEntry(projectDir, scaleRoot, file))
    .sort((a, b) => categoryIndex(a.category) - categoryIndex(b.category) || b.estimatedTokens - a.estimatedTokens)

  const summary = summarize(entries)
  const thresholds = {
    maxAlwaysTokens: options.maxAlwaysTokens ?? DEFAULT_MAX_ALWAYS_TOKENS,
    maxTaskTokens: options.maxTaskTokens ?? DEFAULT_MAX_TASK_TOKENS,
  }

  return {
    projectDir,
    scaleDir,
    generatedAt: new Date().toISOString(),
    thresholds,
    entries,
    summary,
    recommendations: recommendations(summary, thresholds, entries),
  }
}

export function writeContextBudgetReport(report: ContextBudgetReport): string {
  const scaleRoot = resolveScaleRoot(report.projectDir, report.scaleDir)
  mkdirSync(scaleRoot, { recursive: true })
  const target = join(scaleRoot, 'context-budget.json')
  writeFileSync(target, JSON.stringify(report, null, 2), 'utf-8')
  return target
}

export function doctorContextBudget(options: ContextBudgetOptions = {}): ContextBudgetDoctorReport {
  const report = scanContextBudget(options)
  const checks: ContextBudgetDoctorReport['checks'] = []
  checks.push({
    name: 'Always-loaded context',
    status: report.summary.alwaysTokens <= report.thresholds.maxAlwaysTokens ? 'pass' : 'fail',
    message: `Always-loaded context is ${report.summary.alwaysTokens} tokens; limit is ${report.thresholds.maxAlwaysTokens}.`,
  })
  checks.push({
    name: 'Task context budget',
    status: report.summary.totalTokens <= report.thresholds.maxTaskTokens ? 'pass' : 'warn',
    message: `Scanned context is ${report.summary.totalTokens} tokens; task pack limit is ${report.thresholds.maxTaskTokens}.`,
  })
  checks.push({
    name: 'Generated artifacts',
    status: report.summary.byCategory.generated.files > 0 ? 'warn' : 'pass',
    message: report.summary.byCategory.generated.files > 0
      ? `${report.summary.byCategory.generated.files} generated artifacts should stay manifest-only unless explicitly requested.`
      : 'No generated context artifacts detected.',
  })
  return {
    ok: checks.every(check => check.status !== 'fail'),
    checks,
    report,
  }
}

export function buildContextPack(options: ContextPackOptions): ContextPack {
  const budget = options.budget ?? DEFAULT_MAX_TASK_TOKENS
  const report = scanContextBudget({ ...options, maxTaskTokens: budget })
  const task = options.task
  const files = options.files ?? []
  const activations = activationRules(task, files, options.level ?? 'M')
  const sections: ContextPackSection[] = []

  const alwaysEntries = report.entries.filter(entry => entry.category === 'always')
  sections.push(section('always-core', 'always', true, 'Core agent entry rules and governance policy.', alwaysEntries))

  for (const activation of activations) {
    const activatedEntries = report.entries.filter(entry => activation.matches(entry))
    if (activatedEntries.length === 0) {
      sections.push({
        id: activation.id,
        category: activation.category,
        included: false,
        estimatedTokens: 0,
        reason: `${activation.reason}; no matching artifacts found.`,
        paths: [],
      })
      continue
    }
    sections.push(section(activation.id, activation.category, true, activation.reason, activatedEntries))
  }

  const unique = dedupeSections(sections)
  let total = 0
  const packed: ContextPackSection[] = []
  const omitted: ContextPack['omitted'] = []
  for (const item of unique) {
    if (item.included && total + item.estimatedTokens > budget) {
      packed.push({ ...item, included: false, reason: `${item.reason} Omitted because it would exceed budget ${budget}.` })
      omitted.push({ id: item.id, reason: 'budget-exceeded', estimatedTokens: item.estimatedTokens })
      continue
    }
    if (item.included) total += item.estimatedTokens
    packed.push(item)
  }

  return {
    task: {
      taskId: options.taskId,
      task,
      level: options.level ?? 'M',
      files,
      budget,
    },
    generatedAt: new Date().toISOString(),
    totalEstimatedTokens: total,
    lazyLoaded: packed
      .filter(item => item.included && item.id !== 'always-core')
      .map(item => ({ id: item.id, reason: item.reason })),
    omitted,
    sections: packed,
  }
}

function discoverContextFiles(projectDir: string, scaleDir: string): string[] {
  const files: string[] = []
  const scaleRoot = resolveScaleRoot(projectDir, scaleDir)
  const roots = [projectDir, join(projectDir, 'docs'), scaleRoot]
  for (const root of roots) {
    const absolute = root
    if (!existsSync(absolute)) continue
    if (statSync(absolute).isFile()) {
      files.push(absolute)
      continue
    }
    walk(absolute, projectDir, files)
  }
  return Array.from(new Set(files))
}

function walk(dir: string, projectDir: string, files: string[]) {
  const rel = normalizePath(relative(projectDir, dir))
  const base = rel.split('/').pop() ?? ''
  if (IGNORED_DIRS.has(base)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) walk(absolute, projectDir, files)
      continue
    }
    if (!entry.isFile()) continue
    const ext = extname(entry.name).toLowerCase()
    const relativePath = normalizePath(relative(projectDir, absolute))
    if (SCANNED_EXTENSIONS.has(ext) || ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.cursorrules'].includes(relativePath)) {
      files.push(absolute)
    }
  }
}

function contextEntry(projectDir: string, scaleRoot: string, file: string): ContextBudgetEntry {
  const content = safeRead(file)
  const path = logicalContextPath(projectDir, scaleRoot, file)
  const classification = classifyContextPath(path)
  return {
    path,
    category: classification.category,
    bytes: Buffer.byteLength(content, 'utf-8'),
    estimatedTokens: estimateTokens(content),
    reason: classification.reason,
  }
}

export function classifyContextPath(path: string): { category: ContextBudgetCategory; reason: string } {
  const normalized = normalizePath(path)
  const lower = normalized.toLowerCase()
  if (['agents.md', 'claude.md', 'gemini.md', '.cursorrules'].includes(lower)) {
    return { category: 'always', reason: 'agent entrypoint loaded at session start' }
  }
  if (/^\.scale\/(verification|skills|workflow|resource-policy|tool-policy|workspace|context-budget)\.json$/i.test(normalized)) {
    return { category: 'always', reason: 'governance source-of-truth configuration' }
  }
  if (lower.includes('/evidence/') || lower.includes('/events/') || lower.startsWith('docs/worklog/tasks/')) {
    return { category: 'evidence', reason: 'task or runtime evidence should be summarized and referenced' }
  }
  if (lower.endsWith('.html') || lower.includes('graphify-out/') || lower.includes('/resource-reports/')) {
    return { category: 'generated', reason: 'generated artifact should stay manifest-only by default' }
  }
  if (lower.startsWith('docs/plans/') || lower.startsWith('docs/superpowers/') || lower.includes('roadmap') || lower.includes('optimization_plan') || lower.includes('changelog')) {
    return { category: 'archive', reason: 'planning or historical context should be loaded only when requested' }
  }
  if (lower.includes('memory') || lower.includes('skill') || lower.includes('tool') || lower.includes('runtime') || lower.includes('resource')) {
    return { category: 'on-demand', reason: 'domain-specific governance context loaded by trigger' }
  }
  return { category: 'on-demand', reason: 'project documentation loaded by task relevance' }
}

function summarize(entries: ContextBudgetEntry[]): ContextBudgetSummary {
  const byCategory = Object.fromEntries(CATEGORIES.map(category => [category, { files: 0, tokens: 0 }])) as ContextBudgetSummary['byCategory']
  for (const entry of entries) {
    byCategory[entry.category].files += 1
    byCategory[entry.category].tokens += entry.estimatedTokens
  }
  return {
    totalFiles: entries.length,
    totalTokens: entries.reduce((sum, entry) => sum + entry.estimatedTokens, 0),
    byCategory,
    alwaysTokens: byCategory.always.tokens,
    onDemandTokens: byCategory['on-demand'].tokens,
  }
}

function recommendations(summary: ContextBudgetSummary, thresholds: ContextBudgetReport['thresholds'], entries: ContextBudgetEntry[]): string[] {
  const output: string[] = []
  if (summary.alwaysTokens > thresholds.maxAlwaysTokens) {
    output.push(`Reduce Always-loaded context from ${summary.alwaysTokens} to <= ${thresholds.maxAlwaysTokens} tokens.`)
  }
  const largest = entries.slice().sort((a, b) => b.estimatedTokens - a.estimatedTokens).slice(0, 3)
  for (const entry of largest) {
    if (entry.estimatedTokens > 1000 && entry.category !== 'archive') {
      output.push(`Consider summarizing or demoting ${entry.path} (${entry.estimatedTokens} tokens).`)
    }
  }
  if (summary.byCategory.generated.files > 0) {
    output.push('Keep generated artifacts out of prompt context; load their manifests or summaries instead.')
  }
  return output
}

type ActivationRule = {
  id: string
  category: ContextBudgetCategory
  reason: string
  matches: (entry: ContextBudgetEntry) => boolean
}

function activationRules(task: string, files: string[], level: string): ActivationRule[] {
  const haystack = `${task} ${files.join(' ')} ${level}`.toLowerCase()
  const rules: ActivationRule[] = [
    {
      id: 'runtime-evidence',
      category: 'evidence',
      reason: 'Evidence is needed for completion and verification claims.',
      matches: entry => entry.category === 'evidence',
    },
  ]
  if (/skill|mcp|cli|browser|desktop|e2e|ui|ux|frontend/.test(haystack)) {
    rules.push({
      id: 'tool-and-skill-governance',
      category: 'on-demand',
      reason: 'Task mentions tool, skill, browser, desktop, E2E, or UI work.',
      matches: entry => entry.category === 'on-demand' && /skill|tool|runtime|resource|engineering/i.test(entry.path),
    })
  }
  if (/memory|knowledge|learn|contradiction|resume/.test(haystack)) {
    rules.push({
      id: 'memory-governance',
      category: 'on-demand',
      reason: 'Task needs project memory, knowledge recall, or contradiction handling.',
      matches: entry => entry.category === 'on-demand' && /memory|knowledge/i.test(entry.path),
    })
  }
  if (/plan|roadmap|architecture|review|critical|release/.test(haystack) || level.toUpperCase() === 'L' || level.toUpperCase() === 'CRITICAL') {
    rules.push({
      id: 'planning-archive',
      category: 'archive',
      reason: 'Task is high level or critical; archived plans may be relevant but remain budgeted.',
      matches: entry => entry.category === 'archive',
    })
  }
  return rules
}

function section(id: string, category: ContextBudgetCategory, included: boolean, reason: string, entries: ContextBudgetEntry[]): ContextPackSection {
  return {
    id,
    category,
    included,
    estimatedTokens: entries.reduce((sum, entry) => sum + entry.estimatedTokens, 0),
    reason,
    paths: entries.map(entry => entry.path),
  }
}

function dedupeSections(sections: ContextPackSection[]): ContextPackSection[] {
  const seenPaths = new Set<string>()
  return sections.map(section => {
    const paths = section.paths.filter(path => {
      if (seenPaths.has(path)) return false
      seenPaths.add(path)
      return true
    })
    return {
      ...section,
      paths,
      estimatedTokens: paths.length === section.paths.length ? section.estimatedTokens : Math.ceil(section.estimatedTokens * (paths.length / Math.max(1, section.paths.length))),
    }
  }).filter(section => section.paths.length > 0 || section.id !== 'always-core')
}

function categoryIndex(category: ContextBudgetCategory): number {
  return CATEGORIES.indexOf(category)
}

function safeRead(path: string): string {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return ''
  }
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function resolveScaleRoot(projectDir: string, scaleDir: string): string {
  return isAbsolute(scaleDir) ? scaleDir : resolve(projectDir, scaleDir)
}

function logicalContextPath(projectDir: string, scaleRoot: string, file: string): string {
  if (isWithin(projectDir, file)) return normalizePath(relative(projectDir, file))
  if (isWithin(scaleRoot, file)) return normalizePath(join('.scale', relative(scaleRoot, file)))
  return normalizePath(file)
}

function isWithin(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel === '' || (!!rel && !rel.startsWith('..') && !isAbsolute(rel))
}
