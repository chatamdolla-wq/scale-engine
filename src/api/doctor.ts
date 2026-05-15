// SCALE Engine — Doctor (W10)
// 环境诊断 + 健康检查
// Usage: scale doctor

import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { computeGovernanceDrift } from '../workflow/GovernanceLock.js'
import { doctorEngineeringStandards } from '../workflow/EngineeringStandards.js'
import { doctorResourceAssets } from '../workflow/ResourceGovernance.js'

export interface DiagnosticResult {
  name: string
  status: 'ok' | 'warn' | 'fail'
  message: string
  fix?: string
  optional?: boolean // Optional checks don't affect overall health
  category?: 'governance' | 'knowledge-graph'
}

export interface DoctorReport {
  overall: 'healthy' | 'degraded' | 'broken'
  checks: DiagnosticResult[]
  timestamp: number
  knowledgeGraph?: {
    available: boolean
    pythonVersion?: string
    graphifyInstalled?: boolean
  }
}

export class Doctor {
  constructor(
    private projectDir: string = '.',
    private scaleDir: string = '.scale',
  ) {}

  async diagnose(): Promise<DoctorReport> {
    const checks: DiagnosticResult[] = []

    checks.push(this.checkScaleDir())
    checks.push(this.checkEventsDir())
    checks.push(this.checkArtifactsDir())
    checks.push(this.checkSettingsJson())
    checks.push(this.checkKnowledgeDoc())
    checks.push(this.checkRulesDir())
    checks.push(this.checkHooksDir())
    checks.push(this.checkNodeVersion())
    checks.push(this.checkDiskUsage())
    checks.push(this.checkGitignore())

    const governanceTemplatesCheck = this.checkGovernanceTemplates()
    const verificationMatrixCheck = this.checkVerificationMatrix()
    const skillRoutingPolicyCheck = this.checkSkillRoutingPolicy()
    const resourcePolicyCheck = this.checkResourcePolicy()
    const engineeringStandardsCheck = this.checkEngineeringStandards()
    const governanceDriftCheck = this.checkGovernanceDrift()
    governanceTemplatesCheck.optional = true
    verificationMatrixCheck.optional = true
    skillRoutingPolicyCheck.optional = true
    resourcePolicyCheck.optional = true
    engineeringStandardsCheck.optional = true
    governanceDriftCheck.optional = true
    governanceTemplatesCheck.category = 'governance'
    verificationMatrixCheck.category = 'governance'
    skillRoutingPolicyCheck.category = 'governance'
    resourcePolicyCheck.category = 'governance'
    engineeringStandardsCheck.category = 'governance'
    governanceDriftCheck.category = 'governance'
    checks.push(governanceTemplatesCheck)
    checks.push(verificationMatrixCheck)
    checks.push(skillRoutingPolicyCheck)
    checks.push(resourcePolicyCheck)
    checks.push(engineeringStandardsCheck)
    checks.push(governanceDriftCheck)

    // Optional knowledge graph checks (non-blocking)
    const pythonCheck = this.checkPython()
    const graphifyCheck = this.checkGraphify()
    pythonCheck.optional = true
    graphifyCheck.optional = true
    pythonCheck.category = 'knowledge-graph'
    graphifyCheck.category = 'knowledge-graph'
    checks.push(pythonCheck)
    checks.push(graphifyCheck)

    // Calculate overall health excluding optional checks
    const coreChecks = checks.filter((c) => !c.optional)
    const fails = coreChecks.filter((c) => c.status === 'fail').length
    const warns = coreChecks.filter((c) => c.status === 'warn').length
    const overall = fails > 0 ? 'broken' : warns > 0 ? 'degraded' : 'healthy'

    // Knowledge graph availability metadata
    const knowledgeGraph = {
      available: pythonCheck.status === 'ok' && graphifyCheck.status === 'ok',
      pythonVersion: pythonCheck.status === 'ok' ? pythonCheck.message : undefined,
      graphifyInstalled: graphifyCheck.status === 'ok',
    }

    return { overall, checks, timestamp: Date.now(), knowledgeGraph }
  }

  private checkScaleDir(): DiagnosticResult {
    const dir = join(this.projectDir, this.scaleDir)
    if (!existsSync(dir)) {
      return { name: '.scale directory', status: 'fail', message: 'Missing .scale/ directory', fix: 'Run: scale init' }
    }
    return { name: '.scale directory', status: 'ok', message: `Found at ${dir}` }
  }

  private checkEventsDir(): DiagnosticResult {
    const dir = join(this.projectDir, this.scaleDir, 'events')
    if (!existsSync(dir)) {
      return { name: 'Events directory', status: 'fail', message: 'Missing events/ directory', fix: 'Run: scale init' }
    }
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
      const totalSize = files.reduce((sum, f) => sum + statSync(join(dir, f)).size, 0)
      const sizeMB = (totalSize / 1024 / 1024).toFixed(2)
      if (totalSize > 100 * 1024 * 1024) {
        return { name: 'Events directory', status: 'warn', message: `${files.length} files, ${sizeMB}MB — consider archiving`, fix: 'Archive old event files' }
      }
      return { name: 'Events directory', status: 'ok', message: `${files.length} files, ${sizeMB}MB` }
    } catch {
      return { name: 'Events directory', status: 'ok', message: 'Empty (fresh install)' }
    }
  }

  private checkArtifactsDir(): DiagnosticResult {
    const dir = join(this.projectDir, this.scaleDir, 'artifacts')
    if (!existsSync(dir)) {
      return { name: 'Artifacts directory', status: 'fail', message: 'Missing artifacts/ directory', fix: 'Run: scale init' }
    }
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
      return { name: 'Artifacts directory', status: 'ok', message: `${files.length} artifacts` }
    } catch {
      return { name: 'Artifacts directory', status: 'ok', message: 'Empty' }
    }
  }

  private checkSettingsJson(): DiagnosticResult {
    const candidates: Array<{ agent: string; path: string }> = [
      { agent: 'claude-code', path: join(this.projectDir, '.claude', 'settings.json') },
      { agent: 'claude-code', path: join(this.projectDir, '.claude', 'settings.local.json') },
      { agent: 'codex', path: join(this.projectDir, '.codex', 'hooks.json') },
      { agent: 'cursor', path: join(this.projectDir, '.cursor', 'settings.json') },
      { agent: 'gemini', path: join(this.projectDir, '.gemini', 'settings.json') },
      { agent: 'openclaw', path: join(this.projectDir, '.openclaw', 'settings.json') },
      { agent: 'hermes', path: join(this.projectDir, '.hermes', 'settings.json') },
      { agent: 'trae', path: join(this.projectDir, '.trae', 'settings.json') },
      { agent: 'workbuddy', path: join(this.projectDir, '.workbuddy', 'settings.json') },
      { agent: 'vsc', path: join(this.projectDir, '.vscode', 'scale.json') },
      { agent: 'qcoder', path: join(this.projectDir, '.qwen', 'settings.json') },
    ]
    const found = candidates.find((c) => existsSync(c.path))
    if (!found) {
      return {
        name: 'Agent settings',
        status: 'warn',
        message: 'No agent settings found (.claude/.codex/.cursor/.gemini/.openclaw/.hermes/.trae/.workbuddy/.vscode/.qwen)',
        fix: 'Run: scale init --agent <claude-code|codex|cursor|gemini|openclaw|hermes|trae|workbuddy|vsc|qcoder>',
      }
    }
    try {
      const content = JSON.parse(readFileSync(found.path, 'utf-8'))
      const hasScaleHooks = JSON.stringify(content).includes('scale ')
      if (!hasScaleHooks) {
        return {
          name: 'Agent settings',
          status: 'warn',
          message: `${found.path} exists but no SCALE hooks`,
          fix: `Run: scale init --agent ${found.agent} to inject hooks`,
        }
      }
      const hookCount = Object.values(content.hooks ?? {}).flat().length
      return { name: 'Agent settings', status: 'ok', message: `${hookCount} hooks configured (${found.agent})` }
    } catch {
      return { name: 'Agent settings', status: 'fail', message: `${found.path} is invalid JSON`, fix: 'Fix JSON syntax' }
    }
  }

  private checkKnowledgeDoc(): DiagnosticResult {
    const paths = ['CLAUDE.md', 'AGENTS.md', '.cursorrules', 'GEMINI.md', '.hermes.md', 'TRAE.md', 'WORKBUDDY.md', 'VSC.md', 'QWEN.md']
    for (const name of paths) {
      const p = join(this.projectDir, name)
      if (existsSync(p)) {
        const lines = readFileSync(p, 'utf-8').split('\n').length
        if (lines > 200) {
          return { name: 'Knowledge doc', status: 'warn', message: `${name}: ${lines} lines (>200 — compliance may drop)`, fix: 'Split low-frequency rules to .claude/rules/' }
        }
        return { name: 'Knowledge doc', status: 'ok', message: `${name}: ${lines} lines` }
      }
    }
    return { name: 'Knowledge doc', status: 'warn', message: 'No knowledge doc found', fix: 'Run: scale init' }
  }

  private checkRulesDir(): DiagnosticResult {
    const dir = join(this.projectDir, this.scaleDir, 'rules')
    if (!existsSync(dir)) {
      return { name: 'Rules directory', status: 'ok', message: 'Not created yet (no evolved rules)' }
    }
    const files = readdirSync(dir).filter((f) => f.endsWith('.md'))
    return { name: 'Rules directory', status: 'ok', message: `${files.length} rules` }
  }

  private checkHooksDir(): DiagnosticResult {
    const dir = join(this.projectDir, this.scaleDir, 'hooks')
    if (!existsSync(dir)) {
      return { name: 'Hooks directory', status: 'ok', message: 'Not created yet (no evolved hooks)' }
    }
    const files = readdirSync(dir).filter((f) => f.endsWith('.sh'))
    return { name: 'Hooks directory', status: 'ok', message: `${files.length} hooks` }
  }

  private checkNodeVersion(): DiagnosticResult {
    const version = process.version
    const major = parseInt(version.slice(1).split('.')[0])
    if (major < 20) {
      return { name: 'Node.js version', status: 'fail', message: `${version} — requires >=20`, fix: 'Upgrade Node.js to v20+' }
    }
    return { name: 'Node.js version', status: 'ok', message: version }
  }

  private checkDiskUsage(): DiagnosticResult {
    const dir = join(this.projectDir, this.scaleDir)
    if (!existsSync(dir)) return { name: 'Disk usage', status: 'ok', message: 'N/A' }
    try {
      let totalSize = 0
      const walk = (d: string) => {
        for (const f of readdirSync(d)) {
          const p = join(d, f)
          const s = statSync(p)
          if (s.isDirectory()) walk(p)
          else totalSize += s.size
        }
      }
      walk(dir)
      const mb = (totalSize / 1024 / 1024).toFixed(2)
      if (totalSize > 500 * 1024 * 1024) {
        return { name: 'Disk usage', status: 'warn', message: `${mb}MB — consider cleanup`, fix: 'Archive old events/checkpoints' }
      }
      return { name: 'Disk usage', status: 'ok', message: `${mb}MB` }
    } catch {
      return { name: 'Disk usage', status: 'ok', message: 'Unable to calculate' }
    }
  }

  private checkGitignore(): DiagnosticResult {
    const p = join(this.projectDir, this.scaleDir, '.gitignore')
    if (!existsSync(p)) {
      return { name: '.scale/.gitignore', status: 'warn', message: 'Missing — runtime data may be committed', fix: 'Run: scale init' }
    }
    return { name: '.scale/.gitignore', status: 'ok', message: 'Present' }
  }

  private checkGovernanceTemplates(): DiagnosticResult {
    const required = [
      join(this.projectDir, 'docs', 'workflow', 'README.md'),
      join(this.projectDir, 'docs', 'workflow', 'templates', 'explore.md'),
      join(this.projectDir, 'docs', 'workflow', 'templates', 'mini-prd.md'),
      join(this.projectDir, 'docs', 'workflow', 'templates', 'skill-plan.md'),
      join(this.projectDir, 'docs', 'workflow', 'templates', 'ui-spec.md'),
      join(this.projectDir, 'docs', 'workflow', 'templates', 'visual-review.md'),
      join(this.projectDir, 'docs', 'workflow', 'templates', 'api-contract.md'),
      join(this.projectDir, 'docs', 'workflow', 'templates', 'security-review.md'),
      join(this.projectDir, 'docs', 'workflow', 'templates', 'resource-impact.md'),
      join(this.projectDir, 'docs', 'workflow', 'templates', 'standards-impact.md'),
      join(this.projectDir, 'docs', 'workflow', 'templates', 'architecture-review.md'),
      join(this.projectDir, 'docs', 'workflow', 'templates', 'db-change-plan.md'),
      join(this.projectDir, 'docs', 'workflow', 'templates', 'e2e-plan.md'),
      join(this.projectDir, 'docs', 'workflow', 'templates', 'plan.md'),
      join(this.projectDir, 'docs', 'workflow', 'templates', 'verification.md'),
      join(this.projectDir, 'docs', 'workflow', 'templates', 'review.md'),
      join(this.projectDir, 'docs', 'workflow', 'templates', 'summary.md'),
      join(this.projectDir, 'docs', 'workflow', 'templates', 'github-actions-scale-preflight.yml'),
      join(this.projectDir, 'docs', 'workflow', 'templates', 'pre-push-scale-preflight.sh'),
      join(this.projectDir, 'docs', 'worklog', 'metrics.md'),
    ]
    const missing = required.filter((path) => !existsSync(path))
    if (missing.length > 0) {
      return {
        name: 'Governance templates',
        status: 'warn',
        message: `${missing.length} governance templates missing`,
        fix: 'Run: scale init to generate workflow governance templates',
      }
    }
    return { name: 'Governance templates', status: 'ok', message: `${required.length} templates present` }
  }

  private checkVerificationMatrix(): DiagnosticResult {
    const path = join(this.projectDir, this.scaleDir, 'verification.json')
    if (!existsSync(path)) {
      return {
        name: 'Verification matrix',
        status: 'warn',
        message: 'Missing .scale/verification.json',
        fix: 'Run: scale init or create a service-aware verification matrix',
      }
    }
    try {
      const matrix = JSON.parse(readFileSync(path, 'utf-8')) as {
        profiles?: unknown
        services?: unknown
        policy?: { artifactGate?: unknown }
      }
      const artifactGate = matrix.policy?.artifactGate
      if (artifactGate && artifactGate !== 'off' && artifactGate !== 'warn' && artifactGate !== 'block') {
        return {
          name: 'Verification matrix',
          status: 'warn',
          message: 'Invalid policy.artifactGate; expected off, warn, or block',
          fix: 'Update .scale/verification.json policy.artifactGate',
        }
      }
      const serviceCount = Array.isArray(matrix.services) ? matrix.services.length : 0
      const profileCount = matrix.profiles && typeof matrix.profiles === 'object' ? Object.keys(matrix.profiles).length : 0
      return { name: 'Verification matrix', status: 'ok', message: `${profileCount} profiles, ${serviceCount} services` }
    } catch {
      return {
        name: 'Verification matrix',
        status: 'fail',
        message: '.scale/verification.json is invalid JSON',
        fix: 'Fix JSON syntax or regenerate with scale init',
      }
    }
  }

  private checkSkillRoutingPolicy(): DiagnosticResult {
    const path = join(this.projectDir, this.scaleDir, 'skills.json')
    if (!existsSync(path)) {
      return {
        name: 'Skill routing policy',
        status: 'warn',
        message: 'Missing .scale/skills.json',
        fix: 'Run: scale init to generate active skill routing policy',
      }
    }
    try {
      const config = JSON.parse(readFileSync(path, 'utf-8')) as {
        policy?: { mode?: unknown; enforceLevels?: unknown }
        domains?: unknown
      }
      const mode = config.policy?.mode
      if (mode && mode !== 'off' && mode !== 'warn' && mode !== 'block') {
        return {
          name: 'Skill routing policy',
          status: 'warn',
          message: 'Invalid policy.mode; expected off, warn, or block',
          fix: 'Update .scale/skills.json policy.mode',
        }
      }
      const domainCount = config.domains && typeof config.domains === 'object' ? Object.keys(config.domains).length : 0
      if (domainCount === 0) {
        return {
          name: 'Skill routing policy',
          status: 'warn',
          message: 'No skill routing domains configured',
          fix: 'Regenerate with scale init or add domains to .scale/skills.json',
        }
      }
      return { name: 'Skill routing policy', status: 'ok', message: `${domainCount} domains` }
    } catch {
      return {
        name: 'Skill routing policy',
        status: 'fail',
        message: '.scale/skills.json is invalid JSON',
        fix: 'Fix JSON syntax or regenerate with scale init',
      }
    }
  }

  private checkResourcePolicy(): DiagnosticResult {
    const path = join(this.projectDir, this.scaleDir, 'resource-policy.json')
    if (!existsSync(path)) {
      return {
        name: 'Resource policy',
        status: 'warn',
        message: 'Missing .scale/resource-policy.json',
        fix: 'Run: scale init --governance-pack resource-governance or standard',
      }
    }
    try {
      const report = doctorResourceAssets({ projectDir: this.projectDir, scaleDir: this.scaleDir })
      const failCount = report.findings.filter(finding => finding.severity === 'fail').length
      const warnCount = report.findings.filter(finding => finding.severity === 'warn').length
      if (failCount > 0) {
        return {
          name: 'Resource policy',
          status: 'warn',
          message: `${failCount} blocking resource issue(s), ${warnCount} warning(s)`,
          fix: 'Run: scale assets doctor --json',
        }
      }
      return { name: 'Resource policy', status: warnCount > 0 ? 'warn' : 'ok', message: `${report.scan.summary.total} resources, ${warnCount} warning(s)` }
    } catch {
      return {
        name: 'Resource policy',
        status: 'fail',
        message: '.scale/resource-policy.json is invalid or resource scan failed',
        fix: 'Fix JSON syntax or regenerate with scale init',
      }
    }
  }

  private checkEngineeringStandards(): DiagnosticResult {
    const path = join(this.projectDir, this.scaleDir, 'engineering-standards.json')
    if (!existsSync(path)) {
      return {
        name: 'Engineering standards',
        status: 'warn',
        message: 'Missing .scale/engineering-standards.json',
        fix: 'Run: scale init --governance-pack standard',
      }
    }
    try {
      const report = doctorEngineeringStandards({ projectDir: this.projectDir, scaleDir: this.scaleDir })
      const failCount = report.findings.filter(finding => finding.severity === 'fail').length
      const warnCount = report.findings.filter(finding => finding.severity === 'warn').length
      if (failCount > 0) {
        return {
          name: 'Engineering standards',
          status: 'warn',
          message: `${failCount} blocking standard issue(s), ${warnCount} warning(s)`,
          fix: 'Run: scale standards doctor --json',
        }
      }
      return {
        name: 'Engineering standards',
        status: warnCount > 0 ? 'warn' : 'ok',
        message: `${report.scan.summary.filesScanned} files scanned, ${warnCount} warning(s)`,
      }
    } catch {
      return {
        name: 'Engineering standards',
        status: 'fail',
        message: '.scale/engineering-standards.json is invalid or standards scan failed',
        fix: 'Fix JSON syntax or regenerate with scale init',
      }
    }
  }

  private checkGovernanceDrift(): DiagnosticResult {
    const drift = computeGovernanceDrift(this.projectDir)
    if (!drift.lockExists) {
      return {
        name: 'Governance drift',
        status: 'warn',
        message: 'Missing .scale/governance.lock.json',
        fix: 'Run: scale init --governance-pack standard',
      }
    }
    if (drift.missing.length > 0 || drift.changed.length > 0) {
      return {
        name: 'Governance drift',
        status: 'warn',
        message: `${drift.missing.length} missing, ${drift.changed.length} changed generated governance files`,
        fix: 'Run: scale governance diff',
      }
    }
    return {
      name: 'Governance drift',
      status: 'ok',
      message: `${drift.clean.length} generated governance files clean`,
    }
  }

  private checkPython(): DiagnosticResult {
    try {
      const version = execSync('python3 --version', { encoding: 'utf-8', timeout: 5000 }).trim()
      const match = version.match(/Python (\d+)\.(\d+)/)
      if (match) {
        const major = parseInt(match[1])
        const minor = parseInt(match[2])
        if (major >= 3 && minor >= 8) {
          return { name: 'Python version', status: 'ok', message: version }
        }
        return { name: 'Python version', status: 'warn', message: `${version} — graphify requires >=3.8`, fix: 'Upgrade Python to 3.8+' }
      }
      return { name: 'Python version', status: 'ok', message: version }
    } catch {
      // Try python (without 3) for Windows
      try {
        const version = execSync('python --version', { encoding: 'utf-8', timeout: 5000 }).trim()
        return { name: 'Python version', status: 'ok', message: version }
      } catch {
        return {
          name: 'Python version',
          status: 'warn',
          message: 'Not installed — knowledge graph requires Python',
          fix: 'Install Python 3.8+ or skip with --no-knowledge-graph',
        }
      }
    }
  }

  private checkGraphify(): DiagnosticResult {
    try {
      const result = execSync('pip show graphifyy', { encoding: 'utf-8', timeout: 5000 })
      const match = result.match(/Version: (\S+)/)
      if (match) {
        return { name: 'Graphify', status: 'ok', message: `graphifyy v${match[1]} installed` }
      }
      return { name: 'Graphify', status: 'ok', message: 'installed' }
    } catch {
      // Try pip3
      try {
        execSync('pip3 show graphifyy', { encoding: 'utf-8', timeout: 5000 })
        return { name: 'Graphify', status: 'ok', message: 'installed (pip3)' }
      } catch {
        return {
          name: 'Graphify',
          status: 'warn',
          message: 'Not installed — code knowledge graph optional',
          fix: 'pip install graphifyy && graphify install',
        }
      }
    }
  }

  formatReport(report: DoctorReport): string {
    const icon = { healthy: '✅', degraded: '⚠️', broken: '❌' }
    const statusIcon = { ok: '✅', warn: '⚠️', fail: '❌' }
    const lines: string[] = [
      `\n${icon[report.overall]} SCALE Engine Health: ${report.overall.toUpperCase()}`,
      `${'─'.repeat(50)}`,
    ]

    // Core checks first
    for (const check of report.checks.filter((c) => !c.optional)) {
      lines.push(`  ${statusIcon[check.status]} ${check.name}: ${check.message}`)
      if (check.fix) lines.push(`     💡 Fix: ${check.fix}`)
    }

    lines.push(`${'─'.repeat(50)}`)

    const governanceChecks = report.checks.filter((c) => c.optional && c.category === 'governance')
    if (governanceChecks.length > 0) {
      lines.push('')
      lines.push('Project Governance (Optional):')
      for (const check of governanceChecks) {
        lines.push(`  ${statusIcon[check.status]} ${check.name}: ${check.message}`)
        if (check.fix) lines.push(`     Fix: ${check.fix}`)
      }
    }

    // Knowledge graph section (optional checks)
    const optionalChecks = report.checks.filter((c) => c.optional && c.category === 'knowledge-graph')
    if (optionalChecks.length > 0) {
      lines.push('')
      lines.push('📦 Knowledge Graph (Optional):')
      for (const check of optionalChecks) {
        lines.push(`  ${statusIcon[check.status]} ${check.name}: ${check.message}`)
        if (check.fix) lines.push(`     💡 Fix: ${check.fix}`)
      }
    }

    // Knowledge graph status summary
    if (report.knowledgeGraph) {
      lines.push('')
      if (report.knowledgeGraph.available) {
        lines.push('  ✅ Code knowledge graph available')
        lines.push('  → Use: scale graphify .')
      } else {
        lines.push('  ⚠️ Code knowledge graph not available (optional feature)')
        lines.push('  → Install: pip install graphifyy && graphify install')
      }
      lines.push(`${'─'.repeat(50)}`)
    }

    const ok = report.checks.filter((c) => c.status === 'ok').length
    const warn = report.checks.filter((c) => c.status === 'warn').length
    const fail = report.checks.filter((c) => c.status === 'fail').length
    const optional = report.checks.filter((c) => c.optional).length
    lines.push(`  ${ok} passed, ${warn} warnings, ${fail} failures (${optional} optional)`)
    return lines.join('\n')
  }
}

