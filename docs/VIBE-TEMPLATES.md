# Vibe Coding Templates 集成方案

## 背景

SCALE Engine 工作流需要用户输入大量提示词，新手用户难以快速上手。本方案集成高质量提示词模板库，实现"一键启动专业工作流"。

## 参考

- **easy-vibe** (Datawhale): 面向初学者的阶段化学习路径，交互式教程
- **vibe-coding-prompt-template** (KhazP): 5阶段 MVP 工作流模板，AGENTS.md 主契约

## 设计目标

1. **一键启动**: 用户无需输入复杂提示词，选择阶段即可获得专业模板
2. **组合包**: 预定义工作流组合包（完整 MVP / 快速原型 / 开发者路径）
3. **上下文延续**: 提示词自动引用前置阶段输出
4. **用户分级**: Vibe-coder / Developer / Intermediate 三级适配

## 架构

```
src/prompts/
├── PhasePromptRegistry.ts  # 提示词注册中心
├── templates/              # 内置模板文件（可选）
└── custom/                 # 用户自定义模板（可选）

src/cli/vibeCommands.ts     # CLI 命令实现
```

## 6 阶段流程

| 阶段 | 命令 | 预估时间 | 输出文件 |
|------|------|----------|----------|
| **idea** | `scale vibe --phase idea` | 15-20 min | docs/idea-validation.md |
| **research** | `scale vibe --phase research` | 20-30 min | docs/research-{App}.md |
| **prd** | `scale vibe --phase prd` | 15-20 min | docs/PRD-{App}-MVP.md |
| **design** | `scale vibe --phase design` | 15-20 min | docs/TechDesign-{App}-MVP.md |
| **agents** | `scale vibe --phase agents` | 1-2 min | AGENTS.md + agent_docs/ |
| **build** | `scale vibe --phase build` | 1-3 hrs | — |

## 组合包

| ID | 名称 | 阶段 | 适用人群 |
|----|------|------|----------|
| `full-mvp` | 完整 MVP 工作流 | idea → research → prd → design → agents → build | 所有用户 |
| `quick-prototype` | 快速原型 | prd → agents → build | 快速验证想法 |
| `developer-path` | 开发者路径 | research → prd → design → agents → build | 有经验开发者 |
| `vibe-coder-path` | Vibe Coder 路径 | idea → prd → agents → build | 初学者 |

## 使用示例

### 完整 MVP 流程
```bash
# 1. 查看所有模板
scale vibe

# 2. 使用组合包启动
scale vibe --pack full-mvp --app "MyExpenseTracker"

# 3. 逐步执行各阶段
scale vibe --phase idea --app "MyExpenseTracker" --output docs/idea-validation.md
scale vibe --phase research --app "MyExpenseTracker"
scale vibe --phase prd --app "MyExpenseTracker" --output docs/PRD-MyExpenseTracker-MVP.md
scale vibe --phase design --app "MyExpenseTracker"
scale vibe --phase agents --app "MyExpenseTracker"
scale vibe --phase build
```

### 快速原型（跳过研究）
```bash
scale vibe --pack quick-prototype --app "MyApp"
```

### 交互式引导
```bash
scale vibe --interactive
```

## 与现有工作流集成

### 与 Phase Commands 对应

| Vibe 阶段 | Phase Command | 关系 |
|-----------|---------------|------|
| idea | `scale define` | 想法验证 → Spec 创建 |
| prd | `scale define --desc` | PRD 生成 → Spec 详情 |
| design | `scale plan` | 技术设计 → Plan artifact |
| build | `scale build` | 构建 → Task artifact |
| verify | `scale verify` | 验证 → Evidence |
| ship | `scale ship` | 发布 → Release |

### 使用方式

1. **纯 Vibe 模式**: 使用 `scale vibe` 系列命令，AI 驱动全流程
2. **混合模式**: Vibe 生成文档 → Phase Commands 执行 FSM 流程
3. **纯 Phase 模式**: 直接使用 Phase Commands，适合熟练用户

## AGENTS.md 模板

生成的 AGENTS.md 包含：

```markdown
# AGENTS.md — {AppName} Master Plan

## Project Overview & Stack
**App:** {AppName}
**Stack:** {Tech stack}

## Setup & Commands
- Setup: npm install
- Development: npm run dev
- Testing: npm test
- Build: npm run build

## Protected Areas
Do NOT modify without approval:
- Infrastructure
- Database migrations
- Auth/Payment configs

## Coding Conventions
- Formatting: ESLint/Prettier
- Architecture: Feature-based folders
- Testing: Unit tests required
- Types: Strict TypeScript

## Agent Behaviors
1. Plan Before Execution
2. Refactor Over Rewrite
3. Context Compaction
4. Iterative Verification
5. Team Coordination
```

## 自定义扩展

用户可在 `.scale/prompts/` 目录添加自定义模板：

```bash
# 项目自定义
.scale/prompts/custom-phase.md

# 用户全局自定义
~/.claude/prompts/custom-phase.md
```

## 下一步优化

1. **交互式模式**: 完苏格拉底式问答流程
2. **模板市场**: 用户分享模板
3. **智能推荐**: 基于项目状态推荐下一阶段
4. **多语言**: 中英双语模板

## 来源

- easy-vibe: https://github.com/datawhalechina/easy-vibe
- vibe-coding-prompt-template: https://github.com/KhazP/vibe-coding-prompt-template