import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { TOOL_CAPABILITY_CATALOG, type ToolCapabilityCategory } from '../tools/ToolCapabilityRegistry.js'
import { SCALE_ENGINE_VERSION } from '../version.js'
import { computeGovernanceDrift, readGovernanceLock, type GovernanceDriftReport } from './GovernanceLock.js'
import { listGovernanceTemplatePacks, resolveGovernanceTemplatePack, type GovernancePackId } from './GovernanceTemplatePacks.js'
import { writeGovernanceTemplates } from './GovernanceTemplates.js'

export type UpgradeStatus = 'missing-lock' | 'clean' | 'updates-available' | 'local-changes'
export type UpgradeApplyMode = 'safe' | 'manual-review'
export type UpgradeRisk = 'low' | 'medium' | 'high'
export type ThirdPartyTrust = 'trusted' | 'community' | 'high-risk'
export type ThirdPartyUpdatePolicy = 'check-only' | 'manual-review' | 'blocked'

export interface UpgradeManagerOptions {
  projectDir?: string
  targetScaleVersion?: string
}

export interface UpgradeApplyOptions extends UpgradeManagerOptions {
  confirm?: boolean
}

export interface UpgradeCheckReport {
  version: 1
  projectDir: string
  status: UpgradeStatus
  scaleEngine: {
    currentVersion: string | null
    latestVersion: string
    upToDate: boolean
  }
  governanceLock: {
    exists: boolean
    path: string
  }
  governancePack: {
    id: GovernancePackId | null
    currentVersion: number | null
    latestVersion: number | null
    upToDate: boolean
  }
  generatedFiles: {
    total: number
    clean: number
    changed: number
    missing: number
  }
  drift: GovernanceDriftReport
  thirdParty: ThirdPartyUpdateReport
  recommendedCommands: string[]
}

export interface ThirdPartyUpdateReport {
  version: 1
  policy: 'check-only'
  summary: {
    total: number
    trusted: number
    community: number
    highRisk: number
    reviewRequired: number
    blocked: number
  }
  reviewRequired: number
  entries: ThirdPartyUpdateEntry[]
}

export interface ThirdPartyUpdateEntry {
  id: string
  name: string
  category: ToolCapabilityCategory
  source?: string
  trust: ThirdPartyTrust
  updatePolicy: ThirdPartyUpdatePolicy
  installPolicy: 'never-auto-install'
  latestVersion: 'unknown'
  reason: string
}

export interface UpgradePlanReport {
  version: 1
  projectDir: string
  status: UpgradeStatus
  applyMode: UpgradeApplyMode
  blockers: UpgradePlanBlocker[]
  steps: UpgradePlanStep[]
  check: UpgradeCheckReport
  recommendedCommands: string[]
}

export interface UpgradePlanBlocker {
  code: 'missing-governance-lock' | 'local-generated-file-changed'
  path?: string
  message: string
}

export interface UpgradePlanStep {
  action:
    | 'initialize-governance-lock'
    | 'upgrade-scale-engine'
    | 'upgrade-governance-pack'
    | 'restore-missing-generated-file'
    | 'review-local-change'
    | 'review-third-party-capability'
    | 'run-preflight'
  path?: string
  risk: UpgradeRisk
  reason: string
  command?: string
}

export interface UpgradeBackupManifest {
  version: 1
  id: string
  createdAt: string
  projectDir: string
  files: UpgradeBackupEntry[]
}

export interface UpgradeBackupEntry {
  path: string
  existed: boolean
  backupPath?: string
}

export interface UpgradeApplyReport {
  version: 1
  projectDir: string
  ok: boolean
  applied: boolean
  reason: string
  changedFiles: string[]
  backup?: {
    id: string
    dir: string
    manifestPath: string
  }
  plan: UpgradePlanReport
}

export interface UpgradeRollbackReport {
  version: 1
  projectDir: string
  ok: boolean
  applied: boolean
  reason: string
  backup?: {
    id: string
    dir: string
    manifestPath: string
  }
  restoredFiles: string[]
}

export function createUpgradeCheckReport(options: UpgradeManagerOptions = {}): UpgradeCheckReport {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const lock = readGovernanceLock(projectDir)
  const drift = computeGovernanceDrift(projectDir)
  const latestScaleVersion = normalizeTargetVersion(options.targetScaleVersion)
  const pack = lock ? resolveGovernanceTemplatePack(lock.pack) : null
  const scaleUpToDate = Boolean(lock && lock.scaleVersion === latestScaleVersion)
  const packUpToDate = Boolean(lock && pack && lock.packVersion === pack.version)
  const generatedTotal = drift.clean.length + drift.changed.length + drift.missing.length
  const thirdParty = createThirdPartyUpdateReport()
  const status = resolveUpgradeStatus({
    hasLock: Boolean(lock),
    hasLocalChanges: drift.changed.length > 0,
    hasMissingFiles: drift.missing.length > 0,
    scaleUpToDate,
    packUpToDate,
  })

  return {
    version: 1,
    projectDir,
    status,
    scaleEngine: {
      currentVersion: lock?.scaleVersion ?? null,
      latestVersion: latestScaleVersion,
      upToDate: scaleUpToDate,
    },
    governanceLock: {
      exists: Boolean(lock),
      path: join(projectDir, '.scale', 'governance.lock.json'),
    },
    governancePack: {
      id: lock?.pack ?? null,
      currentVersion: lock?.packVersion ?? null,
      latestVersion: pack?.version ?? null,
      upToDate: packUpToDate,
    },
    generatedFiles: {
      total: generatedTotal,
      clean: drift.clean.length,
      changed: drift.changed.length,
      missing: drift.missing.length,
    },
    drift,
    thirdParty,
    recommendedCommands: [
      'scale upgrade plan --dir .',
      'scale tools outdated --dir .',
      'scale skill outdated --dir .',
      'scale preflight --preflight-profile quick',
    ],
  }
}

export function createUpgradePlanReport(options: UpgradeManagerOptions = {}): UpgradePlanReport {
  const check = createUpgradeCheckReport(options)
  const blockers: UpgradePlanBlocker[] = []
  const steps: UpgradePlanStep[] = []

  if (!check.governanceLock.exists) {
    blockers.push({
      code: 'missing-governance-lock',
      message: 'No governance lock exists; SCALE cannot determine which generated files are safe to upgrade.',
    })
    steps.push({
      action: 'initialize-governance-lock',
      risk: 'medium',
      reason: 'Create a lock before upgrading generated governance assets.',
      command: 'scale init --governance-pack standard',
    })
  }

  if (!check.scaleEngine.upToDate && check.scaleEngine.currentVersion) {
    steps.push({
      action: 'upgrade-scale-engine',
      risk: 'low',
      reason: `SCALE Engine changed from ${check.scaleEngine.currentVersion} to ${check.scaleEngine.latestVersion}.`,
      command: 'npm install -g @hongmaple0820/scale-engine',
    })
  }

  if (!check.governancePack.upToDate && check.governancePack.id) {
    steps.push({
      action: 'upgrade-governance-pack',
      risk: 'medium',
      reason: `Governance pack ${check.governancePack.id} changed from v${check.governancePack.currentVersion} to v${check.governancePack.latestVersion}.`,
      command: `scale init --governance-pack ${check.governancePack.id}`,
    })
  }

  for (const entry of check.drift.missing) {
    steps.push({
      action: 'restore-missing-generated-file',
      path: entry.path,
      risk: 'low',
      reason: 'The file is tracked by the governance lock but is missing locally.',
    })
  }

  for (const entry of check.drift.changed) {
    blockers.push({
      code: 'local-generated-file-changed',
      path: entry.path,
      message: 'Generated governance file has local edits and needs a three-way/manual review before upgrade.',
    })
    steps.push({
      action: 'review-local-change',
      path: entry.path,
      risk: 'medium',
      reason: 'Local edits must be preserved or intentionally replaced.',
    })
  }

  const thirdPartyReview = check.thirdParty.entries.filter(entry => entry.updatePolicy !== 'check-only')
  for (const entry of thirdPartyReview) {
    steps.push({
      action: 'review-third-party-capability',
      risk: entry.trust === 'high-risk' ? 'high' : 'medium',
      reason: `${entry.name} updates require ${entry.updatePolicy}; SCALE never auto-installs third-party capabilities.`,
    })
  }

  steps.push({
    action: 'run-preflight',
    risk: 'low',
    reason: 'Validate the project after any accepted upgrade.',
    command: 'scale preflight --preflight-profile quick',
  })

  return {
    version: 1,
    projectDir: check.projectDir,
    status: check.status,
    applyMode: blockers.length === 0 ? 'safe' : 'manual-review',
    blockers,
    steps,
    check,
    recommendedCommands: [
      'scale upgrade check --dir .',
      'scale upgrade plan --dir . --html',
      'scale preflight --preflight-profile quick',
    ],
  }
}

export function applyUpgradePlan(options: UpgradeApplyOptions = {}): UpgradeApplyReport {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const plan = createUpgradePlanReport(options)
  if (!options.confirm) {
    return upgradeApplyResult(projectDir, plan, false, false, 'Review scale upgrade plan first, then rerun with --confirm.', [])
  }
  if (plan.applyMode !== 'safe') {
    return upgradeApplyResult(projectDir, plan, false, false, 'Upgrade requires manual review because generated files have local changes or the lock is missing.', [])
  }
  if (!plan.check.governanceLock.exists || !plan.check.governancePack.id) {
    return upgradeApplyResult(projectDir, plan, false, false, 'Cannot apply without a governance lock and pack id.', [])
  }
  if (!plan.check.governancePack.upToDate) {
    return upgradeApplyResult(projectDir, plan, false, false, 'Governance pack version changes require manual review before automatic apply.', [])
  }

  const missingFiles = plan.check.drift.missing.map(entry => entry.path)
  const shouldRefreshLock = !plan.check.scaleEngine.upToDate || missingFiles.length > 0
  if (!shouldRefreshLock) {
    return upgradeApplyResult(projectDir, plan, true, false, 'No safe upgrade changes were needed.', [])
  }

  const backup = createUpgradeBackup(projectDir, uniqueStrings([...missingFiles, '.scale/governance.lock.json']))
  const result = writeGovernanceTemplates(projectDir, { pack: plan.check.governancePack.id })
  const createdFiles = result.created
    .map(path => normalizeProjectRelativePath(projectDir, path))
    .filter((path): path is string => Boolean(path))
  mergeCreatedFilesIntoBackup(backup.manifestPath, createdFiles)

  const changedFiles = uniqueStrings([
    ...missingFiles.filter(path => existsSync(join(projectDir, path))),
    ...createdFiles,
    '.scale/governance.lock.json',
  ])

  return {
    version: 1,
    projectDir,
    ok: true,
    applied: changedFiles.length > 0,
    reason: changedFiles.length > 0 ? 'Safe upgrade changes were applied.' : 'No safe upgrade changes were needed.',
    changedFiles,
    backup,
    plan: createUpgradePlanReport(options),
  }
}

export function rollbackLatestUpgrade(options: UpgradeManagerOptions = {}): UpgradeRollbackReport {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const backup = latestUpgradeBackup(projectDir)
  if (!backup) {
    return {
      version: 1,
      projectDir,
      ok: false,
      applied: false,
      reason: 'No SCALE-managed upgrade backup was found.',
      restoredFiles: [],
    }
  }

  const manifest = JSON.parse(readFileSync(backup.manifestPath, 'utf-8')) as UpgradeBackupManifest
  const restoredFiles: string[] = []
  for (const entry of manifest.files) {
    const target = join(projectDir, entry.path)
    if (entry.existed && entry.backupPath) {
      mkdirSync(dirname(target), { recursive: true })
      copyFileSync(join(backup.dir, entry.backupPath), target)
    } else {
      rmSync(target, { force: true, recursive: true })
    }
    restoredFiles.push(entry.path)
  }

  return {
    version: 1,
    projectDir,
    ok: true,
    applied: true,
    reason: 'Latest SCALE-managed upgrade backup was rolled back.',
    backup,
    restoredFiles: uniqueStrings(restoredFiles),
  }
}

export function createThirdPartyUpdateReport(category?: ToolCapabilityCategory | ToolCapabilityCategory[]): ThirdPartyUpdateReport {
  const selectedCategories = Array.isArray(category) ? new Set(category) : category ? new Set([category]) : undefined
  const entries = TOOL_CAPABILITY_CATALOG
    .filter(tool => !selectedCategories || selectedCategories.has(tool.category))
    .map(tool => {
      const trust = classifyThirdPartyTrust(tool.category, tool.source)
      const updatePolicy = updatePolicyForTrust(trust)
      return {
        id: tool.id,
        name: tool.name,
        category: tool.category,
        source: tool.source,
        trust,
        updatePolicy,
        installPolicy: 'never-auto-install' as const,
        latestVersion: 'unknown' as const,
        reason: updateReason(tool.category, trust),
      }
    })
  const trusted = entries.filter(entry => entry.trust === 'trusted').length
  const community = entries.filter(entry => entry.trust === 'community').length
  const highRisk = entries.filter(entry => entry.trust === 'high-risk').length
  const blocked = entries.filter(entry => entry.updatePolicy === 'blocked').length
  const reviewRequired = entries.filter(entry => entry.updatePolicy !== 'check-only').length
  return {
    version: 1,
    policy: 'check-only',
    summary: {
      total: entries.length,
      trusted,
      community,
      highRisk,
      reviewRequired,
      blocked,
    },
    reviewRequired,
    entries,
  }
}

function upgradeApplyResult(
  projectDir: string,
  plan: UpgradePlanReport,
  ok: boolean,
  applied: boolean,
  reason: string,
  changedFiles: string[],
): UpgradeApplyReport {
  return {
    version: 1,
    projectDir,
    ok,
    applied,
    reason,
    changedFiles,
    plan,
  }
}

function createUpgradeBackup(projectDir: string, relativePaths: string[]): { id: string; dir: string; manifestPath: string } {
  const id = `upgrade-${new Date().toISOString().replace(/[:.]/g, '-')}`
  const dir = join(projectDir, '.scale', 'backups', id)
  const filesDir = join(dir, 'files')
  mkdirSync(filesDir, { recursive: true })
  const manifest: UpgradeBackupManifest = {
    version: 1,
    id,
    createdAt: new Date().toISOString(),
    projectDir,
    files: uniqueStrings(relativePaths).map(path => {
      const target = join(projectDir, path)
      if (!existsSync(target)) return { path, existed: false }
      const backupPath = join('files', path.replace(/^[\\/]+/, '').replace(/\\/g, '/'))
      const backupTarget = join(dir, backupPath)
      mkdirSync(dirname(backupTarget), { recursive: true })
      copyFileSync(target, backupTarget)
      return { path, existed: true, backupPath }
    }),
  }
  const manifestPath = join(dir, 'manifest.json')
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8')
  return { id, dir, manifestPath }
}

function mergeCreatedFilesIntoBackup(manifestPath: string, createdFiles: string[]): void {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as UpgradeBackupManifest
  const existing = new Set(manifest.files.map(file => file.path))
  for (const path of createdFiles) {
    if (!existing.has(path)) {
      manifest.files.push({ path, existed: false })
      existing.add(path)
    }
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8')
}

function latestUpgradeBackup(projectDir: string): { id: string; dir: string; manifestPath: string } | null {
  const backupsDir = join(projectDir, '.scale', 'backups')
  if (!existsSync(backupsDir)) return null
  const candidates = readdirSync(backupsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith('upgrade-'))
    .map(entry => ({
      id: entry.name,
      dir: join(backupsDir, entry.name),
      manifestPath: join(backupsDir, entry.name, 'manifest.json'),
    }))
    .filter(entry => existsSync(entry.manifestPath))
    .sort((a, b) => a.id.localeCompare(b.id))
  return candidates.at(-1) ?? null
}

function normalizeProjectRelativePath(projectDir: string, path: string): string | null {
  const normalizedProject = resolve(projectDir).replace(/\\/g, '/')
  const normalizedPath = resolve(path).replace(/\\/g, '/')
  if (!normalizedPath.startsWith(`${normalizedProject}/`)) return null
  return normalizedPath.slice(normalizedProject.length + 1)
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items)]
}

export function writeUpgradePlanHtml(report: UpgradePlanReport, outputPath?: string): string {
  const target = outputPath ?? join(report.projectDir, '.scale', 'reports', 'upgrade-plan.html')
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, renderUpgradePlanHtml(report), 'utf-8')
  return target
}

export function listAvailableGovernancePackVersions(): Array<{ id: GovernancePackId; version: number }> {
  return listGovernanceTemplatePacks().map(pack => ({ id: pack.id, version: pack.version }))
}

function resolveUpgradeStatus(input: {
  hasLock: boolean
  hasLocalChanges: boolean
  hasMissingFiles: boolean
  scaleUpToDate: boolean
  packUpToDate: boolean
}): UpgradeStatus {
  if (!input.hasLock) return 'missing-lock'
  if (input.hasLocalChanges) return 'local-changes'
  if (input.hasMissingFiles || !input.scaleUpToDate || !input.packUpToDate) return 'updates-available'
  return 'clean'
}

function normalizeTargetVersion(version: string | undefined): string {
  if (!version || version === 'latest') return SCALE_ENGINE_VERSION
  return version
}

function classifyThirdPartyTrust(category: ToolCapabilityCategory, source: string | undefined): ThirdPartyTrust {
  if (category === 'desktop') return 'high-risk'
  if (!source) return 'community'
  if (
    source.includes('anthropics/') ||
    source.includes('playwright.dev') ||
    source.includes('openai/') ||
    source.includes('google-gemini/') ||
    source.includes('vercel-labs/')
  ) return 'trusted'
  return 'community'
}

function updatePolicyForTrust(trust: ThirdPartyTrust): ThirdPartyUpdatePolicy {
  if (trust === 'high-risk') return 'blocked'
  if (trust === 'community') return 'manual-review'
  return 'check-only'
}

function updateReason(category: ToolCapabilityCategory, trust: ThirdPartyTrust): string {
  if (trust === 'high-risk') return 'High-privilege desktop automation must be reviewed and confirmed by a human.'
  if (trust === 'community') return 'Community source requires source, script, and permission review before update.'
  if (category === 'mcp') return 'MCP updates must still be checked for command and permission changes.'
  return 'Trusted source; check version and changelog before applying.'
}

function renderUpgradePlanHtml(report: UpgradePlanReport): string {
  const rows = report.steps.map(step => `
      <tr>
        <td>${escapeHtml(step.action)}</td>
        <td>${escapeHtml(step.path ?? '')}</td>
        <td>${escapeHtml(step.risk)}</td>
        <td>${escapeHtml(step.reason)}</td>
        <td><code>${escapeHtml(step.command ?? '')}</code></td>
      </tr>`).join('')
  const blockers = report.blockers.length
    ? report.blockers.map(blocker => `<li><strong>${escapeHtml(blocker.code)}</strong> ${escapeHtml(blocker.path ?? '')} ${escapeHtml(blocker.message)}</li>`).join('')
    : '<li>No blockers detected.</li>'
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>SCALE Upgrade Plan</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; color: #1f2937; }
    h1 { margin-bottom: 8px; }
    table { border-collapse: collapse; width: 100%; margin-top: 16px; }
    th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; }
    code { white-space: pre-wrap; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #eef2ff; }
  </style>
</head>
<body>
  <h1>SCALE Upgrade Plan</h1>
  <p>Project: <code>${escapeHtml(report.projectDir)}</code></p>
  <p>Status: <span class="badge">${escapeHtml(report.status)}</span> Apply mode: <span class="badge">${escapeHtml(report.applyMode)}</span></p>
  <h2>Blockers</h2>
  <ul>${blockers}</ul>
  <h2>Steps</h2>
  <table>
    <thead><tr><th>Action</th><th>Path</th><th>Risk</th><th>Reason</th><th>Command</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <h2>Third-party Policy</h2>
  <p>Policy: ${escapeHtml(report.check.thirdParty.policy)}. Review required: ${report.check.thirdParty.reviewRequired}.</p>
</body>
</html>
`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
