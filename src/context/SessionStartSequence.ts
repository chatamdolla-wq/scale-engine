// SCALE Engine - Harness Engineering: 标准化启动序列
// 文章启发：检查 Git Log → 读取进度文件 → 定位未完成任务 → 开始工作

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { IEventBus } from '../core/eventBus.js'
import type { IArtifactStore } from '../artifact/store.js'
import { logger } from '../core/logger.js'

export interface SessionStartContext {
  workingDir: string
  gitStatus: GitStatusInfo
  recentCommits: CommitInfo[]
  progressFile?: ProgressFileInfo
  unfinishedTasks: UnfinishedTask[]
  harnessRecommendations: string[]
  generatedAt: number
}

export interface GitStatusInfo {
  branch: string
  aheadOfMain: number
  uncommittedChanges: boolean
  untrackedFiles: string[]
}

export interface CommitInfo {
  sha: string
  message: string
  timestamp: number
  author: string
}

export interface ProgressFileInfo {
  path: string
  content: string
  lastTask?: string
  currentPhase?: string
  blockers?: string[]
}

export interface UnfinishedTask {
  taskId: string
  priority: number
  status: string
  description: string
  blockingReason?: string
}

export class SessionStartSequence {
  constructor(private store: IArtifactStore, private eventBus: IEventBus, private projectDir: string = '.') {}

  async execute(sessionId: string): Promise<SessionStartContext> {
    const workingDir = this.projectDir
    const gitStatus = this.getGitStatus()
    const recentCommits = this.getRecentCommits(5)
    const progressFile = this.readProgressFile(sessionId)
    const unfinishedTasks = await this.findUnfinishedTasks()
    const harnessRecommendations = this.generateHarnessRecommendations(gitStatus, progressFile, unfinishedTasks)

    const context = { workingDir, gitStatus, recentCommits, progressFile, unfinishedTasks, harnessRecommendations, generatedAt: Date.now() }
    this.eventBus.emit('session.started', { sessionId, context })
    return context
  }

  private getGitStatus(): GitStatusInfo {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: this.projectDir, encoding: 'utf-8' }).trim()
      const ahead = parseInt(execSync('git rev-list --count HEAD..origin/main 2>/dev/null || echo 0', { cwd: this.projectDir, encoding: 'utf-8' }).trim(), 10)
      const status = execSync('git status --porcelain', { cwd: this.projectDir, encoding: 'utf-8' }).trim()
      const untracked = status.split('
').filter(l => l.startsWith('??')).map(l => l.slice(3))
      return { branch, aheadOfMain: ahead, uncommittedChanges: status.length > 0, untrackedFiles: untracked }
    } catch { return { branch: 'unknown', aheadOfMain: 0, uncommittedChanges: false, untrackedFiles: [] } }
  }

  private getRecentCommits(limit: number): CommitInfo[] {
    try {
      const log = execSync('git log --oneline -' + limit + ' --format="%H|%s|%at|%an"', { cwd: this.projectDir, encoding: 'utf-8' }).trim()
      return log.split('
').map(line => {
        const [sha, message, timestamp, author] = line.split('|')
        return { sha, message, timestamp: parseInt(timestamp, 10) * 1000, author }
      })
    } catch { return [] }
  }

  private readProgressFile(sessionId: string): ProgressFileInfo | undefined {
    const paths = [
      join(this.projectDir, '.omc', 'state', 'sessions', sessionId, 'progress.md'),
      join(this.projectDir, '.omc', 'notepad.md'),
      join(homedir(), '.claude', 'sessions', sessionId, 'progress.md'),
    ]
    for (const path of paths) {
      if (existsSync(path)) {
        try {
          const content = readFileSync(path, 'utf-8')
          return { path, content, lastTask: this.extractLastTask(content), currentPhase: this.extractCurrentPhase(content), blockers: this.extractBlockers(content) }
        } catch { continue }
      }
    }
    return undefined
  }

  private extractLastTask(content: string): string | undefined { const match = content.match(/Lasts*Task:s*(TASK-[^
]+)/i); return match?.[1] }
  private extractCurrentPhase(content: string): string | undefined { const match = content.match(/Phase:s*(explore|plan|execute|verify|deliver)/i); return match?.[1]?.toLowerCase() }
  private extractBlockers(content: string): string[] { const match = content.match(/Blockers:s*([^
]+)/i); return match ? match[1].split(',').map(b => b.trim()).filter(Boolean) : [] }

  private async findUnfinishedTasks(): Promise<UnfinishedTask[]> {
    try {
      const allTasks = await this.store.findByType('Task')
      const unfinished = allTasks.filter(a => a.status !== 'DONE' && a.status !== 'CANCELLED')
      return unfinished.map(t => ({ taskId: t.id, priority: t.payload.priority ?? 50, status: t.status, description: (t.payload as any).description ?? '', blockingReason: this.getBlockingReason(t) })).sort((a, b) => b.priority - a.priority)
    } catch { return [] }
  }

  private getBlockingReason(artifact: any): string | undefined {
    if (!artifact.payload.buildStatus || artifact.payload.buildStatus === 'pending') return 'Build not run'
    if (artifact.payload.buildStatus === 'failed') return 'Build failed'
    if (!artifact.payload.testPassed) return 'Tests not passed'
    if (!artifact.payload.reviewPassed) return 'Review not passed (Harness requirement)'
    return undefined
  }

  private generateHarnessRecommendations(git: GitStatusInfo, progress: ProgressFileInfo | undefined, tasks: UnfinishedTask[]): string[] {
    const recs: string[] = []
    if (git.uncommittedChanges) recs.push('⚠️ 有未提交的变更')
    if (git.untrackedFiles.length > 0) recs.push('⚠️ 有 ' + git.untrackedFiles.length + ' 个未跟踪文件')
    if (git.aheadOfMain > 5) recs.push('⚠️ 本分支领先 main ' + git.aheadOfMain + ' 个提交')
    if (progress?.blockers?.length) recs.push('⚠️ 当前阻塞: ' + progress.blockers.join(', '))
    if (tasks.length > 0) { const top = tasks[0]; recs.push('📍 最高优先任务: ' + top.taskId + ' (' + top.status + ') — ' + top.description) }
    recs.push('Harness Engineering: 理解 → 规划 → 执行 → 验证 → 沉淀')
    recs.push('质量门禁: 编译通过 + 测试通过 + 覆盖率≥80% + 评审通过')
    return recs
  }

  formatContextBlock(ctx: SessionStartContext): string {
    const lines = ['## Session Start Context (Harness Engineering)', '', '### Git Status', '- Branch: ' + ctx.gitStatus.branch, '- Ahead of main: ' + ctx.gitStatus.aheadOfMain, '- Uncommitted: ' + (ctx.gitStatus.uncommittedChanges ? '⚠️ YES' : '✅ No'), '', '### Recent Commits', ...ctx.recentCommits.map(c => '- ' + c.sha.slice(0,7) + ': ' + c.message), '', '### Unfinished Tasks', ...ctx.unfinishedTasks.slice(0, 5).map(t => '- ' + t.taskId + ': ' + t.status + ' — ' + t.description), '', '### Harness Recommendations', ...ctx.harnessRecommendations]
    return lines.join('
')
  }
}
