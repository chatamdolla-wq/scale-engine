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

export interface ReviewAnalysisInput {
  statusOutput: string
  diffs: DiffInput[]
  taskPayload?: Pick<TaskPayload, 'verificationEvidenceIds'>
  largeDiffThreshold?: number
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

export function analyzeReview(input: ReviewAnalysisInput): { changedFiles: ChangedFile[]; findings: ReviewFinding[] } {
  const changedFiles = parseChangedFiles(input.statusOutput).filter(file => shouldReviewFile(file.path))
  const findings: ReviewFinding[] = []

  if (!input.taskPayload?.verificationEvidenceIds?.length) {
    findings.push({
      category: 'process',
      severity: 'HIGH',
      description: 'Task has no persisted verification evidence; run scale verify before review.',
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

  let totalDiffLines = 0
  for (const diff of input.diffs) {
    const text = diff.text.slice(0, 20000)
    totalDiffLines += text.split('\n').filter(line => line.startsWith('+') || line.startsWith('-')).length

    if (/(password|api[_-]?key|secret|token|auth)\s*[:=]\s*['"][^'"]+['"]/i.test(text)) {
      findings.push({
        category: 'security',
        severity: 'CRITICAL',
        description: 'Possible hardcoded secret introduced in diff.',
        file: diff.file,
        evidence: 'secret-like assignment pattern found in git diff',
      })
    }
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
