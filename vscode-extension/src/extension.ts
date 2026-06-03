// SCALE Engine VS Code Extension
// Provides: status, verify, context, dashboard, eval, shield, cortex commands
// Plus: artifact tree view, gate status view, event stream view

import * as vscode from 'vscode'
import { execSync, exec } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

let outputChannel: vscode.OutputChannel

function getScaleDir(): string {
  const config = vscode.workspace.getConfiguration('scale')
  const configured = config.get<string>('projectDir', '')
  if (configured && existsSync(configured)) return configured
  const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  if (workspace) return workspace
  return process.cwd()
}

function runScaleCommand(args: string[], cwd?: string): string {
  const dir = cwd ?? getScaleDir()
  try {
    return execSync(`npx scale ${args.join(' ')}`, {
      cwd: dir,
      encoding: 'utf-8',
      timeout: 30000,
      env: { ...process.env, NO_COLOR: '1' },
    }).trim()
  } catch (err: any) {
    return err.stdout?.toString()?.trim() ?? err.message
  }
}

// ── Tree View Providers ──────────────────────────────────────────────────────

class ArtifactTreeProvider implements vscode.TreeDataProvider<ArtifactItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ArtifactItem | undefined>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  refresh() { this._onDidChangeTreeData.fire(undefined) }

  getTreeItem(element: ArtifactItem): vscode.TreeItem { return element }

  async getChildren(): Promise<ArtifactItem[]> {
    const output = runScaleCommand(['status', '--json'])
    try {
      const data = JSON.parse(output)
      const artifacts = data.artifacts ?? []
      return artifacts.map((a: any) =>
        new ArtifactItem(a.id ?? a.title, a.type ?? 'unknown', a.status ?? 'unknown', vscode.TreeItemCollapsibleState.None)
      )
    } catch {
      return [new ArtifactItem('No artifacts', '', '', vscode.TreeItemCollapsibleState.None)]
    }
  }
}

class ArtifactItem extends vscode.TreeItem {
  constructor(label: string, type: string, status: string, collapsible: vscode.TreeItemCollapsibleState) {
    super(label, collapsible)
    this.description = `${type} · ${status}`
    this.contextValue = 'artifact'

    const iconMap: Record<string, string> = {
      DRAFT: 'circle-outline',
      FROZEN: 'lock',
      DONE: 'check',
      IN_PROGRESS: 'play',
      COMPLETED: 'check-all',
      FAILED: 'error',
    }
    this.iconPath = new vscode.ThemeIcon(iconMap[status] ?? 'file')
  }
}

class GateTreeProvider implements vscode.TreeDataProvider<GateItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<GateItem | undefined>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  refresh() { this._onDidChangeTreeData.fire(undefined) }

  getTreeItem(element: GateItem): vscode.TreeItem { return element }

  async getChildren(): Promise<GateItem[]> {
    const output = runScaleCommand(['gate', 'status', '--json'])
    try {
      const data = JSON.parse(output)
      const gates = data.gates ?? []
      return gates.map((g: any) =>
        new GateItem(g.name ?? g.id, g.passed ?? false, g.required ?? false)
      )
    } catch {
      return [new GateItem('No gate data', false, false)]
    }
  }
}

class GateItem extends vscode.TreeItem {
  constructor(label: string, passed: boolean, required: boolean) {
    super(label, vscode.TreeItemCollapsibleState.None)
    this.description = passed ? 'PASS' : (required ? 'FAIL' : 'SKIP')
    this.contextValue = 'gate'
    this.iconPath = new vscode.ThemeIcon(passed ? 'pass' : 'error')
  }
}

class EventTreeProvider implements vscode.TreeDataProvider<EventItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<EventItem | undefined>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  refresh() { this._onDidChangeTreeData.fire(undefined) }

  getTreeItem(element: EventItem): vscode.TreeItem { return element }

  async getChildren(): Promise<EventItem[]> {
    const output = runScaleCommand(['events', '--limit', '20', '--json'])
    try {
      const data = JSON.parse(output)
      const events = data.events ?? []
      return events.map((e: any) =>
        new EventItem(e.type ?? 'unknown', e.timestamp ?? 0)
      )
    } catch {
      return [new EventItem('No events', 0)]
    }
  }
}

class EventItem extends vscode.TreeItem {
  constructor(type: string, timestamp: number) {
    super(type, vscode.TreeItemCollapsibleState.None)
    this.description = timestamp ? new Date(timestamp).toLocaleTimeString() : ''
    this.contextValue = 'event'

    const color = type.includes('fail') ? 'error' : type.includes('pass') ? 'pass' : 'info'
    this.iconPath = new vscode.ThemeIcon(color === 'error' ? 'error' : color === 'pass' ? 'check' : 'circle-outline')
  }
}

// ── Extension Activation ─────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('SCALE Engine')
  context.subscriptions.push(outputChannel)

  // Register tree view providers
  const artifactProvider = new ArtifactTreeProvider()
  const gateProvider = new GateTreeProvider()
  const eventProvider = new EventTreeProvider()

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('scale.artifacts', artifactProvider),
    vscode.window.registerTreeDataProvider('scale.gates', gateProvider),
    vscode.window.registerTreeDataProvider('scale.events', eventProvider),
  )

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('scale.status', () => {
      const output = runScaleCommand(['status'])
      outputChannel.appendLine(output)
      outputChannel.show()
      vscode.window.showInformationMessage('SCALE status displayed in output panel')
    }),

    vscode.commands.registerCommand('scale.verify', async () => {
      const taskId = await vscode.window.showInputBox({
        prompt: 'Enter task ID to verify',
        placeHolder: 'TASK-xxx',
      })
      if (!taskId) return
      vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Verifying task...' }, async () => {
        const output = runScaleCommand(['verifyTask', taskId])
        outputChannel.appendLine(output)
        outputChannel.show()
        artifactProvider.refresh()
        gateProvider.refresh()
      })
    }),

    vscode.commands.registerCommand('scale.context', () => {
      const sessionId = vscode.env.sessionId
      const output = runScaleCommand(['context', 'status', '--session-id', sessionId])
      outputChannel.appendLine(output)
      outputChannel.show()
    }),

    vscode.commands.registerCommand('scale.dashboard', () => {
      const config = vscode.workspace.getConfiguration('scale')
      const port = config.get<number>('dashboardPort', 3210)
      vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${port}`))
    }),

    vscode.commands.registerCommand('scale.eval.run', async () => {
      vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Running eval suite...' }, async () => {
        const output = runScaleCommand(['eval', 'run', '--suite', 'workflow-baseline'])
        outputChannel.appendLine(output)
        outputChannel.show()
      })
    }),

    vscode.commands.registerCommand('scale.shield.status', () => {
      const output = runScaleCommand(['shield', 'status'])
      outputChannel.appendLine(output)
      outputChannel.show()
    }),

    vscode.commands.registerCommand('scale.cortex.evolve', async () => {
      vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Running evolution cycle...' }, async () => {
        const output = runScaleCommand(['cortex', 'evolve'])
        outputChannel.appendLine(output)
        outputChannel.show()
      })
    }),
  )

  // Auto-verify on save
  const config = vscode.workspace.getConfiguration('scale')
  if (config.get<boolean>('autoVerify', false)) {
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (doc.fileName.endsWith('.ts') || doc.fileName.endsWith('.js')) {
          artifactProvider.refresh()
          gateProvider.refresh()
        }
      })
    )
  }

  outputChannel.appendLine('SCALE Engine extension activated')
}

export function deactivate() {}
