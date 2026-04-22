// SCALE Engine — 5 种懒惰检测器
// 设计参考：docs/03-CORE-MODULES.md §3.5

import type { IDetector, DetectorContext } from './Gateway.js'
import type { ToolUseInput, ToolResultInput, StopInput, DetectorResult } from '../artifact/types.js'
import { createHash } from 'node:crypto'

const hashArgs = (args: unknown): string =>
  createHash('md5').update(JSON.stringify(args)).digest('hex').slice(0, 8)

// 1. 暴力重试检测
export class BruteRetryDetector implements IDetector {
  name = 'brute-retry'
  private windowMs = 3 * 60 * 1000
  private threshold = 3

  async check(input: ToolUseInput, ctx: DetectorContext): Promise<DetectorResult> {
    const key = `${input.sessionId}:${input.tool}:${hashArgs(input.args)}`
    const history = (ctx.cache.get(key) as number[] | undefined) ?? []
    const recent = history.filter((t) => Date.now() - t < this.windowMs)
    recent.push(Date.now())
    ctx.cache.set(key, recent)
    if (recent.length >= this.threshold) {
      ctx.eventBus.emit('behavior.brute_retry', { tool: input.tool, count: recent.length }, { sessionId: input.sessionId })
      return {
        triggered: true,
        severity: 'block',
        reason: `检测到「暴力重试」：${input.tool} 在 ${this.windowMs / 60000} 分钟内已运行 ${recent.length} 次。请换策略，并说明你这次的新假设是什么。`,
      }
    }
    return { triggered: false }
  }
}

// 2. 工具闲置检测
export class IdleToolDetector implements IDetector {
  name = 'idle-tool'

  async check(input: ToolUseInput, ctx: DetectorContext): Promise<DetectorResult> {
    if (!['Edit', 'Write', 'MultiEdit'].includes(input.tool)) return { triggered: false }
    const recent = await ctx.eventBus.query({
      sessionId: input.sessionId,
      types: ['tool.failed', 'tool.completed'],
      limit: 10,
    })
    const failureIdx = recent.findIndex((e) => e.type === 'tool.failed')
    if (failureIdx < 0) return { triggered: false }
    const after = recent.slice(0, failureIdx)
    const investigation = ['Read', 'Grep', 'WebSearch', 'Bash']
    const hasInv = after.some((e) => investigation.includes((e.payload as { tool: string }).tool))
    if (!hasInv) {
      ctx.eventBus.emit('behavior.idle_tool', { tool: input.tool }, { sessionId: input.sessionId })
      return {
        triggered: true,
        severity: 'warn',
        reason: '检测到「工具闲置」：上次工具失败后未读任何文件/日志就直接改代码。请先 Read 相关文件或 Bash 看错误日志。',
        suggestion: 'Read failing test output OR Grep for similar patterns',
      }
    }
    return { triggered: false }
  }
}

// 3. 忙碌假象（来回反复修改同一文件）
export class BusyLoopDetector implements IDetector {
  name = 'busy-loop'

  async check(input: ToolUseInput, ctx: DetectorContext): Promise<DetectorResult> {
    if (input.tool !== 'Edit') return { triggered: false }
    const file = (input.args as { file_path?: string }).file_path
    if (!file) return { triggered: false }
    const edits = await ctx.eventBus.query({
      sessionId: input.sessionId,
      types: ['tool.completed'],
      filter: (e) => {
        const p = e.payload as { tool: string; args: { file_path?: string } }
        return p.tool === 'Edit' && p.args.file_path === file
      },
      limit: 5,
    })
    if (edits.length < 4) return { triggered: false }
    const seen = new Set<string>()
    let cycle = false
    for (const e of edits) {
      const p = e.payload as { args: { old_string?: string; new_string?: string } }
      const oldH = createHash('md5').update(p.args.old_string ?? '').digest('hex').slice(0, 8)
      const newH = createHash('md5').update(p.args.new_string ?? '').digest('hex').slice(0, 8)
      if (seen.has(`${newH}:${oldH}`)) { cycle = true; break }
      seen.add(`${oldH}:${newH}`)
    }
    if (cycle) {
      ctx.eventBus.emit('behavior.busy_loop', { file }, { sessionId: input.sessionId })
      return {
        triggered: true,
        severity: 'block',
        reason: `检测到「忙碌假象」：你在 ${file} 反复来回修改。停下来——这次修改是否产生新信息？没有 = 换思路。`,
      }
    }
    return { triggered: false }
  }
}

// 4. 声称完成但未验证
export class PrematureDoneDetector implements IDetector {
  name = 'premature-done'

  async check(input: StopInput, ctx: DetectorContext): Promise<DetectorResult> {
    const edits = await ctx.eventBus.query({
      sessionId: input.sessionId,
      types: ['tool.completed'],
      filter: (e) => ['Edit', 'Write', 'MultiEdit'].includes((e.payload as { tool: string }).tool),
    })
    if (edits.length === 0) return { triggered: false }
    const verifications = await ctx.eventBus.query({
      sessionId: input.sessionId,
      types: ['tool.completed'],
      filter: (e) => {
        const p = e.payload as { tool: string; args: { command?: string } }
        return p.tool === 'Bash' && /test|lint|build|typecheck/i.test(p.args.command ?? '')
      },
    })
    if (verifications.length === 0) {
      ctx.eventBus.emit('behavior.premature_done', { reason: 'no_verification' }, { sessionId: input.sessionId })
      return {
        triggered: true,
        severity: 'block',
        reason: '检测到「声称完成但未验证」：本会话修改了代码，但未运行任何 test/lint/build。请先运行验证命令。',
        suggestion: 'pnpm test  (or your project test command)',
      }
    }
    const lastVerify = verifications[0]
    const lastEdit = edits[0]
    if (lastVerify.timestamp < lastEdit.timestamp) {
      return {
        triggered: true,
        severity: 'block',
        reason: '修改了代码但最后一次验证是修改之前运行的。请重新运行验证。',
      }
    }
    return { triggered: false }
  }
}

// 5. 甩锅检测
export class BlameShiftDetector implements IDetector {
  name = 'blame-shift'
  private patterns = [
    /可能是环境问题/i,
    /建议你?手动/i,
    /maybe (an?|the) (environment|version|setup)/i,
    /not sure why/i,
    /unable to (determine|figure out|resolve)/i,
  ]

  async check(input: ToolResultInput, ctx: DetectorContext): Promise<DetectorResult> {
    const text = input.output ?? ''
    if (!this.patterns.some((p) => p.test(text))) return { triggered: false }
    const verifications = await ctx.eventBus.query({
      sessionId: input.sessionId,
      types: ['tool.completed'],
      filter: (e) => (e.payload as { tool: string }).tool === 'Bash',
      limit: 5,
    })
    if (verifications.length < 2) {
      ctx.eventBus.emit('behavior.blame_shift', { sessionId: input.sessionId }, { sessionId: input.sessionId })
      return {
        triggered: true,
        severity: 'warn',
        reason: '检测到「甩锅」迹象：你说"可能是环境问题"但未做足够验证。至少：\n1. 验证版本 2. 验证依赖 3. 重现问题。\n证据齐了再下结论。',
      }
    }
    return { triggered: false }
  }
}
