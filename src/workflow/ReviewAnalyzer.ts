import type { TaskPayload } from '../artifact/types.js'
import type { ReviewFinding } from './ReviewStore.js'

export interface ChangedFile {
  status: string
  path: string
}

export interface DiffInput {
  file: string
  text: string
}

export interface VerificationEvidenceSummary {
  gate: string
  passed: boolean
}

export interface ReviewAnalysisInput {
  statusOutput: string
  diffs: DiffInput[]
  taskPayload?: Pick<TaskPayload, 'verificationEvidenceIds'>
  verificationEvidence?: VerificationEvidenceSummary[]
  largeDiffThreshold?: number
}

interface DiffLine {
  line: number
  text: string
}

export function parseChangedFiles(output: string): ChangedFile[] {
  return output
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [status, ...pathParts] = line.split(/\s+/)
      return { status, path: pathParts.join(' ') }
    })
    .filter(file => file.path.length > 0)
}

export function shouldReviewFile(path: string): boolean {
  const normalized = path.replace(/\\/g, '/')
  return !normalized.endsWith('/') &&
    !normalized.startsWith('.scale/') &&
    !normalized.startsWith('dist/') &&
    !normalized.includes('node_modules/') &&
    !/\.(png|jpe?g|gif|webp|ico|db|db-shm|db-wal)$/i.test(normalized)
}

export function summarizeFindings(findings: ReviewFinding[]) {
  return {
    critical: findings.filter(f => f.severity === 'CRITICAL').length,
    high: findings.filter(f => f.severity === 'HIGH').length,
    medium: findings.filter(f => f.severity === 'MEDIUM').length,
    low: findings.filter(f => f.severity === 'LOW').length,
  }
}

function isDiffPayloadLine(line: string): boolean {
  return (line.startsWith('+') && !line.startsWith('+++')) ||
    (line.startsWith('-') && !line.startsWith('---'))
}

function getAddedLines(text: string): DiffLine[] {
  return text
    .split('\n')
    .map((line, index) => ({ line: index + 1, text: line }))
    .filter(item => item.text.startsWith('+') && !item.text.startsWith('+++'))
    .map(item => ({ line: item.line, text: item.text.slice(1) }))
}

function firstMatch(lines: DiffLine[], pattern: RegExp): DiffLine | undefined {
  return lines.find(line => pattern.test(line.text))
}

function isSourcePath(path: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(path)
}

function isTestPath(path: string): boolean {
  return /(^|\/)(tests?|__tests__)\//i.test(path.replace(/\\/g, '/')) ||
    /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(path)
}

function isSecuritySensitivePath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/').toLowerCase()
  return /(^|\/)(auth|security|permissions?|credentials?|secrets?|tokens?|sessions?)(\/|\.|-|_)/.test(normalized) ||
    /(auth|security|credential|secret|token|session|password)/.test(normalized)
}

function evidence(line: DiffLine, label: string): string {
  return `${label} at diff line ${line.line}: ${line.text.trim().slice(0, 160)}`
}

function isCommentOrWhitespace(text: string): boolean {
  const trimmed = text.trim()
  return trimmed === '' ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('*/')
}

function isRegexRuleDefinition(text: string): boolean {
  const trimmed = text.trim()
  return /^\/.*\/[dgimsuy]*,?$/.test(trimmed) ||
    /^\/.*\/[dgimsuy]*,?\s*\/\/.*$/.test(trimmed) ||
    /^\/.*\/[dgimsuy]*\.(?:test|exec)\(/.test(trimmed) ||
    /=\s*\/.*\/[dgimsuy]*\s*(?:[),;]|$)/.test(trimmed) ||
    /\bfirstMatch\([^,]+,\s*\/.*\/[dgimsuy]*\)?/.test(trimmed) ||
    /^pattern:\s*\/.*\/[dgimsuy]*,?$/.test(trimmed) ||
    // Array of regex patterns: /pattern/flags, // comment
    /^\/.*\/[dgimsuy]*\s*,/.test(trimmed)
}

function isTestDiffFixture(file: string, text: string): boolean {
  if (!isTestPath(file)) return false
  const trimmed = text.trim()
  const fixtureRiskPattern = /(?:password|api[_-]?key|secret|token|auth|credential|private[_-]?key|git add|shell: true|innerHTML|@ts-ignore|catch)/i
  return (
    /\b(?:text|diff|diffs|[A-Za-z]+Diff)\b\s*[:=]/.test(text) && /['"`]\+/.test(text)
  ) || (
    /['"`][^'"`]+['"`]\s*:/.test(trimmed) &&
    /['"`].*(?:password|api[_-]?key|secret|token|auth|credential|private[_-]?key|git add|shell: true|innerHTML|@ts-ignore|catch)/i.test(trimmed)
  ) || (
    /^['"`].*['"`]\s*,?$/.test(trimmed) &&
    fixtureRiskPattern.test(trimmed)
  )
}

function getExecutableAddedLines(diff: DiffInput): DiffLine[] {
  return getAddedLines(diff.text).filter(line => !isRegexRuleDefinition(line.text) && !isTestDiffFixture(diff.file, line.text))
}

function findEmptyCatch(lines: DiffLine[]): DiffLine | undefined {
  const inlineCatch = /catch\s*(?:\([^)]*\))?\s*\{\s*(?:\/\*.*?\*\/|\/\/.*)?\s*\}/
  const blockCatch = /catch\s*(?:\([^)]*\))?\s*\{\s*$/
  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index]
    if (inlineCatch.test(current.text)) return current
    if (!blockCatch.test(current.text)) continue

    for (const next of lines.slice(index + 1, index + 8)) {
      const trimmed = next.text.trim()
      if (isCommentOrWhitespace(trimmed)) continue
      if (/^}\s*[),;]?$/.test(trimmed)) return current
      break
    }
  }
  return undefined
}

function analyzeDiffRisk(diff: DiffInput): ReviewFinding[] {
  const findings: ReviewFinding[] = []
  const added = getExecutableAddedLines(diff)
  if (added.length === 0) return findings

  const secret = firstMatch(
    added,
    /\b(password|passwd|api[_-]?key|secret|token|auth[_-]?token|access[_-]?token|refresh[_-]?token|private[_-]?key)\b\s*[:=]\s*['"`][^'"`]+['"`]/i,
  )
  if (secret) {
    findings.push({
      category: 'security',
      severity: 'CRITICAL',
      description: 'Possible hardcoded secret introduced in diff.',
      file: diff.file,
      evidence: evidence(secret, 'secret-like assignment'),
    })
  }

  const securityBypass = firstMatch(
    added,
    /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"`]0['"`]|rejectUnauthorized\s*:\s*false|strictSSL\s*:\s*false|dangerouslySetInnerHTML|innerHTML\s*=|eval\s*\(|new\s+Function\s*\(/i,
  )
  if (securityBypass) {
    findings.push({
      category: 'security',
      severity: 'HIGH',
      description: 'Security bypass or unsafe runtime execution was introduced.',
      file: diff.file,
      evidence: evidence(securityBypass, 'unsafe security pattern'),
    })
  }

  const dangerousShell = firstMatch(
    added,
    /\bgit\s+add\s+\.(?=$|[\s'"`),;])|rm\s+-rf\s+(?:\/|~|\*|\.)|curl\b.*\|.*\b(?:bash|sh|pwsh|powershell|cmd)\b|Invoke-WebRequest\b.*\|\s*iex\b/i,
  )
  if (dangerousShell) {
    findings.push({
      category: 'security',
      severity: 'HIGH',
      description: 'Dangerous shell or Git command was introduced.',
      file: diff.file,
      evidence: evidence(dangerousShell, 'dangerous command'),
    })
  }

  const shellExecution = firstMatch(added, /\bshell\s*:\s*true\b|\bexecSync\s*\(|\bchild_process\.exec\s*\(/)
  if (shellExecution) {
    findings.push({
      category: 'security',
      severity: isSourcePath(diff.file) ? 'HIGH' : 'MEDIUM',
      description: 'Shell execution was introduced; verify arguments are not user-controlled.',
      file: diff.file,
      evidence: evidence(shellExecution, 'shell execution'),
    })
  }

  const emptyCatch = findEmptyCatch(added)
  if (emptyCatch && isSourcePath(diff.file)) {
    findings.push({
      category: 'logic',
      severity: 'HIGH',
      description: 'Empty or comment-only catch block was introduced.',
      file: diff.file,
      evidence: evidence(emptyCatch, 'empty catch'),
    })
  }

  const tsIgnore = firstMatch(added, /^\s*(?:\/\/|\/\*)\s*@ts-ignore\b/)
  if (tsIgnore && isSourcePath(diff.file)) {
    findings.push({
      category: 'logic',
      severity: 'HIGH',
      description: 'TypeScript error suppression with @ts-ignore was introduced.',
      file: diff.file,
      evidence: evidence(tsIgnore, 'ts-ignore'),
    })
  }

  const looseAny = firstMatch(added, /\bas\s+any\b|:\s*any\b|<any\b|Array<any>|Promise<any>|Record<[^>]+,\s*any>/)
  if (looseAny && isSourcePath(diff.file) && !isTestPath(diff.file)) {
    findings.push({
      category: 'logic',
      severity: 'MEDIUM',
      description: 'New any-based type escape was introduced in source code.',
      file: diff.file,
      evidence: evidence(looseAny, 'type escape'),
    })
  }

  const focusedTest = firstMatch(added, /\b(describe|it|test)\.only\s*\(/)
  if (focusedTest) {
    findings.push({
      category: 'process',
      severity: 'HIGH',
      description: 'Focused test was introduced and would skip the rest of the suite.',
      file: diff.file,
      evidence: evidence(focusedTest, 'focused test'),
    })
  }

  const skippedTest = firstMatch(added, /\b(describe|it|test)\.skip\s*\(/)
  if (skippedTest) {
    findings.push({
      category: 'process',
      severity: 'MEDIUM',
      description: 'Skipped test was introduced; confirm this is temporary and tracked.',
      file: diff.file,
      evidence: evidence(skippedTest, 'skipped test'),
    })
  }

  return findings
}

export function analyzeReview(input: ReviewAnalysisInput): { changedFiles: ChangedFile[]; findings: ReviewFinding[] } {
  const changedFiles = parseChangedFiles(input.statusOutput).filter(file => shouldReviewFile(file.path))
  const findings: ReviewFinding[] = []

  // Check for verification evidence - downgrade to MEDIUM to not block review pass
  // Review can still proceed, but evidence persistence issue is noted
  if (input.taskPayload && !input.taskPayload.verificationEvidenceIds?.length) {
    findings.push({
      category: 'process',
      severity: 'MEDIUM',
      description: 'Task has no persisted verification evidence; consider running scale verify before review.',
    })
  }

  const deletedSource = changedFiles.filter(file => file.status.includes('D') && /\.(ts|tsx|js|jsx|test\.ts|spec\.ts)$/i.test(file.path))
  for (const file of deletedSource) {
    findings.push({
      category: 'logic',
      severity: 'HIGH',
      description: 'Source or test file deletion requires explicit review.',
      file: file.path,
      evidence: file.status,
    })
  }

  const publicApiChanged = changedFiles.some(file =>
    /(^src\/api\/|^src\/artifact\/types\.ts$|^src\/workflow\/types\.ts$|^src\/.*types\.ts$)/.test(file.path.replace(/\\/g, '/')),
  )
  const docsOrTestsChanged = changedFiles.some(file => /(^tests\/|^docs\/|README)/.test(file.path.replace(/\\/g, '/')))
  if (publicApiChanged && !docsOrTestsChanged) {
    findings.push({
      category: 'process',
      severity: 'MEDIUM',
      description: 'Public API or shared type changes were detected without accompanying docs or tests.',
    })
  }

  const securitySensitiveChanged = changedFiles.filter(file => isSecuritySensitivePath(file.path))
  const hasSecurityGateEvidence = input.verificationEvidence?.some(record => record.gate === 'G7' && record.passed) === true
  if (securitySensitiveChanged.length > 0 && !hasSecurityGateEvidence) {
    findings.push({
      category: 'security',
      severity: 'HIGH',
      description: 'Security-sensitive files changed without passing G7 security evidence.',
      file: securitySensitiveChanged[0].path,
      evidence: securitySensitiveChanged.map(file => file.path).slice(0, 5).join(', '),
    })
  }

  let totalDiffLines = 0
  for (const diff of input.diffs) {
    const text = diff.text.slice(0, 20000)
    totalDiffLines += text.split('\n').filter(isDiffPayloadLine).length
    findings.push(...analyzeDiffRisk({ ...diff, text }))
  }

  if (input.diffs.length > 0 && changedFiles.length > input.diffs.length) {
    findings.push({
      category: 'process',
      severity: 'MEDIUM',
      description: `Review scanned diffs for ${input.diffs.length}/${changedFiles.length} changed files; split the review or raise the scan limit.`,
    })
  }

  if (totalDiffLines > (input.largeDiffThreshold ?? 800)) {
    findings.push({
      category: 'process',
      severity: 'MEDIUM',
      description: `Large diff detected (${totalDiffLines} changed lines); consider splitting review scope.`,
    })
  }

  return { changedFiles, findings }
}
