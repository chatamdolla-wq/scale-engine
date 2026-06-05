// SCALE Engine — Diagnose and Hunt Commands
import { defineCommand } from 'citty'
import { getEngine, SCALE_DIR, PROJECT_DIR, isTruthyFlag } from './engineBootstrap.js'
import { WorkflowArtifactWriter } from '../workflow/WorkflowArtifactWriter.js'
import {
  createDiagnosticLoop,
  renderDiagnosticLoopMarkdown,
  validateDiagnosticLoop,
} from '../workflow/DiagnosticLoop.js'
import { BackgroundHunter, HuntFindingStore } from '../workflow/autonomous/BackgroundHunter.js'
import { removeWorkflowOpenTask } from '../workflow/WorkflowOpenTasks.js'
import { appendDiagnosticLoopArtifact } from '../workflow/TaskArtifactScaffolder.js'

function parseCommaList(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return []
  return String(value).split(',').map(s => s.trim()).filter(s => s.length > 0)
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items)]
}

function resolveChangedFilesArg(args: { changed?: boolean; 'changed-files'?: string }): string[] | undefined {
  if (args['changed-files']) return parseCommaList(args['changed-files'])
  if (!args.changed) return undefined
  return undefined
}

export const diagnosePlanCommand = defineCommand({
  meta: { name: 'plan', description: 'Create a reproducible diagnostic loop before fixing a bug' },
  args: {
    'task-id': { type: 'string', required: true },
    symptom: { type: 'string', required: true },
    repro: { type: 'string', description: 'Command that reproduces the current failure' },
    'expected-failure': { type: 'string', description: 'Expected failing behavior or assertion' },
    files: { type: 'string', description: 'Comma-separated changed or suspicious files' },
    verify: { type: 'string', description: 'Comma-separated verification commands after the fix' },
    'artifact-dir': { type: 'string', description: 'Task artifact directory where plan.md should be updated' },
    write: { type: 'boolean', default: false, description: 'Append diagnostic loop output to the task plan artifact' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const changedFiles = parseCommaList(args.files)
    const loop = createDiagnosticLoop({
      taskId: String(args['task-id']),
      symptom: String(args.symptom),
      reproductionCommand: args.repro ? String(args.repro) : undefined,
      expectedFailure: args['expected-failure'] ? String(args['expected-failure']) : undefined,
      changedFiles,
      verificationCommands: parseCommaList(args.verify),
    })
    const validation = validateDiagnosticLoop(loop)
    const artifactPath = isTruthyFlag(args.write)
      ? appendDiagnosticLoopArtifact({
          projectDir: PROJECT_DIR,
          artifactsDir: args['artifact-dir'] ? String(args['artifact-dir']) : undefined,
          loop,
          validation,
        }) ?? undefined
      : undefined
    if (artifactPath || args['artifact-dir']) {
      const writer = new WorkflowArtifactWriter(SCALE_DIR)
      const current = writer.readCurrentState()
      const currentOpenTasks = current?.taskId === loop.taskId ? current.openTasks : []
      writer.updateCurrentState({
        taskId: loop.taskId,
        phase: 'plan',
        artifactsDir: args['artifact-dir'] ? String(args['artifact-dir']).replace(/\\/g, '/') : undefined,
        filesModified: changedFiles,
        openTasks: validation.ready
          ? removeWorkflowOpenTask(currentOpenTasks.filter(task => task.trim().startsWith('scale ')), 'diagnostic-loop')
          : uniqueStrings([
              ...currentOpenTasks,
              ...validation.blockers,
            ]),
      })
    }
    if (args.json) {
      console.log(JSON.stringify({ loop, validation, artifactPath }, null, 2))
      return
    }
    console.log(renderDiagnosticLoopMarkdown(loop))
    if (!validation.ready) {
      console.log('\nBlockers:')
      for (const blocker of validation.blockers) console.log(`  - ${blocker}`)
    }
    if (artifactPath) console.log(`\nArtifact: ${artifactPath}`)
  },
})

export const diagnoseCommand = defineCommand({
  meta: { name: 'diagnose', description: 'Evidence-first debugging workflows' },
  subCommands: { plan: diagnosePlanCommand },
})

function createBackgroundHunter(args: { dir?: string }): BackgroundHunter {
  return new BackgroundHunter({ projectDir: args.dir ? String(args.dir) : PROJECT_DIR })
}

export const huntScanCommand = defineCommand({
  meta: { name: 'scan', description: 'Run a readonly proactive governance scan' },
  args: {
    dir: { type: 'string', default: PROJECT_DIR, description: 'Project directory' },
    changed: { type: 'boolean', default: false, description: 'Scan changed Git files only' },
    'changed-files': { type: 'string', description: 'Comma or newline separated file list to scan' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const report = createBackgroundHunter(args).scan({
      changedFiles: resolveChangedFilesArg(args),
    })
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
      return
    }
    printHuntReport(report)
  },
})

export const huntReportCommand = defineCommand({
  meta: { name: 'report', description: 'Print open and ignored hunt findings' },
  args: {
    dir: { type: 'string', default: PROJECT_DIR, description: 'Project directory' },
    changed: { type: 'boolean', default: false, description: 'Scan changed Git files only' },
    'changed-files': { type: 'string', description: 'Comma or newline separated file list to scan' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const report = createBackgroundHunter(args).scan({
      changedFiles: resolveChangedFilesArg(args),
    })
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
      return
    }
    printHuntReport(report)
  },
})

export const huntDiagnoseCommand = defineCommand({
  meta: { name: 'diagnose', description: 'Create a diagnostic loop from a hunt finding' },
  args: {
    id: { type: 'positional', required: true, description: 'Hunt finding id' },
    dir: { type: 'string', default: PROJECT_DIR, description: 'Project directory' },
    changed: { type: 'boolean', default: false, description: 'Scan changed Git files only' },
    'changed-files': { type: 'string', description: 'Comma or newline separated file list to scan' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const report = createBackgroundHunter(args).scan({
      changedFiles: resolveChangedFilesArg(args),
    })
    const finding = report.findings.find(item => item.id === String(args.id))
    if (!finding) {
      console.error(`Hunt finding not found: ${String(args.id)}`)
      process.exitCode = 1
      return
    }
    const loop = createDiagnosticLoop(finding.diagnosticInput)
    const validation = validateDiagnosticLoop(loop)
    if (args.json) {
      console.log(JSON.stringify({ finding, loop, validation }, null, 2))
      return
    }
    console.log(renderDiagnosticLoopMarkdown(loop))
    if (!validation.ready) {
      console.log('\nBlockers:')
      for (const blocker of validation.blockers) console.log(`  - ${blocker}`)
    }
  },
})

export const huntIgnoreCommand = defineCommand({
  meta: { name: 'ignore', description: 'Ignore a stable hunt finding fingerprint' },
  args: {
    id: { type: 'positional', required: true, description: 'Hunt finding id' },
    reason: { type: 'string', description: 'Why this finding is accepted or deferred' },
    dir: { type: 'string', default: PROJECT_DIR, description: 'Project directory' },
    changed: { type: 'boolean', default: false, description: 'Scan changed Git files only' },
    'changed-files': { type: 'string', description: 'Comma or newline separated file list to scan' },
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const projectDir = args.dir ? String(args.dir) : PROJECT_DIR
    const report = new BackgroundHunter({ projectDir }).scan({
      changedFiles: resolveChangedFilesArg(args),
    })
    const finding = report.findings.find(item => item.id === String(args.id))
    if (!finding) {
      console.error(`Hunt finding not found: ${String(args.id)}`)
      process.exitCode = 1
      return
    }
    const ignored = new HuntFindingStore({ projectDir }).ignore({
      id: finding.id,
      fingerprint: finding.fingerprint,
      reason: args.reason ? String(args.reason) : undefined,
      ignoredAt: new Date().toISOString(),
    })
    if (args.json) {
      console.log(JSON.stringify({ ignored }, null, 2))
      return
    }
    console.log(`Ignored hunt finding: ${ignored.id}`)
    if (ignored.reason) console.log(`  Reason: ${ignored.reason}`)
  },
})

export const huntCommand = defineCommand({
  meta: { name: 'hunt', description: 'Readonly proactive governance scans' },
  subCommands: {
    scan: huntScanCommand,
    report: huntReportCommand,
    diagnose: huntDiagnoseCommand,
    ignore: huntIgnoreCommand,
  },
})

function printHuntReport(report: ReturnType<BackgroundHunter['scan']>): void {
  console.log('SCALE Hunt Report')
  console.log(`  Project: ${report.projectDir}`)
  console.log(`  Open findings: ${report.summary.open}`)
  console.log(`  Ignored findings: ${report.summary.ignored}`)
  console.log(`  Blocking findings: ${report.summary.blocking}`)
  for (const finding of report.findings.slice(0, 20)) {
    const line = finding.line ? `:${finding.line}` : ''
    const status = finding.status === 'ignored' ? 'IGNORED' : finding.severity.toUpperCase()
    console.log(`  [${status}] ${finding.id} ${finding.ruleId} ${finding.path ?? 'project'}${line}: ${finding.message}`)
  }
  if (report.findings.length > 20) console.log(`  ... ${report.findings.length - 20} more finding(s)`)
}
