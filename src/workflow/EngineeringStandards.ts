import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path'

export type EngineeringStandardCategory =
  | 'logging'
  | 'security'
  | 'database'
  | 'architecture'
  | 'code-quality'
  | 'framework'
  | 'testing'
  | 'uiux'

export type EngineeringStandardSeverity = 'info' | 'warn' | 'fail'

export interface EngineeringStandardFinding {
  severity: EngineeringStandardSeverity
  category: EngineeringStandardCategory
  ruleId: string
  path: string
  line?: number
  message: string
  evidence?: string
  fix?: string
}

export interface EngineeringStandardsPolicyFile {
  version?: number
  mode?: 'warn' | 'block'
  sourceDirectories?: string[]
  ignoredDirectories?: string[]
  allowedConsoleDirectories?: string[]
  allowedConsoleFiles?: string[]
  maxFileLines?: number
  logging?: {
    approvedLoggers?: string[]
    sensitiveFields?: string[]
  }
  architecture?: {
    enforceLayering?: boolean
  }
  blockingRules?: string[]
  allowedFindingPatterns?: Array<{
    ruleId: string
    path?: string
    evidencePattern?: string
    messagePattern?: string
    reason?: string
  }>
  baselineFindings?: Array<{
    ruleId: string
    path: string
    line?: number
    reason?: string
  }>
}

export interface ResolvedEngineeringStandardsPolicy {
  version: number
  mode: 'warn' | 'block'
  sourceDirectories: string[]
  ignoredDirectories: string[]
  allowedConsoleDirectories: string[]
  allowedConsoleFiles: string[]
  maxFileLines: number
  logging: {
    approvedLoggers: string[]
    sensitiveFields: string[]
  }
  architecture: {
    enforceLayering: boolean
  }
  blockingRules: string[]
  allowedFindingPatterns: Array<{
    ruleId: string
    path?: string
    evidencePattern?: string
    messagePattern?: string
    reason?: string
  }>
  baselineFindings: Array<{
    ruleId: string
    path: string
    line?: number
    reason?: string
  }>
  warnings: string[]
}

export interface FrameworkImportRule {
  source: string
  severity?: EngineeringStandardSeverity
  reason?: string
  replacement?: string
}

export interface FrameworksCatalogWarning {
  ruleId: 'frameworks-catalog-warning' | 'frameworks-catalog-stale'
  message: string
}

export interface FrameworksCatalogFile {
  version?: number
  lastReviewedAt?: string
  reviewIntervalDays?: number
  bannedImports?: FrameworkImportRule[]
}

export interface ResolvedFrameworksCatalog {
  version: number
  lastReviewedAt?: string
  reviewIntervalDays?: number
  bannedImports: FrameworkImportRule[]
  warnings: FrameworksCatalogWarning[]
}

export interface EngineeringStandardsScanOptions {
  projectDir?: string
  scaleDir?: string
  now?: Date
}

export interface EngineeringStandardsSummary {
  filesScanned: number
  totalFindings: number
  blockingFindings: number
  bySeverity: Record<EngineeringStandardSeverity, number>
  byCategory: Record<EngineeringStandardCategory, number>
}

export interface EngineeringStandardsScanReport {
  projectDir: string
  policyPath: string
  frameworksPath: string
  policy: ResolvedEngineeringStandardsPolicy
  frameworks: ResolvedFrameworksCatalog
  findings: EngineeringStandardFinding[]
  summary: EngineeringStandardsSummary
  warnings: string[]
}

export interface EngineeringStandardsDoctorReport {
  ok: boolean
  projectDir: string
  findings: EngineeringStandardFinding[]
  scan: EngineeringStandardsScanReport
}

export interface EngineeringStandardsSettleOptions extends EngineeringStandardsScanOptions {
  taskId?: string
  artifactsDir?: string
}

export interface EngineeringStandardsSettleReport {
  ok: boolean
  taskId?: string
  standardsImpactPath?: string
  doctor: EngineeringStandardsDoctorReport
}

const DEFAULT_SOURCE_DIRECTORIES = ['src', 'app', 'packages', 'services', 'cmd', 'internal', 'pkg']
const DEFAULT_IGNORED_DIRECTORIES = [
  '.git',
  '.scale',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'test-results',
  'playwright-report',
  'tmp',
  'temp',
  'docs',
  'tests',
  '__tests__',
  'e2e',
]
const DEFAULT_ALLOWED_CONSOLE_DIRECTORIES = ['src/api', 'src/cli', 'scripts']
const DEFAULT_ALLOWED_CONSOLE_FILES = ['src/dashboard/DashboardServer.ts']
const DEFAULT_SENSITIVE_FIELDS = [
  'password',
  'passwd',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'authorization',
  'cookie',
  'apiKey',
  'credential',
  'privateKey',
]
const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.go',
  '.py',
  '.java',
  '.cs',
  '.kt',
  '.php',
  '.rb',
  '.rs',
  '.vue',
  '.svelte',
])

export function engineeringStandardsPolicyPath(projectDir = process.cwd(), scaleDir = '.scale'): string {
  return join(projectDir, scaleDir, 'engineering-standards.json')
}

export function frameworksCatalogPath(projectDir = process.cwd(), scaleDir = '.scale'): string {
  return join(projectDir, scaleDir, 'frameworks.json')
}

export function engineeringStandardsPolicyTemplate(): string {
  return JSON.stringify({
    version: 1,
    mode: 'warn',
    sourceDirectories: DEFAULT_SOURCE_DIRECTORIES,
    ignoredDirectories: DEFAULT_IGNORED_DIRECTORIES,
    allowedConsoleDirectories: DEFAULT_ALLOWED_CONSOLE_DIRECTORIES,
    allowedConsoleFiles: DEFAULT_ALLOWED_CONSOLE_FILES,
    maxFileLines: 500,
    logging: {
      approvedLoggers: ['pino', 'winston', 'zap', 'zerolog', 'logrus', 'slog'],
      sensitiveFields: DEFAULT_SENSITIVE_FIELDS,
    },
    architecture: {
      enforceLayering: true,
    },
    blockingRules: [],
    allowedFindingPatterns: [],
    baselineFindings: [],
  }, null, 2) + '\n'
}

export function frameworksCatalogTemplate(): string {
  return JSON.stringify({
    version: 1,
    lastReviewedAt: '',
    reviewIntervalDays: 90,
    frameworks: [],
    orm: [],
    ui: {
      designSystem: '',
      componentLibrary: '',
      visualReviewRequired: true,
    },
    architecture: {
      layers: ['api', 'service', 'domain', 'repository', 'infrastructure'],
      dependencyRule: 'outer layers depend inward through explicit interfaces',
    },
    bannedImports: [],
  }, null, 2) + '\n'
}

export function loadEngineeringStandardsPolicy(projectDir = process.cwd(), scaleDir = '.scale'): ResolvedEngineeringStandardsPolicy {
  const path = engineeringStandardsPolicyPath(projectDir, scaleDir)
  const warnings: string[] = []
  let parsed: EngineeringStandardsPolicyFile = {}
  if (existsSync(path)) {
    try {
      parsed = JSON.parse(readFileSync(path, 'utf-8')) as EngineeringStandardsPolicyFile
    } catch (error) {
      warnings.push(`Failed to read ${path}: ${(error as Error).message}; using built-in defaults.`)
    }
  } else {
    warnings.push(`No engineering standards policy found at ${path}; using built-in defaults.`)
  }
  return {
    version: typeof parsed.version === 'number' ? parsed.version : 1,
    mode: parsed.mode === 'block' ? 'block' : 'warn',
    sourceDirectories: parsed.sourceDirectories ?? DEFAULT_SOURCE_DIRECTORIES,
    ignoredDirectories: parsed.ignoredDirectories ?? DEFAULT_IGNORED_DIRECTORIES,
    allowedConsoleDirectories: parsed.allowedConsoleDirectories ?? DEFAULT_ALLOWED_CONSOLE_DIRECTORIES,
    allowedConsoleFiles: parsed.allowedConsoleFiles ?? DEFAULT_ALLOWED_CONSOLE_FILES,
    maxFileLines: parsed.maxFileLines ?? 500,
    logging: {
      approvedLoggers: parsed.logging?.approvedLoggers ?? ['pino', 'winston', 'zap', 'zerolog', 'logrus', 'slog'],
      sensitiveFields: parsed.logging?.sensitiveFields ?? DEFAULT_SENSITIVE_FIELDS,
    },
    architecture: {
      enforceLayering: parsed.architecture?.enforceLayering ?? true,
    },
    blockingRules: Array.isArray(parsed.blockingRules)
      ? parsed.blockingRules.filter(ruleId => typeof ruleId === 'string' && ruleId.length > 0)
      : [],
    allowedFindingPatterns: resolveAllowedFindingPatterns(parsed, warnings),
    baselineFindings: Array.isArray(parsed.baselineFindings)
      ? parsed.baselineFindings
        .filter(item => typeof item.ruleId === 'string' && typeof item.path === 'string')
        .map(item => ({
          ...item,
          line: typeof item.line === 'number' ? item.line : undefined,
        }))
      : [],
    warnings,
  }
}

function resolveAllowedFindingPatterns(
  parsed: EngineeringStandardsPolicyFile,
  warnings: string[],
): ResolvedEngineeringStandardsPolicy['allowedFindingPatterns'] {
  if (!Array.isArray(parsed.allowedFindingPatterns)) return []
  const patterns: ResolvedEngineeringStandardsPolicy['allowedFindingPatterns'] = []
  for (const item of parsed.allowedFindingPatterns) {
    if (!item || typeof item !== 'object') continue
    if (typeof item.ruleId !== 'string' || item.ruleId.length === 0) continue
    if (typeof item.evidencePattern !== 'string' && typeof item.messagePattern !== 'string') continue
    const validEvidencePattern = typeof item.evidencePattern !== 'string' || isValidRegex(item.evidencePattern)
    const validMessagePattern = typeof item.messagePattern !== 'string' || isValidRegex(item.messagePattern)
    if (!validEvidencePattern || !validMessagePattern) {
      warnings.push(`Invalid allowedFindingPatterns entry for ${item.ruleId}; regex could not be compiled.`)
      continue
    }
    patterns.push({
      ruleId: item.ruleId,
      path: typeof item.path === 'string' ? item.path : undefined,
      evidencePattern: typeof item.evidencePattern === 'string' ? item.evidencePattern : undefined,
      messagePattern: typeof item.messagePattern === 'string' ? item.messagePattern : undefined,
      reason: typeof item.reason === 'string' ? item.reason : undefined,
    })
  }
  return patterns
}

function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern)
    return true
  } catch {
    return false
  }
}

export function loadFrameworksCatalog(
  projectDir = process.cwd(),
  scaleDir = '.scale',
  now = new Date(),
): ResolvedFrameworksCatalog {
  const path = frameworksCatalogPath(projectDir, scaleDir)
  const warnings: FrameworksCatalogWarning[] = []
  let parsed: FrameworksCatalogFile = {}
  if (existsSync(path)) {
    try {
      parsed = JSON.parse(readFileSync(path, 'utf-8')) as FrameworksCatalogFile
    } catch (error) {
      warnings.push({
        ruleId: 'frameworks-catalog-warning',
        message: `Failed to read ${path}: ${(error as Error).message}; using empty framework catalog.`,
      })
    }
  }
  const lastReviewedAt = typeof parsed.lastReviewedAt === 'string' ? parsed.lastReviewedAt : undefined
  const reviewIntervalDays = typeof parsed.reviewIntervalDays === 'number' ? parsed.reviewIntervalDays : undefined
  if (lastReviewedAt && reviewIntervalDays && isFrameworkCatalogStale(lastReviewedAt, reviewIntervalDays, now)) {
    warnings.push({
      ruleId: 'frameworks-catalog-stale',
      message: `Framework catalog was last reviewed at ${lastReviewedAt}; review interval is ${reviewIntervalDays} days.`,
    })
  }
  return {
    version: typeof parsed.version === 'number' ? parsed.version : 1,
    lastReviewedAt,
    reviewIntervalDays,
    bannedImports: Array.isArray(parsed.bannedImports)
      ? parsed.bannedImports
        .filter(rule => typeof rule.source === 'string' && rule.source.length > 0)
        .map(rule => ({
          source: rule.source,
          severity: rule.severity === 'info' || rule.severity === 'warn' || rule.severity === 'fail'
            ? rule.severity
            : 'fail',
          reason: typeof rule.reason === 'string' ? rule.reason : undefined,
          replacement: typeof rule.replacement === 'string' ? rule.replacement : undefined,
        }))
      : [],
    warnings,
  }
}

export function scanEngineeringStandards(options: EngineeringStandardsScanOptions = {}): EngineeringStandardsScanReport {
  const projectDir = options.projectDir ?? process.cwd()
  const scaleDir = options.scaleDir ?? '.scale'
  const policy = loadEngineeringStandardsPolicy(projectDir, scaleDir)
  const frameworks = loadFrameworksCatalog(projectDir, scaleDir, options.now)
  const files = findSourceFiles(projectDir, policy)
  const findings = files
    .flatMap(file => scanFile(projectDir, file, policy, frameworks))
    .map(finding => applyRuleSeverityPolicy(finding, policy))
    .filter(finding => !isAllowedFindingPattern(finding, policy) && !isBaselineFinding(finding, policy))
  return {
    projectDir,
    policyPath: engineeringStandardsPolicyPath(projectDir, scaleDir),
    frameworksPath: frameworksCatalogPath(projectDir, scaleDir),
    policy,
    frameworks,
    findings,
    summary: summarizeStandards(files.length, findings),
    warnings: [...policy.warnings, ...frameworks.warnings.map(warning => warning.message)],
  }
}

export function doctorEngineeringStandards(options: EngineeringStandardsScanOptions = {}): EngineeringStandardsDoctorReport {
  const scan = scanEngineeringStandards(options)
  const policyWarningFindings: EngineeringStandardFinding[] = scan.policy.warnings.map(message => ({
    severity: 'warn',
    category: 'framework',
    ruleId: 'standards-policy-warning',
    path: scan.policyPath,
    message,
    fix: 'Run scale init or add .scale/engineering-standards.json.',
  }))
  const frameworkWarningFindings: EngineeringStandardFinding[] = scan.frameworks.warnings.map(warning => ({
    severity: 'warn',
    category: 'framework',
    ruleId: warning.ruleId,
    path: scan.frameworksPath,
    message: warning.message,
    fix: 'Fix .scale/frameworks.json or regenerate it with scale init.',
  }))
  const findings = [...policyWarningFindings, ...frameworkWarningFindings, ...scan.findings]
  return {
    ok: !findings.some(finding => finding.severity === 'fail'),
    projectDir: scan.projectDir,
    findings,
    scan: { ...scan, findings },
  }
}

export function settleEngineeringStandards(options: EngineeringStandardsSettleOptions = {}): EngineeringStandardsSettleReport {
  const doctor = doctorEngineeringStandards(options)
  const standardsImpactPath = options.artifactsDir
    ? appendStandardsImpact({
      projectDir: options.projectDir ?? process.cwd(),
      artifactsDir: options.artifactsDir,
      taskId: options.taskId,
      doctor,
    })
    : undefined
  return {
    ok: doctor.ok,
    taskId: options.taskId,
    standardsImpactPath,
    doctor,
  }
}

function scanFile(
  projectDir: string,
  absolutePath: string,
  policy: ResolvedEngineeringStandardsPolicy,
  frameworks: ResolvedFrameworksCatalog,
): EngineeringStandardFinding[] {
  const path = normalizePath(relative(projectDir, absolutePath))
  const content = readFileSync(absolutePath, 'utf-8')
  const lines = content.split(/\r?\n/)
  const findings: EngineeringStandardFinding[] = []

  if (lines.length > policy.maxFileLines) {
    findings.push({
      severity: 'warn',
      category: 'architecture',
      ruleId: 'large-source-file',
      path,
      message: `Source file has ${lines.length} lines, above ${policy.maxFileLines}.`,
      fix: 'Split responsibilities or document why this file is intentionally large.',
    })
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (isNonExecutablePatternLine(line)) continue
    const lineNumber = index + 1
    findings.push(...scanLine(path, line, lineNumber, policy, frameworks))
  }
  findings.push(...findEmptyCatchBlocks(path, lines))
  return dedupeFindings(findings)
}

function scanLine(
  path: string,
  line: string,
  lineNumber: number,
  policy: ResolvedEngineeringStandardsPolicy,
  frameworks: ResolvedFrameworksCatalog,
): EngineeringStandardFinding[] {
  const findings: EngineeringStandardFinding[] = []
  const sensitiveMatcher = sensitiveFieldPattern(policy)
  const evidence = line.trim().slice(0, 160)

  findings.push(...scanBannedImports(path, line, lineNumber, evidence, frameworks))

  if (isHardcodedSecret(line, policy)) {
    findings.push({
      severity: 'fail',
      category: 'security',
      ruleId: 'hardcoded-secret',
      path,
      line: lineNumber,
      message: 'Secret-like value appears to be hardcoded in source.',
      evidence,
      fix: 'Move secrets to approved secret storage or environment configuration and keep placeholders non-sensitive.',
    })
  }

  if ((isLogCall(line) || isAdHocOutputCall(line)) && sensitiveMatcher.test(line)) {
    findings.push({
      severity: 'fail',
      category: 'logging',
      ruleId: 'sensitive-log',
      path,
      line: lineNumber,
      message: 'Sensitive field appears in a log statement.',
      evidence,
      fix: 'Remove the field, mask it, or use an approved redaction helper before logging.',
    })
  } else if (isAdHocOutputCall(line) && !isConsoleAllowed(path, policy)) {
    findings.push({
      severity: 'warn',
      category: 'logging',
      ruleId: 'ad-hoc-console-log',
      path,
      line: lineNumber,
      message: 'Ad-hoc console logging was found outside approved CLI or script paths.',
      evidence,
      fix: 'Use the project logger, remove the debug print, or add an explicit policy exception.',
    })
  }

  if (isRawSqlConstruction(line)) {
    findings.push({
      severity: 'fail',
      category: 'database',
      ruleId: 'raw-sql-construction',
      path,
      line: lineNumber,
      message: 'SQL appears to be constructed with dynamic input.',
      evidence,
      fix: 'Use parameterized queries, ORM bind parameters, or a query builder with placeholders.',
    })
  }

  if (/dangerouslySetInnerHTML|\.innerHTML\s*=|document\.write\s*\(/.test(line)) {
    findings.push({
      severity: 'fail',
      category: 'security',
      ruleId: 'unsafe-html-sink',
      path,
      line: lineNumber,
      message: 'Unsafe HTML sink can create XSS risk.',
      evidence,
      fix: 'Use text rendering or sanitize trusted HTML with an approved sanitizer.',
    })
  }

  if (/\beval\s*\(|new\s+Function\s*\(/.test(line)) {
    findings.push({
      severity: 'fail',
      category: 'security',
      ruleId: 'unsafe-code-execution',
      path,
      line: lineNumber,
      message: 'Dynamic code execution was found.',
      evidence,
      fix: 'Replace eval or Function with a typed parser, dispatch table, or safe interpreter.',
    })
  }

  if (/^\s*(?:\/\/|\/\*)\s*@ts-ignore\b/.test(line)) {
    findings.push({
      severity: 'fail',
      category: 'code-quality',
      ruleId: 'ts-ignore',
      path,
      line: lineNumber,
      message: 'TypeScript errors are suppressed with @ts-ignore.',
      evidence,
      fix: 'Fix the type boundary or use a narrow typed adapter with a documented reason.',
    })
  }

  if (/\bas\s+any\b|:\s*any\b|<any\b|Array<any>|Promise<any>|Record<[^>]+,\s*any>/.test(line)) {
    findings.push({
      severity: 'warn',
      category: 'code-quality',
      ruleId: 'type-escape',
      path,
      line: lineNumber,
      message: 'New any-based type escape weakens interface contracts.',
      evidence,
      fix: 'Model the real type or isolate unknown input at the boundary.',
    })
  }

  if (/Math\.random\s*\(\)/.test(line) && /\b(token|secret|session|password|credential|nonce)\b/i.test(line)) {
    findings.push({
      severity: 'fail',
      category: 'security',
      ruleId: 'weak-random-security-token',
      path,
      line: lineNumber,
      message: 'Math.random is used for security-sensitive data.',
      evidence,
      fix: 'Use a cryptographically secure random source.',
    })
  }

  if (policy.architecture.enforceLayering && isOuterLayerPath(path) && importsInnerPersistence(line)) {
    findings.push({
      severity: 'warn',
      category: 'architecture',
      ruleId: 'layer-boundary-bypass',
      path,
      line: lineNumber,
      message: 'Outer layer appears to import persistence internals directly.',
      evidence,
      fix: 'Route through service/usecase interfaces and keep persistence behind a repository boundary.',
    })
  }

  return findings
}

function findEmptyCatchBlocks(path: string, lines: string[]): EngineeringStandardFinding[] {
  const findings: EngineeringStandardFinding[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (/catch\s*(?:\([^)]*\))?\s*\{\s*(?:\/\*.*?\*\/|\/\/.*)?\s*\}/.test(line)) {
      findings.push(emptyCatchFinding(path, index + 1, line))
      continue
    }
    if (!/catch\s*(?:\([^)]*\))?\s*\{\s*$/.test(line)) continue
    for (const next of lines.slice(index + 1, index + 8)) {
      const trimmed = next.trim()
      if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue
      if (/^}\s*[),;]?$/.test(trimmed)) findings.push(emptyCatchFinding(path, index + 1, line))
      break
    }
  }
  return findings
}

function emptyCatchFinding(path: string, line: number, text: string): EngineeringStandardFinding {
  return {
    severity: 'fail',
    category: 'code-quality',
    ruleId: 'empty-catch',
    path,
    line,
    message: 'Empty or comment-only catch block hides failures.',
    evidence: text.trim().slice(0, 160),
    fix: 'Handle the error, return a typed failure, or log through the approved redacted logger.',
  }
}

function findSourceFiles(projectDir: string, policy: ResolvedEngineeringStandardsPolicy): string[] {
  const files: string[] = []
  for (const sourceDir of policy.sourceDirectories) {
    const absolute = join(projectDir, sourceDir)
    if (!existsSync(absolute)) continue
    walk(absolute, projectDir, policy, files)
  }
  return files
}

function walk(dir: string, projectDir: string, policy: ResolvedEngineeringStandardsPolicy, files: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    const rel = normalizePath(relative(projectDir, fullPath))
    if (entry.isDirectory()) {
      if (policy.ignoredDirectories.some(ignored => rel === normalizePath(ignored) || rel.startsWith(`${normalizePath(ignored)}/`) || entry.name === ignored)) continue
      walk(fullPath, projectDir, policy, files)
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      if (statSync(fullPath).size <= 1024 * 1024) files.push(fullPath)
    }
  }
}

function appendStandardsImpact(options: {
  projectDir: string
  artifactsDir: string
  taskId?: string
  doctor: EngineeringStandardsDoctorReport
}): string {
  const dir = isAbsolute(options.artifactsDir)
    ? options.artifactsDir
    : resolve(options.projectDir, options.artifactsDir)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const path = join(dir, 'standards-impact.md')
  if (!existsSync(path)) writeFileSync(path, '# Standards Impact\n\n', 'utf-8')
  appendFileSync(path, standardsSettlementMarkdown(options.taskId, options.doctor), 'utf-8')
  return path
}

function standardsSettlementMarkdown(taskId: string | undefined, doctor: EngineeringStandardsDoctorReport): string {
  const findings = doctor.findings.length
    ? doctor.findings.map(finding => `| ${finding.severity.toUpperCase()} | ${finding.ruleId} | ${escapeCell(finding.path)} | ${finding.line ?? ''} | ${escapeCell(finding.message)} |`).join('\n')
    : '| OK | no-findings |  |  | No engineering standards findings. |'
  return `
## SCALE Engineering Standards Settlement - ${new Date().toISOString()}

Task: ${taskId ?? 'unspecified'}
Status: ${doctor.ok ? 'passed' : 'blocked'}

| Metric | Value |
| --- | ---: |
| Files scanned | ${doctor.scan.summary.filesScanned} |
| Total findings | ${doctor.scan.summary.totalFindings} |
| Blocking findings | ${doctor.scan.summary.blockingFindings} |

| Severity | Rule | Path | Line | Message |
| --- | --- | --- | ---: | --- |
${findings}
`
}

function summarizeStandards(filesScanned: number, findings: EngineeringStandardFinding[]): EngineeringStandardsSummary {
  const bySeverity = { info: 0, warn: 0, fail: 0 }
  const byCategory = emptyCategorySummary()
  for (const finding of findings) {
    bySeverity[finding.severity] += 1
    byCategory[finding.category] += 1
  }
  return {
    filesScanned,
    totalFindings: findings.length,
    blockingFindings: findings.filter(finding => finding.severity === 'fail').length,
    bySeverity,
    byCategory,
  }
}

function emptyCategorySummary(): Record<EngineeringStandardCategory, number> {
  return {
    logging: 0,
    security: 0,
    database: 0,
    architecture: 0,
    'code-quality': 0,
    framework: 0,
    testing: 0,
    uiux: 0,
  }
}

function applyRuleSeverityPolicy(
  finding: EngineeringStandardFinding,
  policy: ResolvedEngineeringStandardsPolicy,
): EngineeringStandardFinding {
  if (finding.severity === 'fail' || !policy.blockingRules.includes(finding.ruleId)) return finding
  return {
    ...finding,
    severity: 'fail',
    message: `${finding.message} This rule is configured as blocking.`,
  }
}

function scanBannedImports(
  path: string,
  line: string,
  lineNumber: number,
  evidence: string,
  frameworks: ResolvedFrameworksCatalog,
): EngineeringStandardFinding[] {
  if (!/\bimport\b|\brequire\s*\(/.test(line)) return []
  return frameworks.bannedImports
    .filter(rule => importsSource(line, rule.source))
    .map(rule => ({
      severity: rule.severity ?? 'fail',
      category: 'framework',
      ruleId: 'banned-import',
      path,
      line: lineNumber,
      message: `Import from "${rule.source}" violates the framework catalog.${rule.reason ? ` ${rule.reason}` : ''}`,
      evidence,
      fix: rule.replacement
        ? `Use ${rule.replacement} instead.`
        : 'Use the project-approved framework, ORM, component, or boundary from .scale/frameworks.json.',
    }))
}

function importsSource(line: string, source: string): boolean {
  const escaped = escapeRegex(source)
  const sourceBoundary = `(?:['"]|/)`
  return new RegExp(`\\bfrom\\s+['"]${escaped}${sourceBoundary}|\\brequire\\s*\\(\\s*['"]${escaped}${sourceBoundary}`).test(line)
}

function isFrameworkCatalogStale(lastReviewedAt: string, reviewIntervalDays: number, now: Date): boolean {
  const reviewedAt = new Date(`${lastReviewedAt}T00:00:00Z`)
  if (Number.isNaN(reviewedAt.getTime()) || reviewIntervalDays <= 0) return false
  return now.getTime() - reviewedAt.getTime() > reviewIntervalDays * 24 * 60 * 60 * 1000
}

function sensitiveFieldPattern(policy: ResolvedEngineeringStandardsPolicy): RegExp {
  const fields = policy.logging.sensitiveFields.map(escapeRegex).join('|')
  return new RegExp(`\\b(?:${fields})\\b`, 'i')
}

function isLogCall(line: string): boolean {
  return /\b(?:console\.(?:log|debug|info|warn|error)|logger\.(?:trace|debug|info|warn|error|fatal)|log(?:ger)?\.(?:trace|debug|info|warn|error|fatal)|log[A-Za-z0-9_]*\s*\()\b/.test(line)
}

function isAdHocOutputCall(line: string): boolean {
  return /\bconsole\.(?:log|debug|info|warn|error)\s*\(|\bfmt\.Print(?:f|ln)?\s*\(|\bprint(?:ln)?\s*\(|\bSystem\.out\.print(?:ln)?\s*\(|\bConsole\.Write(?:Line)?\s*\(|\bprintln!\s*\(/.test(line)
}

function isHardcodedSecret(line: string, policy: ResolvedEngineeringStandardsPolicy): boolean {
  const fields = policy.logging.sensitiveFields.map(escapeRegex).join('|')
  const match = new RegExp(`\\b\\w*(?:${fields})\\w*\\b\\s*[:=]\\s*(['"\`])([^'"\`]{12,})\\1`, 'i').exec(line)
  if (!match) return false
  return !/\b(example|sample|placeholder|changeme|replace-me|dummy|test-value)\b/i.test(match[2])
}

function isRawSqlConstruction(line: string): boolean {
  return /\b(?:query|execute|exec|raw|rawQuery)\s*\(/i.test(line) &&
    /\b(?:SELECT|INSERT|UPDATE|DELETE|DROP|TRUNCATE)\b/i.test(line) &&
    (line.includes('+') || line.includes('${') || /\breq\./.test(line))
}

function isConsoleAllowed(path: string, policy: ResolvedEngineeringStandardsPolicy): boolean {
  const normalized = normalizePath(path)
  if (policy.allowedConsoleFiles.map(normalizePath).includes(normalized)) return true
  return policy.allowedConsoleDirectories
    .map(normalizePath)
    .some(prefix => normalized === prefix || normalized.startsWith(`${prefix}/`))
}

function isOuterLayerPath(path: string): boolean {
  return /(^|\/)(api|controller|controllers|handler|handlers|routes|pages)(\/|$)/i.test(path)
}

function importsInnerPersistence(line: string): boolean {
  return /\bimport\b.*(?:repository|repositories|dao|model|models|entity|entities|infra|infrastructure)|\bfrom\s+['"].*(?:repository|repositories|dao|model|models|entity|entities|infra|infrastructure)/i.test(line)
}

function isNonExecutablePatternLine(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.includes('String.raw`') || trimmed.startsWith('templateBody:')) return true
  return /^\/.*\/[dgimsuy]*,?$/.test(trimmed) ||
    /^\/.*\/[dgimsuy]*,?\s*\/\/.*$/.test(trimmed) ||
    /^\/.*\/[dgimsuy]*\.(?:test|exec)\(/.test(trimmed) ||
    /^return\s+\/.*\/[dgimsuy]*\.(?:test|exec)\(/.test(trimmed) ||
    /=\s*\/.*\/[dgimsuy]*\s*(?:[),;]|$)/.test(trimmed) ||
    /^pattern:\s*\/.*\/[dgimsuy]*,?$/.test(trimmed) ||
    /\(\s*\/.*\/[dgimsuy]*\.(?:test|exec)\(/.test(trimmed)
}

function isAllowedFindingPattern(
  finding: EngineeringStandardFinding,
  policy: ResolvedEngineeringStandardsPolicy,
): boolean {
  return policy.allowedFindingPatterns.some(item => {
    if (item.ruleId !== finding.ruleId) return false
    if (item.path && normalizePath(item.path) !== normalizePath(finding.path)) return false
    if (item.evidencePattern && !new RegExp(item.evidencePattern).test(finding.evidence ?? '')) return false
    if (item.messagePattern && !new RegExp(item.messagePattern).test(finding.message)) return false
    return true
  })
}

function isBaselineFinding(finding: EngineeringStandardFinding, policy: ResolvedEngineeringStandardsPolicy): boolean {
  return policy.baselineFindings.some(item =>
    item.ruleId === finding.ruleId &&
    normalizePath(item.path) === normalizePath(finding.path) &&
    (item.line === undefined || item.line === finding.line),
  )
}

function dedupeFindings(findings: EngineeringStandardFinding[]): EngineeringStandardFinding[] {
  const seen = new Set<string>()
  return findings.filter(finding => {
    const key = `${finding.ruleId}:${finding.path}:${finding.line ?? 0}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function normalizePath(path: string): string {
  return path.split(sep).join('/').replace(/^\.\//, '')
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}
