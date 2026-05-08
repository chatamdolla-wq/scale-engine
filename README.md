<p align="center">
  <img src="https://img.shields.io/badge/version-0.8.0-orange?style=flat-square" alt="version" />
  <img src="https://img.shields.io/badge/agents-12-blue?style=flat-square" alt="agents" />
  <img src="https://img.shields.io/badge/workflows-10-green?style=flat-square" alt="workflows" />
  <img src="https://img.shields.io/badge/detectors-9-red?style=flat-square" alt="detectors" />
  <img src="https://img.shields.io/badge/tests-410-passing-brightgreen?style=flat-square" alt="tests" />
  <img src="https://img.shields.io/badge/npm-0.8.0-cb3837?style=flat-square&logo=npm" alt="npm" />
</p>

# SCALE Engine v0.8.0

> **S**caffold · **C**ontrol · **A**rtifact · **L**earn · **E**volve
>
> AI 工程化脚手架引擎 — 让 AI Agent 在物理约束下工作，而不是靠提示词自律

---

## 📦 仓库地址

| 平台 | 地址 |
|------|------|
| **GitHub** | https://github.com/hongmaple0820/scale-engine |
| **Gitee (镜像)** | https://gitee.com/hongmaple/scale-engine |
| **npm** | https://www.npmjs.com/package/@hongmaple0820/scale-engine |

**语言版本：** [中文文档](README.md) | [English Documentation](README.en.md)

---

## 📖 目录

- [项目介绍](#-项目介绍)
- [技术架构](#-技术架构)
- [功能特性](#-功能特性)
- [快速开始](#-快速开始)
- [完整 API 参考](#-完整-api-参考)
- [社区与推广](#-社区与推广)
- [CHANGELOG](#-changelog)
- [贡献指南](#-贡献指南)

---

## 🎯 项目介绍

### 什么是 SCALE Engine？

SCALE Engine 是一个 **AI 工程化脚手架引擎**，为 AI Agent（Claude Code、Codex CLI、OpenCode、Cursor、Gemini CLI 等）提供物理约束层，确保 AI 在编码过程中遵循工程规范，而不是依赖提示词的"自律"。

### 为什么需要它？

当前 AI 编码的核心矛盾：

```
❌ 提示词说 "你应该跑测试"    → AI 可以假装跑了
❌ 提示词说 "不要硬编码密钥"  → AI 可以忽视规则
❌ 提示词说 "别暴力重试"      → AI 可以反复重试
❌ 提示词说 "先规划再写代码"  → AI 可以跳过规划直接写
```

**根本问题**：提示词是"建议"，AI 可以选择性遵守。这就是为什么你经常看到：

- AI 声称"已完成"但没跑测试
- AI 反复用同一策略重试失败
- AI 甩锅给"环境问题"但没验证
- AI 在同一个文件来回修改
- AI 硬编码密钥到代码中

SCALE Engine 的解决方案：**物理约束**。

```
✅ Stop Hook 检查 "未跑测试"  → AI 物理无法跳过
✅ PreTool Hook 拦截危险命令  → AI 物理无法执行
✅ FSM 状态机控制工作流       → AI 物理无法跳步
✅ Role 网关限制工具权限      → AI 物理无法越权
✅ 检测器发现异常行为         → AI 物理无法隐藏
```

### 它是如何工作的？

SCALE Engine 通过 **六层架构** 实现 AI 工程化：

| 层级 | 职责 | 核心机制 |
|------|------|---------|
| **L1 Context** | 上下文构建 | Token 预算 + 哲学注入 + 场景感知 |
| **L2 Guardrails** | 安全护栏 | 9 检测器 + Role 网关 + 级联升级 |
| **L3 Observability** | 可观测性 | EventBus + BehaviorTracker + 模式检测 |
| **L4 Orchestration** | 任务编排 | TaskEngine + Effects + 10 工作流 |
| **L5 Memory** | 知识记忆 | KnowledgeBase + 衰减算法 + 技能发现 |
| **L6 Evolution** | 自进化 | Defect→Lesson→Rule→Hook 闭环 |

### 核心哲学

```
提示词自律 ❌                          物理约束 ✅
─────────────────────────────────────────────────────
"你应该跑测试"                   →   Stop Hook 物理拦截未验证的完成
"不要硬编码密钥"                 →   PreTool Hook 物理阻止密钥写入
"别暴力重试"                     →   BruteRetry 检测器 3次强制换策略
"先规划再编码"                   →   FSM 状态机 Plan APPROVED 才能实现
"声称完成要验证"                  →   PrematureDone 检测器物理阻止
```

---

## 🏗️ 技术架构

### 六层架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCALE Engine v0.6.0                          │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  L6 Evolution — 自进化层                                  │  │
│  │  Defect → Lesson → Rule → Hook                           │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │  │
│  │  │Lesson    │→│Rule      │→│Hook      │→│Auto-     │    │  │
│  │  │Extractor │ │Proposer  │ │Generator │ │Enforce   │    │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  L5 Memory — 知识记忆层                                   │  │
│  │  KnowledgeBase + 衰减算法 + 技能发现                       │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                  │  │
│  │  │Knowledge │ │Decay     │ │Skill     │                  │  │
│  │  │Base      │ │Algorithm │ │Discovery │                  │  │
│  │  └──────────┘ └──────────┘ └──────────┘                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  L4 Orchestration — 任务编排层                             │  │
│  │  TaskEngine + Effects + ModelRouter + 10 工作流预设        │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │  │
│  │  │Task      │ │Effects   │ │Model     │ │Workflow  │    │  │
│  │  │Engine    │ │Wiring    │ │Router    │ │Presets   │    │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  L3 Observability — 可观测性层                             │  │
│  │  EventBus + BehaviorTracker + 6 种行为模式检测             │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                  │  │
│  │  │Event     │ │Behavior  │ │Session   │                  │  │
│  │  │Bus       │ │Tracker   │ │Metrics   │                  │  │
│  │  └──────────┘ └──────────┘ └──────────┘                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  L2 Guardrails — 安全护栏层                               │  │
│  │  9 检测器 + Role 网关 + 级联升级 L0→L3 + 场景模式敏感度   │  │
│  │  ┌─────────────────────────────────────────────────┐      │  │
│  │  │  Gateway                                          │      │  │
│  │  │  ┌─────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌───────┐ │      │  │
│  │  │  │Brute│ │Idle  │ │Busy  │ │Premat│ │Blame  │ │      │  │
│  │  │  │Retry│ │Tool  │ │Loop  │ │Done  │ │Shift  │ │      │  │
│  │  │  └─────┘ └──────┘ └──────┘ └──────┘ └───────┘ │      │  │
│  │  │  ┌─────┐ ┌──────┐ ┌──────┐ ┌──────┐          │      │  │
│  │  │  │Dang │ │Secret│ │Role  │ │Scope │          │      │  │
│  │  │  │Cmd  │ │Leak  │ │Gate  │ │Creep │          │      │  │
│  │  │  └─────┘ └──────┘ └──────┘ └──────┘          │      │  │
│  │  └─────────────────────────────────────────────────┘      │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  L1 Context — 上下文构建层                                │  │
│  │  Token 预算 + SCALE v10.0 哲学 + 场景模式感知             │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                  │  │
│  │  │Context   │ │SCALE v10 │ │Scenario  │                  │  │
│  │  │Builder   │ │Philosophy│ │Mode      │                  │  │
│  │  └──────────┘ └──────────┘ └──────────┘                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  11 Agent 平台适配器                                        │  │
│  │  Claude Code │ Codex CLI │ OpenCode │ Cursor │ Gemini │   │  │
│  │  OpenClaw │ Hermes │ Trae │ WorkBuddy │ VSC │ QCoder      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  12 专业 Agent Profiles                                    │  │
│  │  frontend │ backend │ test │ ui-design │ ops │ product    │  │
│  │  code-review │ security │ database │ perf │ docs │ arch   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐│
│  │  MCP Server          │  │  CLI (命令)                      ││
│  │  Model Context Proto │  │  scale init/doctor/agent/team... ││
│  └──────────────────────┘  └──────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### L1 Context — 上下文构建层

ContextBuilder 负责组装 AI 可见的上下文，采用 **分层优先级 + Token 预算** 策略：

```
优先级   层级              内容                     预估 Token
───────────────────────────────────────────────────────────────
P1      system_rules     SCALE v10.0 哲学           ~3,500
P1.5    scenario_mode    场景模式感知               ~800
P2      role_prompt      当前角色提示词             ~1,500
P3      current_artifact 当前 Artifact 上下文        ~5,000
P5      recalled_lessons 召回的历史经验             ~1,500
───────────────────────────────────────────────────────────────
总计                     总预算: 200K, 保留: 30K     ~12,300
```

**SCALE v10.0 核心哲学（P1 层，不可绕过）**：

- 🧠 **认知诚实**：不确定→`[UNCERTAIN]`，严禁幻觉式合规
- 🔍 **显性推理**：`<think reasoning="effort">` before action
- 👑 **Owner 意识**：做 Owner 不做执行者
- 🔥 **反惰性**：暴力重试→换策略 | 甩锅→先验证 | 工具闲置→穷尽工具 | 忙碌假象→换思路
- 📐 **1% 规则**：有 1% 可能→必须调用技能
- ✅ **验证门控**：✅ 只来自工具，不来自脑补

### L2 Guardrails — 安全护栏层

**9 个检测器**，覆盖 3 个 Hook 阶段：

| # | 检测器 | Hook 阶段 | 严重度 | 说明 |
|---|--------|----------|--------|------|
| 1 | `DangerousCommand` | PreTool | deny | 拦截 `rm -rf`、`DROP TABLE`、`curl|bash`、`chmod 777` 等危险命令 |
| 2 | `SecretLeak` | PreTool | block | 拦截硬编码 AWS Key、OpenAI Key、GitHub PAT、密码、私钥 |
| 3 | `RoleGate` | PreTool | deny | 角色权限控制（Explorer/Planner/Implementer/Reviewer） |
| 4 | `BruteRetry` | PreTool | block | 3 分钟内相同工具+参数 ≥3 次 → 强制换策略 |
| 5 | `IdleTool` | PreTool | warn | 工具失败后未调查（Read/Grep）就改代码 |
| 6 | `BusyLoop` | PreTool | block | 同一文件来回反复修改（检测 old↔new 循环） |
| 7 | `PrematureDone` | BeforeStop | block | 修改了代码但未运行 test/lint/build |
| 8 | `BlameShift` | PostTool | warn | 甩锅给环境但未做足够验证 |
| 9 | `ScopeCreep` | PreTool | warn | 检测任务范围蔓延，偏离原始 Spec |

**Role 网关**：4 种内置角色，物理限制工具权限

| 角色 | 允许的工具 | 禁止的工具 |
|------|-----------|-----------|
| 🔍 Explorer | Read, Grep, Glob, WebSearch, Bash | Edit, Write, MultiEdit |
| 📋 Planner | Read, Grep, Glob, Write | Bash |
| 🔨 Implementer | Read, Grep, Glob, Edit, Write, MultiEdit, Bash | — |
| 👁️ Reviewer | Read, Grep, Glob, Bash | Edit, Write, MultiEdit |

**级联升级 L0→L3**：

```
L0  允许 (allow)    → 无异常，正常放行
L1  警告 (warn)     → 放行但注入上下文提醒
L2  阻断 (block)    → 拦截操作，必须修正后重试
L3  拒绝 (deny)     → 绝对拦截，不可绕过（危险命令/密钥泄露/越权）
```

**场景模式敏感度**：

| 模式 | 检测器敏感度 | 验证要求 | 人工确认 | 最大重试 |
|------|------------|---------|---------|---------|
| 🏖️ Sandbox | 低 | 不要求 | 不要求 | 10 |
| ⚙️ Standard | 中 | 要求 | 不要求 | 5 |
| 🔒 Critical | 高 | 要求 | 要求 | 3 |

### L3 Observability — 可观测性层

**EventBus**：全链路事件总线，支持发布/订阅 + 历史查询

```
事件类型覆盖：
├── Artifact 生命周期: created → updated → transitioned → gate_checked → deleted
├── 工具调用: called → completed / failed → blocked
├── 护栏: checked → passed / failed
├── 行为模式: brute_retry / idle_tool / busy_loop / premature_done / blame_shift / scope_creep
├── Role: activated / denied
├── Session: started → ended → compacted / cleared
├── Knowledge: proposed → approved / rejected → recalled → helpful / useless
├── Task: scheduled → started → checkpointed → paused → resumed → completed / failed
├── Evolution: rule.proposed → rule.enforced → hook.generated → evolution.cycle_completed
└── Context: built
```

**BehaviorTracker**：6 种行为模式检测 + 会话级指标统计

| 指标 | 说明 |
|------|------|
| `toolCalls` | 工具调用总数 |
| `toolFailures` | 工具失败总数 |
| `bruteRetryCount` | 暴力重试次数 |
| `blameShiftCount` | 甩锅次数 |
| `prematureDoneCount` | 声称完成但未验证次数 |
| `artifactsCreated` | 创建的 Artifact 数 |
| `rolesUsed` | 使用的角色列表 |
| `modelsUsed` | 使用的模型统计 |

### L4 Orchestration — 任务编排层

**TaskEngine**：步骤执行 + Checkpoint + 失败恢复

**Effects 系统**：FSM 迁移时自动触发副作用（如 Plan APPROVED → 自动失效下游）

**ModelRouter**：多模型路由策略

```typescript
DEFAULT_MODELS = {
  fast: 'claude-3-5-haiku',    // 探索/规划
  standard: 'claude-3-5-sonnet', // 日常实现
  premium: 'claude-3-opus',     // 复杂推理/审查
}
```

**10 种工作流预设**：见 [功能特性](#-10-种工作流预设)

### L5 Memory — 知识记忆层

**KnowledgeBase**（双引擎）：

- **InMemory** — 内存版，适合开发/测试
- **SQLiteKnowledgeBase** — 持久化版，基于 better-sqlite3 + drizzle-orm，WAL 模式
- 支持按标签、类型、相关性召回
- 向量相似度检索（预留 embedding 接口）
- 衰减算法：知识条目随时间衰减 `relevance`，被访问后提升
- 知识类型：`lesson` | `pattern` | `best_practice` | `anti_pattern` | `decision` | `troubleshooting` | `workflow` | `reference`

**SkillDiscovery**：自动检测 Agent 平台 → 扫描技能目录 → 生成 `skills.md`

### L6 Evolution — 自进化层

**4 级自进化闭环**：

```
Defect (closed) → Lesson (extracted) → Rule (proposed) → Hook (generated)
     3 Gates:          2 Gates:           2 Gates:         1 Gate:
     状态+根因+去重     verified+active    relevance≥0.6    approved
                       accessCount≥3      accessCount≥3    enforcement=hook
```

| 级别 | 输入 → 输出 | 门控条件 |
|------|------------|---------|
| **1. Lesson 提取** | Defect → Lesson | 状态 ≥ DIAGNOSED + rootCause ≠ unknown + 标题去重 |
| **2. Rule 提议** | Lesson → Rule | verified=true + relevance≥0.6 + accessCount≥3 |
| **3. Hook 生成** | Rule → Hook | approved=true + enforcement=hook |
| **4. 自动执行** | Hook → 物理约束 | 脚本部署到 hooks 目录，Agent 启动时自动加载 |

---

## ✨ 功能特性

### 11 种 Agent 适配器

| Agent | 配置文件 | 知识文档 | 技能目录 | 特色能力 |
|-------|---------|---------|---------|---------|
| 🟠 **Claude Code** | `.claude/settings.json` | `CLAUDE.md` | `.claude/commands/` | OMC + 多模型 + Hooks + Autopilot |
| 🔵 **Codex CLI** | `.codex/hooks.json` + `config.toml` | `AGENTS.md` | `.codex/commands/` | OMX + $Commands + tmux + 多模型 |
| 🟢 **OpenCode** | `~/.config/opencode/hooks.json` | `AGENTS.md` | `~/.config/opencode/skills/` | OmO + 多模型 + AST-Grep + 开放 |
| 🟣 **Cursor** | `.cursor/settings.json` | `.cursorrules` | `.cursor/skills/` | IDE 集成 + gstack + 设计优先 |
| 🔴 **Gemini** | `.gemini/settings.json` | `GEMINI.md` | — | Google 生态 + gstack + 免费额度 |
| 🟡 **OpenClaw** | `.openclaw/settings.json` | `AGENTS.md` | — | 开源 Agent 框架 |
| 🟤 **Hermes** | `.hermes/settings.json` | `.hermes.md` | — | 轻量级 Agent |
| 🟦 **Trae** | `.trae/settings.json` | `TRAE.md` | — | 字节跳动 AI 编程助手 |
| 🟪 **WorkBuddy** | `.workbuddy/settings.json` | `WORKBUDDY.md` | — | 腾讯 CodeBuddy 团队协作 |
| 🟦 **VSC** | `.vscode/scale.json` | `VSC.md` | — | VS Code Copilot CLI |
| 🟧 **QCoder** | `.qwen/settings.json` | `QWEN.md` | — | 阿里通义千问 Code CLI |

**统一工厂函数**：

```typescript
import { createAdapter, SUPPORTED_AGENTS } from '@hongmaple0820/scale-engine'

const adapter = createAdapter('claude-code', { scenarioMode: 'critical' })
const result = await adapter.init() // 生成配置文件 + hooks + 知识文档
```

### 3 种场景模式

| 模式 | Emoji | 适用场景 | 检测器敏感度 | 验证要求 | 人工确认 | 最大重试 |
|------|-------|---------|------------|---------|---------|---------|
| **Sandbox** | 🏖️ | 探索/原型/学习 | 低 | 不要求 | 不要求 | 10 |
| **Standard** | ⚙️ | 日常开发/Bug修复 | 中 | 要求 | 不要求 | 5 |
| **Critical** | 🔒 | 安全审计/生产部署 | 高 | 要求 | 要求 | 3 |

### 10 种工作流预设

| # | 工作流 | 场景 | 步骤数 | 核心流程 |
|---|--------|------|--------|---------|
| 1 | 🚀 基础开发流 | Standard | 8 | Explore→Spec→Plan→Implement→Verify |
| 2 | 🧪 TDD 功能开发 | Standard | 7 | RED→GREEN→REFACTOR（测试先行） |
| 3 | 🐛 Bug 修复 | Standard | 7 | 复现→诊断→修复→验证→沉淀 |
| 4 | 📜 SDD | Critical | 11 | 严格契约驱动，ambiguity ≤ 0.1 |
| 5 | 👁️ 代码审查 | Standard | 7 | 风格→逻辑→安全→性能 |
| 6 | 🔐 安全审计 | Critical | 8 | 密钥→注入→认证→数据→依赖 |
| 7 | 🤖 Ralph 自主循环 | Sandbox | 7 | 全自动 AI 循环 |
| 8 | ⚡ 快速原型 | Sandbox | 4 | 最小仪式，快速验证 |
| 9 | 🏗️ 大规模重构 | Critical | 8 | 增量重构 + 测试护城河 |
| 10 | ⚡ 并行执行 | Standard | 7 | 依赖分析 + 并行任务执行 |

### 9 个检测器

| # | 检测器 | Hook 阶段 | 严重度 | 说明 |
|---|--------|----------|--------|------|
| 1 | 🛑 `DangerousCommand` | PreTool | deny | 拦截 `rm -rf`、`DROP TABLE`、`curl|bash`、`chmod 777`、fork bomb 等 12 种危险模式 |
| 2 | 🔑 `SecretLeak` | PreTool | block | 拦截 AWS Key、OpenAI Key、GitHub PAT、私钥、硬编码密码等 6 种密钥模式 |
| 3 | ⛔ `RoleGate` | PreTool | deny | 4 种内置角色（Explorer/Planner/Implementer/Reviewer）物理限制工具权限 |
| 4 | 🔄 `BruteRetry` | PreTool | block | 3 分钟内相同工具+参数 ≥3 次 → 强制换策略 |
| 5 | 🔧 `IdleTool` | PreTool | warn | 工具失败后未调查（Read/Grep/Bash）就改代码 |
| 6 | 🔁 `BusyLoop` | PreTool | block | 同一文件来回反复修改（MD5 哈希检测循环） |
| 7 | ✋ `PrematureDone` | BeforeStop | block | 修改了代码但未运行 test/lint/build，或验证早于最后修改 |
| 8 | 🤷 `BlameShift` | PostTool | warn | 检测"可能是环境问题"等 5 种甩锅模式 |
| 9 | 📏 `ScopeCreep` | PreTool | warn | 检测任务范围蔓延，偏离原始 Spec 定义 |

### 级联升级 L0→L3

```
               ┌──────────────────────────────────────┐
               │        Gateway 级联升级决策            │
               └──────────────────────────────────────┘
                              │
                 ┌────────────┼────────────┐
                 ▼            ▼            ▼
           ┌─────────┐ ┌─────────┐ ┌─────────┐
           │ L0      │ │ L1      │ │ L2/L3   │
           │ 允许    │ │ 警告    │ │ 阻断    │
           │ allow   │ │ warn    │ │ block/  │
           │         │ │         │ │ deny    │
           └─────────┘ └─────────┘ └─────────┘
               │            │            │
               ▼            ▼            ▼
          正常放行    注入上下文    拦截操作
          emit event   提醒AI      必须修正
```

### 6 种行为模式检测

| 行为模式 | 事件名 | 检测逻辑 |
|---------|--------|---------|
| 🔄 暴力重试 | `behavior.brute_retry` | 3 分钟内相同工具+参数 ≥3 次 |
| 🔧 工具闲置 | `behavior.idle_tool` | 失败后未 Read/Grep 就改代码 |
| 🔁 忙碌假象 | `behavior.busy_loop` | 同一文件 old↔new 循环修改 |
| ✋ 声称完成 | `behavior.premature_done` | 修改代码但未运行验证 |
| 🤷 甩锅推诿 | `behavior.blame_shift` | 甩锅环境但无验证证据 |
| 📏 范围蔓延 | `behavior.scope_creep` | 实现超出 Spec 定义的范围 |

### 11 种 Artifact FSM

```
Need ──refine──→ Insight ──verify──→ Spec ──approve──→ Plan ──approve──→ TestPlan
                                    │                  │
                                    ↓                  ↓
                                  Task ←──schedule── Ready
                                    │
                                implement
                                    │
                                    ↓
                                  Change ──commit──→ Evidence ──pass──→ Release
                                    │
                                    ↓
                                  Defect ──diagnose──→ Lesson ──evolve──→ Rule → Hook
```

| Artifact | 初始状态 | 终态 | 关键 Guard |
|----------|---------|------|-----------|
| Need | DRAFT | FULFILLED, ABANDONED | — |
| Insight | DRAFT | INVALIDATED | — |
| Spec | DRAFT | OBSOLETED | ambiguity ≤ 0.2, has successCriteria |
| Plan | DRAFT | SUPERSEDED | has rollbackStrategy |
| TestPlan | DRAFT | PASSED, FAILED | — |
| Task | PENDING | COMPLETED, FAILED, CANCELLED | build+lint+test 全通过 |
| Change | DRAFT | REVERTED | — |
| Evidence | COLLECTED | PASS, FAIL | — |
| Defect | OPEN | CLOSED, DUPLICATE | has rootCauseCategory ≠ unknown |
| Lesson | PROPOSED | REJECTED, SUPERSEDED | verified → active → evolve |
| Release | PLANNED | DEPLOYED, ROLLED_BACK | — |

### 4 级自进化

| 级别 | 转化 | 门控 | 产出 |
|------|------|------|------|
| 1️⃣ Lesson 提取 | Defect → Lesson | 状态 ≥ DIAGNOSED + rootCause ≠ unknown + 去重 | 知识条目入库 |
| 2️⃣ Rule 提议 | Lesson → Rule | verified + relevance≥0.6 + accessCount≥3 | 规则提议（prompt/hook） |
| 3️⃣ Hook 生成 | Rule → Hook | approved + enforcement=hook | 自动生成 Hook 脚本 |
| 4️⃣ 自动执行 | Hook → 物理约束 | 部署到 `.scale/hooks/` | AI 物理无法绕过 |

### 15 个 CLI 命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `scale init` | 初始化项目 | `scale init --agent claude-code --scenario critical` |
| `scale doctor` | 环境诊断 + 健康检查 | `scale doctor` |
| `scale create` | 创建 Artifact（11 种） | `scale create Spec "用户导出功能"` |
| `scale list` | 列表查询 | `scale list --type Task --status RUNNING` |
| `scale show` | 详情 | `scale show SPEC-20260421-0007` |
| `scale suggest` | 可用操作建议 | `scale suggest SPEC-20260421-0007` |
| `scale transition` | 状态迁移（含 guard） | `scale transition SPEC-xxx approve` |
| `scale verify-task` | 代码质量验证 | `scale verify-task TASK-xxx` |
| `scale create-prd` | 自动创建 Spec→Plan→Tasks | `scale create-prd "支付功能"` |
| `scale role` | 角色切换 | `scale role activate implementer` |
| `scale context` | 上下文组装 | `scale context status --session-id xxx` |
| `scale context inject` | SessionStart FSM 注入 | `scale context inject --session-id xxx` |
| `scale evolve` | 进化周期 | `scale evolve` |
| `scale stats` | 统计 | `scale stats` |
| `scale workflow` | 工作流预设管理 | `scale workflow list --scenario critical` |
| `scale skill` | 技能发现 | `scale skill scan` |

### MCP Server 集成

SCALE Engine 内置 MCP Server，可被任何支持 Model Context Protocol 的 Agent 直接调用：

```bash
# 启动 MCP Server
scale mcp

# 在 Claude Code 中配置
claude mcp add scale-engine -- node dist/api/mcp.js
```

---

## 🚀 快速开始

### 安装

```bash
npm install -g @hongmaple0820/scale-engine
```

### 初始化项目

```bash
cd your-project

# 基础初始化
scale init --agent claude-code

# 指定场景模式
scale init --agent claude-code --scenario sandbox    # 🏖️ 探索/原型
scale init --agent claude-code --scenario standard   # ⚙️ 日常开发（默认）
scale init --agent claude-code --scenario critical   # 🔒 生产/安全

# 支持 11 种 Agent
scale init --agent codex          # Codex CLI
scale init --agent opencode       # OpenCode
scale init --agent cursor         # Cursor
scale init --agent gemini         # Gemini
scale init --agent openclaw       # OpenClaw
scale init --agent hermes         # Hermes
scale init --agent trae           # 字节 Trae
scale init --agent workbuddy      # 腾讯 WorkBuddy
scale init --agent vsc            # VS Code Copilot CLI
scale init --agent qcoder         # 阿里 Qwen Code
```

### 环境诊断

```bash
scale doctor
```

### 工作流管理

```bash
# 查看所有 10 种工作流
scale workflow list

# 按场景筛选
scale workflow list --scenario critical
```

### 技能发现

```bash
# 自动检测 Agent 平台，扫描技能目录，生成 skills.md
scale skill scan
```

### 日常使用示例

```bash
# 📜 创建需求
scale create Spec "用户导出 Excel 功能"

# 🔄 迭代优化
scale transition SPEC-xxx refine

# ✅ 审批（ambiguity > 0.2 会被物理拦截）
scale transition SPEC-xxx approve

# 📋 创建计划
scale create Plan

# ✅ 审批计划
scale transition PLAN-xxx approve

# 🔨 创建任务
scale create Task "实现 Excel 导出接口"

# ✅ 验证任务（build + lint + test）
scale verify-task TASK-xxx

# ✋ 完成任务
scale transition TASK-xxx complete

# 🧬 触发自进化
scale evolve
```

### 编程式使用

```typescript
import {
  EventBus, Container, logger,
  FSM, InMemoryArtifactStore,
  registerAllFSMs, INITIAL_STATES,
  Gateway, BruteRetryDetector, PrematureDoneDetector,
  ContextBuilder, KnowledgeBase, EvolutionEngine,
  createAdapter, SUPPORTED_AGENTS,
  SkillDiscovery,
  listWorkflowPresets, getPresetsByScenario,
} from '@hongmaple0820/scale-engine'

// 1. 初始化核心基础设施
const eventBus = new EventBus()
const store = new InMemoryArtifactStore()
const fsm = new FSM(store, eventBus)
registerAllFSMs(fsm)

// 2. 初始化护栏
const gateway = new Gateway(eventBus)
gateway.registerDetector(new BruteRetryDetector(), 'preTool')
gateway.registerDetector(new PrematureDoneDetector(), 'beforeStop')

// 3. 初始化上下文构建器
const kb = new KnowledgeBase(eventBus)
const contextBuilder = new ContextBuilder(store, kb, eventBus)

// 4. 构建 Agent 适配器
const adapter = createAdapter('claude-code', { scenarioMode: 'standard' })
const initResult = await adapter.init()
console.log('生成的配置文件:', initResult.files)
```

---

## 📚 完整 API 参考

### 核心基础设施

| 导出 | 类型 | 说明 |
|------|------|------|
| `EventBus` | Class | 全链路事件总线，支持 on/emit/query |
| `IEventBus` | Interface | EventBus 接口定义 |
| `Container` | Class | 依赖注入容器 |
| `container` | Instance | 全局默认容器实例 |
| `createToken` | Function | 创建 DI Token |
| `logger` | Instance | Pino 日志实例 |

### Artifact + FSM

| 导出 | 类型 | 说明 |
|------|------|------|
| `FSM` | Class | 通用有限状态机引擎 |
| `SpecFSM` | Constant | Spec 类型 FSM 定义 |
| `InMemoryArtifactStore` | Class | 内存 Artifact 存储 |
| `IArtifactStore` | Interface | Artifact 存储接口 |
| `registerAllFSMs` | Function | 注册全部 11 种 FSM |
| `INITIAL_STATES` | Constant | 各 Artifact 初始状态映射表 |

### 类型系统（从 `./artifact/types.js` 导出）

| 导出 | 类型 | 说明 |
|------|------|------|
| `Artifact<T>` | Interface | 通用 Artifact 结构 |
| `ArtifactType` | Type | 11 种 Artifact 类型联合 |
| `ArtifactId` | Type | `SPEC-20260421-0007` 格式 ID |
| `NeedPayload` | Interface | Need 载荷 |
| `InsightPayload` | Interface | Insight 载荷 |
| `SpecPayload` | Interface | Spec 载荷 |
| `PlanPayload` | Interface | Plan 载荷 |
| `TestPlanPayload` | Interface | TestPlan 载荷 |
| `TaskPayload` | Interface | Task 载荷（含 buildStatus/lintStatus/testPassed） |
| `ChangePayload` | Interface | Change 载荷 |
| `EvidencePayload` | Interface | Evidence 载荷 |
| `DefectPayload` | Interface | Defect 载荷（含 rootCauseCategory） |
| `LessonPayload` | Interface | Lesson 载荷（8 种类型） |
| `ReleasePayload` | Interface | Release 载荷 |
| `PayloadOf<T>` | Type | 根据 ArtifactType 推断 Payload 类型 |
| `Event<T>` | Interface | 事件结构 |
| `EventType` | Type | 50+ 种事件类型联合 |
| `FSMDefinition` | Interface | FSM 定义结构 |
| `TransitionDef` | Interface | 状态迁移定义 |
| `Guard` | Interface | 门控条件 |
| `Effect` | Interface | 迁移副作用 |
| `ScenarioMode` | Type | `'sandbox' \| 'standard' \| 'critical'` |
| `ScenarioModeConfig` | Interface | 场景模式配置 |
| `SCENARIO_MODE_CONFIGS` | Constant | 3 种场景模式预设 |
| `AgentPlatform` | Type | 11 种 Agent 平台联合类型 |
| `SkillRef` | Interface | 技能引用 |
| `SkillScanResult` | Interface | 技能扫描结果 |
| `WorkflowPreset` | Interface | 工作流预设 |
| `WorkflowStep` | Interface | 工作流步骤 |
| `ScaleError` | Class | 基础错误类 |
| `InvalidTransitionError` | Class | 无效迁移错误 |
| `GuardFailedError` | Class | Guard 失败错误 |
| `RoleDeniedError` | Class | Role 拒绝错误 |
| `ArtifactNotFoundError` | Class | Artifact 未找到错误 |

### 护栏 (Guardrails)

| 导出 | 类型 | 说明 |
|------|------|------|
| `Gateway` | Class | Hook 网关，3 阶段检测（preTool/postTool/beforeStop） |
| `IDetector` | Interface | 检测器接口 |
| `DetectorContext` | Interface | 检测器上下文 |
| `BruteRetryDetector` | Class | 暴力重试检测器 |
| `IdleToolDetector` | Class | 工具闲置检测器 |
| `BusyLoopDetector` | Class | 忙碌假象检测器 |
| `PrematureDoneDetector` | Class | 声称完成但未验证检测器 |
| `BlameShiftDetector` | Class | 甩锅检测器 |
| `DangerousCommandDetector` | Class | 危险命令拦截器（rm -rf / DROP TABLE 等） |
| `SecretLeakDetector` | Class | 密钥泄露拦截器（AWS Key / GitHub PAT 等） |
| `RoleGateDetector` | Class | 角色权限拦截器（4 种内置角色） |
| `ScopeCreepDetector` | Class | 范围蔓延检测器（第 9 个） |
| `BUILT_IN_ROLES` | Constant | 内置角色定义（含工具权限矩阵） |
| `ROLES` | Constant | 角色常量 |
| `getRole` | Function | 获取角色 |
| `listRoles` | Function | 列出所有角色 |

### 上下文 (Context)

| 导出 | 类型 | 说明 |
|------|------|------|
| `ContextBuilder` | Class | 分层上下文构建器（P1-P5 + Token 预算） |
| `IContextBuilder` | Interface | ContextBuilder 接口 |
| `ContextLayer` | Interface | 上下文层结构 |
| `BuiltContext` | Interface | 构建结果 |
| `ContextStatus` | Interface | 上下文状态（含 constraints） |

### 编排 (Orchestration)

| 导出 | 类型 | 说明 |
|------|------|------|
| `TaskEngine` | Class | 任务引擎（步骤执行 + Checkpoint + 恢复） |
| `wireEffects` | Function | Effects 接线（FSM 迁移副作用） |

### 路由 (Routing)

| 导出 | 类型 | 说明 |
|------|------|------|
| `ModelRouter` | Class | 多模型路由策略 |
| `DEFAULT_MODELS` | Constant | 默认模型配置（Haiku/Sonnet/Opus） |

### 知识 (Knowledge)

| 导出 | 类型 | 说明 |
|------|------|------|
| `KnowledgeBase` | Class | 内存知识库（标签/向量召回 + 衰减算法） |
| `SQLiteKnowledgeBase` | Class | SQLite 持久化知识库（WAL 模式 + 并发安全） |
| `IKnowledgeBase` | Interface | 知识库统一接口 |

### 进化 (Evolution)

| 导出 | 类型 | 说明 |
|------|------|------|
| `BehaviorTracker` | Class | 行为追踪器（6 种模式 + 会话指标 + 自动触发进化） |
| `IBehaviorTracker` | Interface | 行为追踪接口 |
| `SessionMetrics` | Interface | 会话指标结构 |
| `AutoEvolveConfig` | Interface | 自动进化配置 |
| `AutoDefectCreator` | Class | 自动 Defect 创建器（从行为事件自动创建 Defect） |
| `IAutoDefectCreator` | Interface | AutoDefectCreator 接口 |
| `DefectPayload` | Interface | Defect 载荷（含 rootCauseCategory/severity） |
| `LessonExtractor` | Class | Lesson 提取器（Defect → Lesson） |
| `RuleProposer` | Class | Rule 提议器（Lesson → Rule） |
| `HookGenerator` | Class | Hook 生成器（Rule → Hook） |
| `EvolutionEngine` | Class | 进化引擎（编排 4 级闭环） |
| `ProposedRule` | Interface | 提议的规则结构 |
| `GeneratedHook` | Interface | 生成的 Hook 结构 |
| `EvolutionStats` | Interface | 进化统计 |

### FSM Agent Bridge

| 导出 | 类型 | 说明 |
|------|------|------|
| `FSMAgentBridge` | Class | FSM Agent 上下文桥接（SessionStart FSM 注入） |
| `IFSMAgentBridge` | Interface | FSMAgentBridge 接口 |
| `FSMContextSnapshot` | Interface | FSM 状态快照 |
| `SessionFSMContext` | Interface | Session FSM 上下文 |

### Agent 适配器

| 导出 | 类型 | 说明 |
|------|------|------|
| `ClaudeCodeAdapter` | Class | Claude Code 适配器 |
| `CodexAdapter` | Class | Codex CLI 适配器 |
| `OpenCodeAdapter` | Class | OpenCode 适配器 |
| `CursorAdapter` | Class | Cursor 适配器 |
| `GeminiAdapter` | Class | Gemini CLI 适配器 |
| `OpenClawAdapter` | Class | OpenClaw 适配器 |
| `HermesAdapter` | Class | Hermes 适配器 |
| `createAdapter` | Function | 统一适配器工厂函数 |
| `SUPPORTED_AGENTS` | Constant | 支持的 Agent 列表 |
| `IAgentAdapter` | Interface | Agent 适配器接口 |
| `AdapterConfig` | Interface | 适配器配置 |
| `InitResult` | Interface | 初始化结果 |
| `SettingsJson` | Interface | settings.json 结构 |
| `HookEntry` | Interface | Hook 配置条目 |

### 技能发现

| 导出 | 类型 | 说明 |
|------|------|------|
| `SkillDiscovery` | Class | 技能发现引擎 |

### 工作流预设

| 导出 | 类型 | 说明 |
|------|------|------|
| `WORKFLOW_PRESETS` | Constant | 全部 10 种工作流映射表 |
| `getWorkflowPreset` | Function | 按 ID 获取工作流 |
| `listWorkflowPresets` | Function | 列出所有工作流 |
| `getPresetsByScenario` | Function | 按场景模式筛选 |
| `BASIC_DEV` | Constant | 基础开发流 |
| `TDD_DEV` | Constant | TDD 功能开发 |
| `BUG_FIX` | Constant | Bug 修复 |
| `SDD` | Constant | 规约驱动开发 |
| `CODE_REVIEW` | Constant | 代码审查 |
| `SECURITY_AUDIT` | Constant | 安全审计 |
| `RALPH_LOOP` | Constant | Ralph 自主循环 |
| `RAPID_PROTO` | Constant | 快速原型 |
| `MASSIVE_REFACTOR` | Constant | 大规模重构 |
| `PARALLEL_EXEC` | Constant | 并行执行 |

### API

| 导出 | 类型 | 说明 |
|------|------|------|
| `Doctor` | Class | 环境诊断工具 |
| `ScaleMCPServer` | Class | MCP Server 实现 |

---

## 🌐 社区与推广

### 链接

| 平台 | 链接 | 说明 |
|------|------|------|
| 📦 **GitHub** | [https://github.com/hongmaple0820/scale-engine](https://github.com/hongmaple0820/scale-engine) | 源码 + Issues + PR |
| 🔧 **Gitee** | [https://gitee.com/hongmaple/scale-engine](https://gitee.com/hongmaple/scale-engine) | 国内镜像 |
| 📦 **npm** | [https://www.npmjs.com/package/@hongmaple0820/scale-engine](https://www.npmjs.com/package/@hongmaple0820/scale-engine) | 包下载 |

### 微信公众号

<p align="center">
  <img src="/image/wechat-public.jpg" alt="鸿枫技术栈" width="200" />
</p>

关注「**鸿枫技术栈**」公众号，获取最新动态和工程化实践文章。

### 微信交流群

添加微信 **mapleCx330** 加入交流群，或通过邮箱 **2496155694@qq.com** 联系。

### 知识星球（¥99/年）

加入知识星球，获取：
- 专属技能包和配置模板
- 深度实战案例拆解
- 社区专家 1v1 答疑
- 新功能优先体验权

> 📌 加入知识星球，和认真的 AI 编码开发者一起成长：[https://t.zsxq.com/6T5Eq](https://t.zsxq.com/6T5Eq)

### 🌟 Star History

如果 SCALE Engine 对你有帮助，请给个 ⭐ Star！

<a href="https://www.star-history.com/?type=date&repos=hongmaple0820%2Fscale-engine">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=hongmaple0820/scale-engine&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=hongmaple0820/scale-engine&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=hongmaple0820/scale-engine&type=date&legend=top-left" />
 </picture>
</a>

---

### ❤️ 开源不易，谢谢打赏

<p align="center">
  <img src="/image/wxPay.jpg" alt="微信支付" width="150" />
  <img src="/image/zfb.jpg" alt="支付宝" width="150" />
</p>

---

## 📋 CHANGELOG

### v0.8.0 (2026-05-08)

**多 Agent 协作系统 + mattpoclock/skills 风格集成 + TF-IDF 记忆召回：**

**Phase 1-3: 工作流增强**
- ✨ **SessionStart Hook** — `scale context inject` 自动注入 FSM 状态和相关 lessons
- ✨ **AutoDefectCreator** — 自动从检测器事件创建 Defect（hallucination/brute_retry/blame_shift）
- ✨ **BehaviorTracker.autoEvolve** — bruteRetry 达阈值（默认3次）自动触发进化周期
- ✨ **KnowledgeBase TF-IDF** — recallByVector 使用 TF-IDF 算法计算文本相似度

**Phase 4-9: 多 Agent 协作系统**
- ✨ **12 专业 Agent Profiles** — frontend/backend/test/ui-design/ops/product/code-review/security/database/performance/docs/architect
- ✨ **AgentPool** — Agent 实例池管理（spawn/assign/complete/recycle）
- ✨ **AgentDispatcher** — 任务自动分发到合适 Agent Profile
- ✨ **AgentChannel** — Agent 间消息传递和广播机制
- ✨ **AgentCoordinator** — 团队任务协调器（Task Lead 角色）
- ✨ **CLI 命令** — `scale agent spawn/assign/status` + `scale team create/execute/status`

**mattpoclock/skills 风格集成（设计完成）**
- 📋 **UbiquitousLanguageManager** — CONTEXT.md + ADR 实时更新机制设计
- 📋 **GrillingSessionSkill** — 递归决策树探索需求精炼
- 📋 **IssueTriageFSM** — Issue 状态机（needs-triage → ready-for-agent → completed）
- 📋 **CavemanCompressor** — 超压缩通信模式（约 75% token 减少）

**Karpathy 反惰性原则**
- 📋 **暴力重试反制** — 每次必须换策略，连续 2 次同策略触发级联
- 📋 **甩锅反制** — 甩锅前必须验证，未验证的归因 = 甩锅
- 📋 **工具闲置反制** — 有工具/技能不用而直接放弃 = 触发级联
- 📋 **忙碌假象反制** — 反复微调同一行无新信息产生 = 触发级联
- 📋 **被动等待反制** — 修完表面问题就停不泛化检查 = 触发级联

**测试与发布**
- ✅ 测试：410 passed (32 test files)
- ✅ npm 发布：@hongmaple0820/scale-engine@0.8.0
- ✅ GitHub 推送：master + tag v0.8.0

### v0.7.1 (2026-05-06)

**SessionStart Hook 增强 + 自进化闭环自动化 + 记忆利用率提升：**
- ✨ **SessionStart hook 增强** — `scale context inject` 命令注入 FSM 状态
- ✨ **AutoDefectCreator** — 自动从检测器事件创建 Defect（5 种事件类型）
- ✨ **BehaviorTracker.setAutoEvolve** — bruteRetry 达阈值触发进化周期
- ✨ **ContextBuilder.recallRelevantLessons** — 基于 tags 自动召回 lessons
- ✨ **FSMAgentBridge.getSessionContext** — 获取 session FSM 上下文
- 🔧 新增事件类型 `defect.auto_created`
- 🔧 ClaudeCodeAdapter SessionStart hook 改为调用 context inject
- ✅ 测试：323 passed (21 test files)

### v0.6.1 (Unreleased)

**新增 4 种 Agent 适配器（共 11 种）：**
- ✨ **TraeAdapter** — 字节跳动 Trae AI 编程助手（`.trae/settings.json` + `TRAE.md`）
- ✨ **WorkBuddyAdapter** — 腾讯 CodeBuddy 团队协作（`.workbuddy/settings.json` + `WORKBUDDY.md`）
- ✨ **VSCAdapter** — VS Code Copilot CLI（`.vscode/scale.json` + `VSC.md`）
- ✨ **QCoderAdapter** — 阿里通义千问 Code CLI（`.qwen/settings.json` + `QWEN.md`）

**集成完整性：**
- `AgentPlatform` 联合类型扩展至 11 种
- `Doctor.checkSettingsJson` / `checkKnowledgeDoc` 支持新增 4 种平台检测
- `SkillDiscovery.detectPlatform` 支持识别 4 种新平台
- `createAdapter` / `SUPPORTED_AGENTS` 注册新适配器
- 4 个测试套件 × 共 ~50 个新测试用例

### v0.6.0 (2026-04-29)

**新增功能：**
- ✨ **SQLiteKnowledgeBase** — 基于 better-sqlite3 的持久化知识库，WAL 模式，并发安全
- ✨ **FSM 并发锁** — per-artifact Promise 链式锁，防止竞态条件
- ✨ **ScopeCreepDetector** — 第 9 个检测器，检测任务范围蔓延（15 文件 / 10 分钟窗口）

**改进：**
- CLI 默认使用 SQLiteKnowledgeBase（替代内存版）
- CLI 注册 ScopeCreepDetector 为 preTool 检测器
- 公共 API 新增导出：`SQLiteKnowledgeBase`, `IKnowledgeBase`, `DangerousCommandDetector`, `SecretLeakDetector`, `RoleGateDetector`, `ScopeCreepDetector`, `BUILT_IN_ROLES`
- package.json 添加 `exports` 字段，支持现代 Node.js 模块解析

**测试：**
- 新增 28 个测试（SQLite KB 19 + FSM 并发锁 4 + ScopeCreep 5）
- 修复 9 个预存测试失败（import 路径、断言值、FSM guard payload、Gateway warn 语义）
- 测试套件：197/197 全部通过

### v0.5.1 (2026-04-22)

**P0 Bug 修复：**
- 🐛 修复 ContextBuilder 导入 `ScenarioModeConfig` 类型无效引用
- 🐛 修复 Task FSM `complete` Guard 在 `buildStatus` 未设置时误判逻辑
- 🐛 修复 BlameShiftDetector 正则匹配大小写不一致

**P1 新功能：**
- ✨ 新增 `ScopeCreepDetector` — 第 9 个检测器，检测任务范围蔓延
- ✨ 新增 6 种行为模式检测（brute_retry / idle_tool / busy_loop / premature_done / blame_shift / scope_creep）
- ✨ 新增级联升级机制 L0→L3（allow / warn / block / deny）
- ✨ 新增场景模式敏感度自动调节
- ✨ 新增 MCP Server 集成 (`ScaleMCPServer`)

**P2 清理：**
- 🧹 统一适配器导出入口 (`adapters/index.ts`)
- 🧹 完善公共 API 导出
- 🧹 更新 README 文档

### v0.5.0 (2026-04-22)

**重大更新：7 Agent 适配器 + 场景模式 + 工作流预设 + 技能生态**

- 🆕 **7 种 Agent 适配器**：Claude Code, Codex, OpenCode, Cursor, Gemini, OpenClaw, Hermes
  - 统一 `createAdapter()` 工厂函数
  - `SUPPORTED_AGENTS` 常量导出
- 🆕 **3 种场景模式**：Sandbox / Standard / Critical
  - 不同检测器敏感度 (low/medium/high)
  - 不同验证要求、人工确认要求、最大重试次数
- 🆕 **10 种工作流预设**：基础开发、TDD、Bug修复、SDD、代码审查、安全审计、Ralph自主循环、快速原型、大规模重构、并行执行
- 🆕 **技能生态系统**：自动检测 Agent 平台 → 扫描技能目录 → 生成 `skills.md`
- 🆕 **SCALE v10.0 哲学**：ContextBuilder P1 系统规则层（物理约束 + 场景模式感知）
- 🆕 **CLI 增强**：`scale init --scenario`, `scale workflow list`, `scale skill scan`

### v0.4.0 (2026-04-22)

- 新增 `scale context status --session-id` 命令
- 新增 `scale create-prd` 自动创建 Spec→Plan→Tasks 层级
- 配置 hooks 集成（SessionStart/PreToolUse/PostToolUse/Stop）

### v0.3.0 (2026-04-21)

- 新增 `scale suggest` 命令，显示 Artifact 可执行操作列表
- 支持 `--json` 输出用于脚本集成

### v0.2.0 (2026-04-21)

- 新增 `scale suggest <id>` 命令
- 支持 Guard 条件和拦截原因显示

### v0.1.0 (2026-04-21)

**初始发布 — 六层架构完整实现：**

- L1 Context — Token 预算 + 上下文组装策略
- L2 Guardrails — 8 检测器 + Role 网关 + 模糊度阈值拦截
- L3 Observability — EventBus + BehaviorTracker 全链路追踪
- L4 Orchestration — TaskEngine + Effects 系统 + ModelRouter
- L5 Memory — KnowledgeBase + 衰减算法 + SQLite 持久化
- L6 Evolution — Defect→Lesson→Rule→Hook 四级自进化闭环
- 148+ 单元测试通过

---

## 🤝 贡献指南

我们欢迎所有形式的贡献！无论是 Bug 报告、功能建议、文档改进还是代码贡献。

### 贡献流程

1. **Fork** 仓库到你的 GitHub 账号
2. 创建 **dev 分支**：`git checkout -b feat/your-feature`
3. **开发 & 测试**：确保 `pnpm test` 和 `pnpm lint` 通过
4. **提交**：使用规范的 Commit Message
5. **推送 & PR**：推送到你的 Fork，然后创建 Pull Request

### Commit Message 格式

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat: add ScopeCreepDetector` |
| `fix` | Bug 修复 | `fix: correct Task FSM guard logic` |
| `chore` | 构建/工具 | `chore: update dependencies` |
| `docs` | 文档 | `docs: update API reference` |
| `refactor` | 重构 | `refactor: extract common detector logic` |
| `test` | 测试 | `test: add gateway integration tests` |
| `perf` | 性能 | `perf: optimize event bus query` |

### 开发环境

```bash
# 克隆仓库
git clone https://github.com/hongmaple0820/scale-os.git
cd scale-engine

# 安装依赖
npm install

# 运行测试
npm test

# 类型检查
npm run typecheck

# Lint
npm run lint

# 构建
npm run build

# 启动 MCP Server
npm run mcp
```

### 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **TypeScript** | 5.5+ | 主语言，ESM 模式 |
| **better-sqlite3** | 11.x | SQLite WAL 模式持久化 |
| **Zod** | 3.x | 运行时类型校验 |
| **Pino** | 9.x | 结构化日志 |
| **Citty** | 0.1.x | CLI 框架 |
| **Hono** | 4.x | HTTP API |
| **MCP SDK** | 1.x | Model Context Protocol |
| **Vitest** | 2.x | 单元测试 |

---

<p align="center">
  <strong>SCALE Engine</strong> — 让 AI 在物理约束下工作，而不是靠提示词自律<br/>
  <sub>Built with ❤️ by the SCALE OS Team</sub>
</p>
