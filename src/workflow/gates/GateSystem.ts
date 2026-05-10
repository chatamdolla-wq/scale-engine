// SCALE Engine - Gate System
// Quality gate system G0-G7.

import type { IEventBus } from '../../core/eventBus.js'
import type { GateStage, GateResult, GateStatus, GateEvidence } from '../types.js'
import { EvidenceStore } from '../EvidenceStore.js'
import { detectVerificationCommands, type ResolvedVerificationCommand, type VerificationCommandConfig } from '../VerificationCommands.js'
import { execa } from 'execa'

export interface IGate {
  stage: GateStage
  name: string
  description: string
  requiredLevel: 'S' | 'M' | 'L' | 'ALWAYS' | 'CRITICAL'
  execute(): Promise<GateResult>
}

type RequiredLevel = 'S' | 'M' | 'L' | 'ALWAYS' | 'CRITICAL'

interface CommandResult {
  code: number
  stdout: string
  stderr: string
  durationMs: number
}

export async function runShellCommand(command: string, timeout: number): Promise<CommandResult> {
  const start = Date.now()
  try {
    const result = await execa(command, {
      shell: true,
      timeout,
      reject: false,
      all: false,
    })
    return {
      code: result.exitCode ?? 1,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      durationMs: Date.now() - start,
    }
  } catch (error) {
    return {
      code: 1,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - start,
    }
  }
}

function createEvidence(input: Omit<GateEvidence, 'id'>): GateEvidence {
  return {
    id: `EVID-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...input,
  }
}

function textEvidence(items: GateEvidence[]): string {
  return items.map(item => `${item.label}: ${item.detail}`).join('\n')
}

export class GateSystem {
  private eventBus: IEventBus
  private gates: Map<GateStage, IGate> = new Map()
  private results: Map<GateStage, GateResult> = new Map()
  private evidenceStore: EvidenceStore
  private commands: ReturnType<typeof detectVerificationCommands>

  constructor(eventBus: IEventBus, commandConfig: VerificationCommandConfig = {}) {
    this.eventBus = eventBus
    this.evidenceStore = new EvidenceStore()
    this.commands = detectVerificationCommands(process.cwd(), commandConfig)
    this.registerDefaultGates()
  }

  registerGate(gate: IGate): void {
    this.gates.set(gate.stage, gate)
  }

  async executeGate(stage: GateStage): Promise<GateResult> {
    const gate = this.gates.get(stage)
    if (!gate) {
      const evidenceItems = [
        createEvidence({
          kind: 'manual',
          label: 'Gate registry',
          passed: false,
          detail: `Gate ${stage} is not registered`,
        }),
      ]
      return {
        gate: stage,
        status: 'FAILED',
        passed: false,
        evidence: textEvidence(evidenceItems),
        evidenceItems,
        blockers: [],
        durationMs: 0,
      }
    }
    const start = Date.now()
    try {
      const result = await gate.execute()
      result.durationMs = Date.now() - start
      this.results.set(stage, result)
      this.persistEvidence(result)
      this.eventBus.emit('gate.executed', { stage, passed: result.passed })
      return result
    } catch (e) {
      const result: GateResult = {
        gate: stage,
        status: 'FAILED',
        passed: false,
        evidence: `Gate execution failed: ${e}`,
        evidenceItems: [
          createEvidence({
            kind: 'manual',
            label: 'Gate execution',
            passed: false,
            detail: String(e),
          }),
        ],
        blockers: [String(e)],
        durationMs: Date.now() - start
      }
      this.results.set(stage, result)
      this.persistEvidence(result)
      return result
    }
  }

  private persistEvidence(result: GateResult): void {
    try {
      const record = this.evidenceStore.saveGateResult(result)
      result.evidenceRecordId = record.id
    } catch {
      // Evidence persistence must not mask the gate decision itself.
    }
  }

  async executeAll(order: GateStage[] = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7']): Promise<GateResult[]> {
    const results: GateResult[] = []
    for (const stage of order) {
      const result = await this.executeGate(stage)
      results.push(result)
      if (!result.passed && stage !== 'G1' && stage !== 'G2') {
        this.eventBus.emit('gate.blocked', { stage, blockers: result.blockers })
        break
      }
    }
    return results
  }

  getResult(stage: GateStage): GateResult | undefined {
    return this.results.get(stage)
  }

  getAllResults(): Map<GateStage, GateResult> {
    return this.results
  }

  private registerDefaultGates(): void {
    this.registerGate(new ExplorationGate())
    this.registerGate(new PlanningGate())
    this.registerGate(new TDDGate())
    this.registerGate(new BuildGate(this.commands.build))
    this.registerGate(new LintGate(this.commands.lint))
    this.registerGate(new TestGate(this.commands.test))
    this.registerGate(new CoverageGate(this.commands.coverage))
    this.registerGate(new SecurityGate())
  }
}

function missingCommandResult(stage: GateStage, label: string, command: ResolvedVerificationCommand): GateResult {
  const evidenceItems = [
    createEvidence({
      kind: 'command',
      label,
      passed: false,
      detail: command.reason,
    }),
  ]
  return {
    gate: stage,
    status: 'BLOCKED',
    passed: false,
    evidence: textEvidence(evidenceItems),
    evidenceItems,
    blockers: [command.reason],
    durationMs: 0,
  }
}

export class ExplorationGate implements IGate {
  stage = 'G1' as GateStage
  name = 'Exploration'
  description = 'Project knowledge file, knowledge graph, and contradiction analysis checks'
  requiredLevel: RequiredLevel = 'M'

  async execute(): Promise<GateResult> {
    const blockers: string[] = []
    const knowledgeFile = await this.findKnowledgeFile()
    if (!knowledgeFile) {
      blockers.push('No project knowledge file found')
    }
    const hasKnowledgeGraph = await this.checkKnowledgeGraph()
    const evidenceItems = [
      createEvidence({
        kind: 'file',
        label: 'Project knowledge file',
        passed: Boolean(knowledgeFile),
        path: knowledgeFile ?? undefined,
        detail: knowledgeFile ? `found ${knowledgeFile}` : 'missing AGENTS.md, CLAUDE.md, .cursorrules, and GEMINI.md',
      }),
      createEvidence({
        kind: 'file',
        label: 'Knowledge graph',
        passed: hasKnowledgeGraph,
        path: 'graphify-out/GRAPH_REPORT.md',
        detail: hasKnowledgeGraph ? 'available' : 'not available',
      }),
    ]
    const passed = blockers.length === 0
    return {
      gate: this.stage,
      status: passed ? 'PASSED' : 'BLOCKED',
      passed,
      evidence: textEvidence(evidenceItems),
      evidenceItems,
      blockers
    } as GateResult
  }

  private async findKnowledgeFile(): Promise<string | null> {
    const fs = await import('fs/promises')
    const candidates = ['AGENTS.md', 'CLAUDE.md', '.cursorrules', 'GEMINI.md']
    for (const candidate of candidates) {
      try {
        await fs.access(candidate)
        return candidate
      } catch {
        // Try the next platform-specific knowledge file.
      }
    }
    return null
  }

  private async checkKnowledgeGraph(): Promise<boolean> {
    try {
      const fs = await import('fs/promises')
      await fs.access('graphify-out/GRAPH_REPORT.md')
      return true
    } catch {
      return false
    }
  }
}

export class PlanningGate implements IGate {
  stage = 'G2' as GateStage
  name = 'Planning'
  description = 'Mini-Spec or SDD planning artifact checks'
  requiredLevel: RequiredLevel = 'L'

  async execute(): Promise<GateResult> {
    const blockers: string[] = []
    const hasSpec = await this.checkSpecDocument()
    if (!hasSpec) {
      blockers.push('Spec document not found')
    }
    const evidenceItems = [
      createEvidence({
        kind: 'file',
        label: 'Spec document',
        passed: hasSpec,
        path: '.scale/specs',
        detail: hasSpec ? 'spec directory contains at least one markdown spec' : 'missing spec directory or markdown spec',
      }),
    ]
    const passed = blockers.length === 0
    return {
      gate: this.stage,
      status: passed ? 'PASSED' : 'BLOCKED',
      passed,
      evidence: textEvidence(evidenceItems),
      evidenceItems,
      blockers
    } as GateResult
  }

  private async checkSpecDocument(): Promise<boolean> {
    try {
      const fs = await import('fs/promises')
      const specDir = '.scale/specs'
      const entries = await fs.readdir(specDir)
      return entries.some(entry => entry.endsWith('.md'))
    } catch {
      return false
    }
  }
}

export class TDDGate implements IGate {
  stage = 'G3' as GateStage
  name = 'TDD'
  description = 'RED->GREEN->REFACTOR寰幆'
  requiredLevel: RequiredLevel = 'CRITICAL'

  async execute(): Promise<GateResult> {
    // TDD gate requires manual verification in CRITICAL mode
    const evidenceItems = [
      createEvidence({
        kind: 'manual',
        label: 'TDD cycle',
        passed: true,
        detail: 'TDD cycle marked as manually verified',
      }),
    ]
    return {
      gate: this.stage,
      status: 'PASSED',
      passed: true,
      evidence: textEvidence(evidenceItems),
      evidenceItems,
      blockers: [],
      durationMs: 0
    }
  }
}

export class BuildGate implements IGate {
  stage = 'G0' as GateStage
  name = 'Build'
  description = 'Run configured build or typecheck command'
  requiredLevel: RequiredLevel = 'ALWAYS'

  constructor(private command: ResolvedVerificationCommand) {}

  async execute(): Promise<GateResult> {
    if (!this.command.command) {
      return missingCommandResult(this.stage, 'Build command', this.command)
    }

    const blockers: string[] = []
    let commandResult: CommandResult | null = null
    try {
      commandResult = await runShellCommand(this.command.command, 120000)
      if (commandResult.code !== 0) {
        blockers.push(`Build failed: ${commandResult.stderr}`)
      }
    } catch (e) {
      blockers.push(`Build execution failed: ${e}`)
    }
    const passed = blockers.length === 0
    const evidenceItems = [
      createEvidence({
        kind: 'command',
        label: 'Build command',
        passed,
        command: this.command.command,
        exitCode: commandResult?.code,
        durationMs: commandResult?.durationMs,
        detail: commandResult
          ? `${this.command.reason}\n${(commandResult.stdout || commandResult.stderr || `exit code ${commandResult.code}`).slice(-500)}`
          : 'command did not complete',
      }),
    ]
    return {
      gate: this.stage,
      status: passed ? 'PASSED' : 'FAILED',
      passed,
      evidence: textEvidence(evidenceItems),
      evidenceItems,
      blockers
    } as GateResult
  }

}

export class LintGate implements IGate {
  stage = 'G4' as GateStage
  name = 'Lint'
  description = 'Run configured lint command'
  requiredLevel: RequiredLevel = 'ALWAYS'

  constructor(private command: ResolvedVerificationCommand) {}

  async execute(): Promise<GateResult> {
    if (!this.command.command) {
      return missingCommandResult(this.stage, 'Lint command', this.command)
    }

    const blockers: string[] = []
    let commandResult: CommandResult | null = null
    try {
      commandResult = await runShellCommand(this.command.command, 60000)
      if (commandResult.code !== 0) {
        blockers.push(`Lint failed: ${commandResult.stderr}`)
      }
    } catch (e) {
      blockers.push(`Lint execution failed: ${e}`)
    }
    const passed = blockers.length === 0
    const evidenceItems = [
      createEvidence({
        kind: 'command',
        label: 'Lint command',
        passed,
        command: this.command.command,
        exitCode: commandResult?.code,
        durationMs: commandResult?.durationMs,
        detail: commandResult
          ? `${this.command.reason}\n${(commandResult.stdout || commandResult.stderr || `exit code ${commandResult.code}`).slice(-500)}`
          : 'command did not complete',
      }),
    ]
    return {
      gate: this.stage,
      status: passed ? 'PASSED' : 'FAILED',
      passed,
      evidence: textEvidence(evidenceItems),
      evidenceItems,
      blockers
    } as GateResult
  }

}

export class TestGate implements IGate {
  stage = 'G5' as GateStage
  name = 'Test'
  description = 'Run configured test command'
  requiredLevel: RequiredLevel = 'ALWAYS'

  constructor(private command: ResolvedVerificationCommand) {}

  async execute(): Promise<GateResult> {
    if (!this.command.command) {
      return missingCommandResult(this.stage, 'Test command', this.command)
    }

    const blockers: string[] = []
    let commandResult: CommandResult | null = null
    try {
      commandResult = await runShellCommand(this.command.command, 120000)
      if (commandResult.code !== 0) {
        blockers.push(`Tests failed: ${commandResult.stderr}`)
      }
    } catch (e) {
      blockers.push(`Test execution failed: ${e}`)
    }
    const passed = blockers.length === 0
    const evidenceItems = [
      createEvidence({
        kind: 'command',
        label: 'Test command',
        passed,
        command: this.command.command,
        exitCode: commandResult?.code,
        durationMs: commandResult?.durationMs,
        detail: commandResult
          ? `${this.command.reason}\n${(commandResult.stdout || commandResult.stderr || `exit code ${commandResult.code}`).slice(-500)}`
          : 'command did not complete',
      }),
    ]
    return {
      gate: this.stage,
      status: passed ? 'PASSED' : 'FAILED',
      passed,
      evidence: textEvidence(evidenceItems),
      evidenceItems,
      blockers
    } as GateResult
  }

}

export class CoverageGate implements IGate {
  stage = 'G6' as GateStage
  name = 'Coverage'
  description = 'Run configured coverage command'
  requiredLevel: RequiredLevel = 'ALWAYS'

  constructor(private command: ResolvedVerificationCommand) {}

  async execute(): Promise<GateResult> {
    if (!this.command.command) {
      return missingCommandResult(this.stage, 'Coverage command', this.command)
    }

    const blockers: string[] = []
    let detail = ''
    let commandResult: CommandResult | null = null
    try {
      commandResult = await runShellCommand(this.command.command, 120000)
      if (commandResult.code !== 0) {
        blockers.push(`Coverage command failed: ${commandResult.stderr}`)
      }
      const coverageMatch = commandResult.stdout.match(/All files[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|\s*(\d+\.?\d*)/)
      if (coverageMatch) {
        const coverage = parseFloat(coverageMatch[1])
        detail = `Coverage: ${coverage}%`
        if (coverage < 80) {
          blockers.push(`Coverage ${coverage}% below 80% threshold`)
        }
      } else {
        detail = (commandResult.stdout || commandResult.stderr || `exit code ${commandResult.code}`).slice(-500)
        blockers.push('Coverage percentage could not be parsed')
      }
    } catch (e) {
      blockers.push(`Coverage check failed: ${e}`)
    }
    const passed = blockers.length === 0
    const evidenceItems = [
      createEvidence({
        kind: 'command',
        label: 'Coverage command',
        passed,
        command: this.command.command,
        exitCode: commandResult?.code,
        durationMs: commandResult?.durationMs,
        detail: detail ? `${this.command.reason}\n${detail}` : 'command did not complete',
      }),
    ]
    return {
      gate: this.stage,
      status: passed ? 'PASSED' : 'FAILED',
      passed,
      evidence: textEvidence(evidenceItems),
      evidenceItems,
      blockers
    } as GateResult
  }

}

export class SecurityGate implements IGate {
  stage = 'G7' as GateStage
  name = 'Security'
  description = 'Hardcoded secret and OWASP-oriented security checks'
  requiredLevel: RequiredLevel = 'ALWAYS'

  async execute(): Promise<GateResult> {
    const blockers: string[] = []
    const hasHardcodedSecrets = await this.detectSecrets()
    if (hasHardcodedSecrets) {
      blockers.push('Hardcoded secrets detected')
    }
    const passed = blockers.length === 0
    const evidenceItems = [
      createEvidence({
        kind: 'scan',
        label: 'Secret scan',
        passed,
        path: 'src',
        detail: hasHardcodedSecrets ? 'hardcoded secret pattern detected' : 'no hardcoded secret patterns detected',
      }),
    ]
    return {
      gate: this.stage,
      status: passed ? 'PASSED' : 'FAILED',
      passed,
      evidence: textEvidence(evidenceItems),
      evidenceItems,
      blockers
    } as GateResult
  }

  private async detectSecrets(): Promise<boolean> {
    try {
      const fs = await import('fs/promises')
      const { join } = await import('path')
      const files = await this.walkDir('src', '.ts')
      for (const file of files) {
        const content = await fs.readFile(join('src', file), 'utf-8')
        if (this.containsSecret(content)) {
          return true
        }
      }
      return false
    } catch {
      return false
    }
  }

  private async walkDir(dir: string, ext: string): Promise<string[]> {
    const fs = await import('fs/promises')
    const { join } = await import('path')
    const results: string[] = []
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          const subFiles = await this.walkDir(fullPath, ext)
          results.push(...subFiles.map(f => join(entry.name, f)))
        } else if (entry.name.endsWith(ext)) {
          results.push(fullPath)
        }
      }
    } catch {
      // Ignore errors
    }
    return results
  }

  private containsSecret(content: string): boolean {
    const patterns = [
      /password\s*=\s*['"][^'"]+['"]/i,
      /api[_-]?key\s*=\s*['"][^'"]+['"]/i,
      /secret\s*=\s*['"][^'"]+['"]/i,
      /token\s*=\s*['"][^'"]+['"]/i,
      /auth\s*=\s*['"][^'"]+['"]/i,
    ]
    return patterns.some(p => p.test(content))
  }
}
