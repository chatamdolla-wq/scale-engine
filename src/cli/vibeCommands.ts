// SCALE Engine — Vibe Commands
// 一键启动高质量提示词工作流
// 参考: easy-vibe + vibe-coding-prompt-template

import { defineCommand } from 'citty'
import { PhasePromptRegistry, type VibePhase, type PromptPack } from '../prompts/PhasePromptRegistry.js'
import { join } from 'node:path'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { logger } from '../core/logger.js'

const registry = new PhasePromptRegistry()

// ============================================================================
// scale vibe — 显示可用提示词模板
// ============================================================================

export const vibeCommand = defineCommand({
  meta: {
    name: 'vibe',
    description: '一键启动高质量提示词工作流',
  },
  args: {
    phase: {
      type: 'string',
      alias: 'p',
      description: '指定阶段 (idea/research/prd/design/agents/build)',
    },
    pack: {
      type: 'string',
      alias: 'k',
      description: '使用预定义组合包 (full-mvp/quick-prototype/developer-path/vibe-coder-path)',
    },
    app: {
      type: 'string',
      alias: 'a',
      description: '应用名称（用于填充模板变量）',
    },
    output: {
      type: 'string',
      alias: 'o',
      description: '输出文件路径（默认 stdout）',
    },
    interactive: {
      type: 'boolean',
      alias: 'i',
      description: '交互式模式（逐步引导）',
      default: false,
    },
  },
  run: async ({ args }) => {
    const phase = args.phase as VibePhase | undefined
    const packId = args.pack as string | undefined
    const appName = args.app as string | undefined
    const outputPath = args.output as string | undefined
    const interactive = args.interactive as boolean

    // ========== 显示所有可用模板 ==========
    if (!phase && !packId) {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║            SCALE Engine — Vibe Coding Templates              ║
╚══════════════════════════════════════════════════════════════╝

内置高质量提示词模板，一键启动专业工作流。

## 提示词组合包

| ID | 名称 | 阶段 | 适用人群 |
|----|------|------|----------|
| full-mvp | 完整 MVP 工作流 | idea → research → prd → design → agents → build | 所有用户 |
| quick-prototype | 快速原型 | prd → agents → build | 快速验证 |
| developer-path | 开发者路径 | research → prd → design → agents → build | 有经验开发者 |
| vibe-coder-path | Vibe Coder 路径 | idea → prd → agents → build | 初学者 |

## 单阶段提示词

| 阶段 | 命令 | 预估时间 | 输出文件 |
|------|------|----------|----------|
| idea | scale vibe --phase idea | 15-20 min | docs/idea-validation.md |
| research | scale vibe --phase research | 20-30 min | docs/research-{App}.md |
| prd | scale vibe --phase prd | 15-20 min | docs/PRD-{App}-MVP.md |
| design | scale vibe --phase design | 15-20 min | docs/TechDesign-{App}-MVP.md |
| agents | scale vibe --phase agents | 1-2 min | AGENTS.md |
| build | scale vibe --phase build | 1-3 hrs | — |

## 快速开始示例

# 完整 MVP 流程
scale vibe --pack full-mvp --app "MyExpenseTracker"

# 跳过研究，快速原型
scale vibe --pack quick-prototype --app "MyApp"

# 单阶段启动（生成 PRD）
scale vibe --phase prd --app "MyApp" --output docs/PRD-MyApp.md

# 交互式引导
scale vibe --interactive
`)
      return
    }

    // ========== 使用组合包 ==========
    if (packId) {
      const pack = registry.getPack(packId)
      if (!pack) {
        console.error(`❌ 未找到组合包: ${packId}`)
        console.error('可用组合包: full-mvp, quick-prototype, developer-path, vibe-coder-path')
        process.exit(1)
      }

      console.log(`
╔══════════════════════════════════════════════════════════════╗
║  启动工作流: ${pack.name}
╚══════════════════════════════════════════════════════════════╝

阶段: ${pack.phases.join(' → ')}

将生成以下提示词，请在 AI Chat 或 IDE 中依次使用：
`)
      for (const phase of pack.phases) {
        const prompts = registry.getPromptByPhase(phase)
        for (const prompt of prompts) {
          console.log(`\n## ${prompt.name} (${prompt.estimatedTime})`)
          console.log(`输出文件: ${prompt.outputFile || '—'}`)
          console.log(`\n使用方式:\nscale vibe --phase ${phase} --app "${appName || 'YourApp'}"\n`)
        }
      }
      return
    }

    // ========== 单阶段提示词 ==========
    if (phase) {
      const prompts = registry.getPromptByPhase(phase)
      if (prompts.length === 0) {
        console.error(`❌ 未找到阶段: ${phase}`)
        console.error('可用阶段: idea, research, prd, design, agents, build')
        process.exit(1)
      }

      const prompt = prompts[0]
      const generatedPrompt = registry.generatePrompt(prompt.id, {
        appName: appName,
        userLevel: 'intermediate',
      })

      if (outputPath) {
        // 确保目录存在
        const dir = join(outputPath, '..')
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true })
        }
        writeFileSync(outputPath, generatedPrompt, 'utf-8')
        console.log(`✅ 提示词已生成: ${outputPath}`)
        console.log(`\n阶段: ${prompt.name}`)
        console.log(`预估时间: ${prompt.estimatedTime}`)
        console.log(`\n下一步: 将此提示词复制到 AI Chat 或 IDE 中执行`)
      } else {
        // 输出到 stdout
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║  ${prompt.name} (${prompt.phase})
║  预估时间: ${prompt.estimatedTime}
╚══════════════════════════════════════════════════════════════╝

${generatedPrompt}
`)
      }
      return
    }

    // ========== 交互式模式 ==========
    if (interactive) {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║           SCALE Engine — Vibe Coding 交互引导               ║
╚══════════════════════════════════════════════════════════════╝

欢迎使用 SCALE Engine Vibe Coding 工作流！

请选择你的技术背景：
  A) Vibe-coder — 有想法但编程经验有限
  B) Developer — 有编程经验
  C) 中间 — 知道一些基础但还在学习

请输入 A、B 或 C：
`)
      // TODO: 实现完整交互流程
      return
    }
  },
})

// ============================================================================
// scale vibe-next — 推荐下一阶段提示词
// ============================================================================

export const vibeNextCommand = defineCommand({
  meta: {
    name: 'vibe-next',
    description: '基于当前阶段推荐下一阶段提示词',
  },
  args: {
    current: {
      type: 'string',
      alias: 'c',
      description: '当前阶段',
      required: true,
    },
  },
  run: async ({ args }) => {
    const currentPhase = args.current as VibePhase
    const nextPrompt = registry.getNextPrompt(currentPhase)

    if (!nextPrompt) {
      console.log('✅ 所有阶段已完成！可以开始构建 MVP。')
      console.log('\n使用: scale vibe --phase build')
      return
    }

    console.log(`
## 推荐下一阶段: ${nextPrompt.name}

预估时间: ${nextPrompt.estimatedTime}
输出文件: ${nextPrompt.outputFile || '—'}

生成提示词:
scale vibe --phase ${nextPrompt.phase}
`)
  },
})

// ============================================================================
// scale vibe-index — 生成提示词索引文档
// ============================================================================

export const vibeIndexCommand = defineCommand({
  meta: {
    name: 'vibe-index',
    description: '生成提示词模板索引文档',
  },
  args: {
    output: {
      type: 'string',
      alias: 'o',
      description: '输出文件路径（默认 docs/VIBE-TEMPLATES.md）',
      default: 'docs/VIBE-TEMPLATES.md',
    },
  },
  run: async ({ args }) => {
    const outputPath = args.output as string
    const indexMd = registry.generateIndexMd()

    const dir = join(outputPath, '..')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(outputPath, indexMd, 'utf-8')

    console.log(`✅ 提示词索引已生成: ${outputPath}`)
  },
})