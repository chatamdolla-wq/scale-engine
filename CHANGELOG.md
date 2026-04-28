# @hongmaple0820/scale-engine CHANGELOG

## 0.6.0 - 2026-04-29

### SQLite 持久化 KnowledgeBase + FSM 并发锁 + 第 9 检测器

**新增功能：**

- **SQLiteKnowledgeBase**：基于 better-sqlite3 的持久化知识库
  - WAL 模式 + busy_timeout 保证并发安全
  - 完整实现 `IKnowledgeBase` 接口：add / recall / recallByVector / markHelpful / markUseless / verify / decay / stats / close
  - 支持多类型过滤、标签过滤、最小相关度过滤、已验证过滤
  - 数据在 close + reopen 后完整保留
  - `src/knowledge/SQLiteKnowledgeBase.ts`
- **FSM 并发锁**：per-artifact Promise 链式锁
  - 防止同一 Artifact 的并发状态迁移产生竞态条件
  - 不同 Artifact 间可并行迁移
  - `pendingLocks` getter 用于监控
  - `src/artifact/fsm.ts`
- **ScopeCreep 检测器**（第 9 个）：范围蔓延检测
  - 跟踪单会话内编辑的不同文件数量
  - 超过阈值（默认 15 个文件 / 10 分钟窗口）时发出警告
  - 支持自定义 `maxFiles` 和 `windowMs` 参数
  - `src/guardrails/advancedDetectors.ts`

**改进：**

- CLI 默认使用 SQLiteKnowledgeBase（替代内存版 KnowledgeBase）
- CLI 注册 ScopeCreepDetector 为 preTool 检测器
- 公共 API 新增导出：`SQLiteKnowledgeBase`, `IKnowledgeBase`, `DangerousCommandDetector`, `SecretLeakDetector`, `RoleGateDetector`, `ScopeCreepDetector`, `BUILT_IN_ROLES`

**测试：**

- 新增 SQLiteKnowledgeBase 测试（19 个）：CRUD、过滤、持久化、事件发射
- 新增 FSM 并发锁测试（4 个）：序列化、跨 Artifact 并行、历史完整性
- 新增 ScopeCreep 检测器测试（5 个）：阈值、文件去重、Write 跟踪

## 0.5.0 - 2026-04-22

### 重大更新：7 Agent 适配器 + 场景模式 + 工作流预设 + 技能生态

**新增功能：**

- **7 种 Agent 适配器**：新增 OpenCode, Cursor, Gemini, OpenClaw, Hermes 适配器
  - 统一 `createAdapter()` 工厂函数
  - `SUPPORTED_AGENTS` 常量导出
  - `src/adapters/index.ts` 统一入口
- **3 种场景模式**：Sandbox / Standard / Critical
  - 不同检测器敏感度 (low/medium/high)
  - 不同验证要求、人工确认要求、最大重试次数
  - `ScenarioModeConfig` 类型 + `SCENARIO_MODE_CONFIGS` 预设
- **10 种工作流预设**：`src/workflows/presets.ts`
  - 基础开发流、TDD功能开发、Bug修复、SDD、代码审查
  - 安全审计、Ralph自主循环、快速原型、大规模重构、并行执行
  - `scale workflow list` CLI 命令
- **技能生态系统**：`src/skills/SkillDiscovery.ts`
  - 自动检测 Agent 平台
  - 扫描技能目录
  - 生成 skills.md
  - `scale skill scan` CLI 命令
- **SCALE v10.0 哲学**：ContextBuilder P1 系统规则层
  - v5.0 × v8.0 × v9.1 核心认知框架
  - 物理约束 (不可绕过)
  - 场景模式上下文注入
- **CLI 增强**：
  - `scale init --scenario <mode>` 场景模式选择
  - `scale workflow list [--scenario <mode>]` 工作流列表
  - `scale skill scan` 技能发现
  - 版本号 0.5.0
- **类型系统扩展**：
  - `AgentPlatform` 类型 (7 种)
  - `ScenarioMode` + `ScenarioModeConfig`
  - `SkillRef` + `SkillScanResult`
  - `WorkflowPreset` + `WorkflowStep`

### 改进

- ContextBuilder 导入修复：移除无效的 `ScenarioModeConfig` 类型导入
- 统一适配器导出：从 `ClaudeCodeAdapter` 改为 `adapters/index.ts`
- 完善公共 API 导出

## 0.4.0 - 2026-04-22

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