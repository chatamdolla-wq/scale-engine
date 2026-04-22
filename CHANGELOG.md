# @hongmaple0820/scale-engine CHANGELOG

## 0.3.0 - 2026-04-21

### 新功能

- 新增 `scale context status --session-id <id>` 命令，显示 session-level 约束
  - 显示当前 role 允许/禁止的工具
  - 显示 active artifacts 列表
  - 显示关键 constraints（Spec 未 FROZEN、Plan 未 approve 等）
- 新增 `scale create-prd <title>` 命令，自动创建 Spec → Plan → Tasks 层级
  - 自动生成 artifact ID 层级树
  - 批量创建 Tasks（逗号分隔）
  - 输出下一步操作提示
- 在 maple-cart-mall 项目配置 hooks 集成（SessionStart/PreToolUse/PostToolUse/Stop）
  - PreToolUse 调用 `scale gate pre-tool` 拦截违规操作
  - PostToolUse 记录工具调用输出
  - Stop 调用 `scale gate before-stop` 防止 premature done

### Documentation

- 创建 docs/OPTIMIZATION_PLAN.md 优化方案文档

## 0.2.0 - 2026-04-21

### 新功能

- 新增 `scale suggest <id>` 命令，显示 Artifact 当前状态可执行的操作列表
  - 显示每个 action 的执行状态（✅ 可执行 / ❌ 被 Guard 拦截）
  - 显示 Guard 条件和拦截原因，降低用户认知负担
  - 支持 `--json` 输出用于脚本集成

## 0.1.0 - 2026-04-21

### Features

**六层架构完整实现：**

- **L1 Context** — Token 预算 + 上下文组装策略
- **L2 Guardrails** — 8 检测器 + Role 网关 + 模糊度阈值拦截
- **L3 Observability** — EventBus + BehaviorTracker 全链路追踪
- **L4 Orchestration** — TaskEngine + Effects 系统 + ModelRouter
- **L5 Memory** — KnowledgeBase + 衰减算法 + SQLite 持久化
- **L6 Evolution** — Defect→Lesson→Rule→Hook 四级自进化闭环

**核心模块：**

- **Artifact FSM** — 11 种 Artifact 类型，状态机驱动生命周期管理
- **Gateway** — 角色切换、权限控制、ambiguity 阈值物理拦截
- **TaskEngine** — 步骤执行、Checkpoint、失败恢复
- **EvolutionEngine** — 行为追踪、缺陷诊断、知识提取、Hook 生成
- **ModelRouter** — 多模型路由策略（Haiku/Sonnet/Opus）
- **Adapters** — Claude Code / Codex CLI 平台适配

**CLI 命令 (13 个)：**

- `scale init` — 初始化项目
- `scale doctor` — 环境诊断
- `scale create` — 创建 Artifact
- `scale list/show` — 查询
- `scale transition` — 状态迁移（含 guard）
- `scale role` — 角色切换
- `scale context` — 上下文组装
- `scale evolve` — 进化周期
- `scale stats/session/gate` — 统计与会话管理

**测试覆盖：**

- 148+ 单元测试通过
- 集成测试覆盖 Adapters、W11 完整流程

### Documentation

- 完整架构文档 (`docs/01-ARCHITECTURE.md`)
- 数据模型定义 (`docs/02-DATA-MODEL.md`)
- 核心模块详解 (`docs/03-CORE-MODULES.md`)
- 集成指南 (`docs/04-INTEGRATION.md`)
- Roadmap (`docs/05-ROADMAP.md`)
- 技术决策记录 (`docs/06-DECISIONS.md`)

---

*Initial release - AI engineering scaffold engine for constrained agent workflows*