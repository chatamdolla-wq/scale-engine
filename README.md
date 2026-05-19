<p align="center">
  <img src="https://img.shields.io/badge/version-0.21.2-orange?style=flat-square" alt="version" />
  <img src="https://img.shields.io/badge/platforms-16-blue?style=flat-square" alt="platforms" />
  <img src="https://img.shields.io/badge/agents-12-blue?style=flat-square" alt="agents" />
  <img src="https://img.shields.io/badge/workflows-10-green?style=flat-square" alt="workflows" />
  <img src="https://img.shields.io/badge/detectors-19-red?style=flat-square" alt="detectors" />
  <img src="https://img.shields.io/badge/tests-verified-brightgreen?style=flat-square" alt="tests" />
  <img src="https://img.shields.io/badge/npm-0.21.2-cb3837?style=flat-square&logo=npm" alt="npm" />
</p>

# SCALE Engine v0.21.2

SCALE Engine 让 AI Agent 不再只靠“自觉”遵守工程规范。它把探索、规划、实现、验证、评审、发版这些要求变成可执行的命令、门禁和证据文件，让人类可以看见 Agent 做了什么、跳过了什么、为什么能交付或不能交付。

源码仓库：https://github.com/hongmaple0820/scale-engine
国内镜像：https://gitee.com/hongmaple/scale-engine
npm：https://www.npmjs.com/package/@hongmaple0820/scale-engine
语言：[中文](README.md) | [English](README.en.md)

## 先怎么学

如果你第一次接触 SCALE，不要从完整命令列表开始读。按这个顺序更容易掌握：

| 目标 | 入口 | 你应该学会什么 |
| --- | --- | --- |
| 先跑起来 | [3 分钟快速开始](docs/start/quickstart.md) | 安装 CLI、初始化治理文件、运行 preflight |
| 看完整闭环 | [官方 Demo Walkthrough](docs/start/agent-governance-demo.md) | 任务上下文、诊断、TDD、artifact 和验证证据如何串起来 |
| 接入已有项目 | [SCALE 工作流升级指南](docs/start/workflow-upgrade.md) | `init`、`upgrade check/plan/apply`、本地 `make` 包装入口怎么用 |
| 选择治理包 | 本文的 Governance Pack 章节 | 不同项目形态应该选哪个 pack |
| 维护或扩展 SCALE | [docs/README.md](docs/README.md) | 文档地图、内部模块和长期维护资料 |

一句话理解：SCALE 不是让 Agent 多写文档，而是让“做了什么、验证了什么、没验证什么”可追踪。

## 社区与推广

### 链接

| 平台 | 链接 | 说明 |
|------|------|------|
| 📦 **GitHub** | [https://github.com/hongmaple0820/scale-engine](https://github.com/hongmaple0820/scale-engine) | 源码 + Issues + PR |
| 🔧 **Gitee** | [https://gitee.com/hongmaple/scale-engine](https://gitee.com/hongmaple/scale-engine) | 国内镜像 |
| 📦 **npm** | [https://www.npmjs.com/package/@hongmaple0820/scale-engine](https://www.npmjs.com/package/@hongmaple0820/scale-engine) | 包下载 |
## 它解决什么问题

AI 编码真正难的不是“写代码”，而是持续稳定地遵守工程纪律：

| 常见问题 | SCALE 的处理方式 |
| --- | --- |
| Agent 没验证却说“测试通过” | 通过 verification profile 和 evidence store 记录真实命令与结果 |
| Agent 跳过需求澄清、设计、TDD 或 review | 通过 `scale context`、`scale diagnose`、`scale tdd`、`scale status` 生成下一步动作 |
| Agent 误提交无关文件或跨仓库改错位置 | 通过 review-gated ship、MOE workspace 和子仓库 blocker 控制边界 |
| 文档、报告、截图、临时脚本越堆越乱 | 通过 resource governance 区分长期维护、任务证据、临时产物和禁止提交资产 |
| 日志噪音、敏感信息、ORM/框架乱用、安全风险无人兜底 | 通过 engineering standards 和 OWASP 扫描给出可追溯问题 |
| Markdown 长报告没人读 | 通过 `scale artifact` 从 Markdown 源文件生成可追溯 HTML 报告 |

## 3 分钟看到效果

```bash
npm install -g @hongmaple0820/scale-engine
mkdir scale-demo && cd scale-demo
scale init --governance-pack standard
scale preflight --preflight-profile quick
scale status
```

你会得到一套可提交到项目里的治理文件：

- `.scale/verification.json`：服务矩阵和验证 profile
- `.scale/skills.json`：skill 路由和证据要求
- `.scale/tools.json`：CLI/MCP/browser/desktop 工具编排规则
- `docs/workflow/templates/`：Mini-PRD、plan、verification、review、summary 模板
- `docs/standards/`：工程规范、Git 协作、资源治理规则

继续体验完整闭环：

```bash
scale context init --name "Scale Demo"
scale context grill --task-id 2026-05-18-oauth-hardening --task "加固 OAuth callback"
scale diagnose plan --task-id 2026-05-18-oauth-hardening --symptom "callback 在 state 过期时返回 500"
scale tdd slice --task-id 2026-05-18-oauth-hardening --behavior "拒绝过期 OAuth state" --public-interface "GET /oauth/callback" --failing-test "expired state returns 401" --test-file tests/oauth.test.ts --impl-files src/oauth.ts
scale artifact render --task-id 2026-05-18-oauth-hardening --artifact-dir .planning/tasks/2026-05-18-oauth-hardening
scale artifact doctor --artifact-dir .planning/tasks/2026-05-18-oauth-hardening
```

完整教程见 [3 分钟快速开始](docs/start/quickstart.md) 和 [官方 Demo Walkthrough](docs/start/agent-governance-demo.md)。

## 适合谁

- 正在用 Codex、Claude Code、Cursor、Gemini CLI、OpenCode、Aider 等 Agent 写真实项目的团队。
- 有多服务、多仓库、MOE workspace、前后端分离、脚手架治理需求的团队。
- 希望 Agent 主动使用 skills、MCP、CLI、浏览器、E2E、HTML 报告，但又需要安全边界和证据闭环的团队。
- 经常遇到“AI 改得快，但难审、难验、难维护”的项目负责人。

不适合只想要一个极简 prompt 文件、完全不需要门禁、不关心多人协作和长期维护的玩具项目。

## 核心能力

- Workflow Engine：`define -> plan -> build -> verify -> review -> ship` 的阶段化交付状态机。
- GateSystem：build、lint、test、coverage、security、TDD、review、tool evidence 等门禁。
- Governance Packs：`standard`、`project-scaffold`、`moe-workspace`、`resource-governance`、`go-service-matrix`、`node-library`、`frontend-app`。
- Resource Governance：治理文档、图片、视频、报告、测试脚本、临时脚本、HTML artifact 和本地配置。
- Skill and Tool Orchestration：把 UI/UX、联网研究、浏览器 E2E、Chrome DevTools MCP、桌面自动化、外部 Agent CLI 纳入流程。
- Runtime Evidence：记录会话、命令、工具、浏览器、skill 和最终交付证据，阻断“没有证据却声称完成”。
- Engineering Standards：扫描日志噪音、敏感信息、注入风险、ORM/数据库、框架边界、测试严谨性和部署风险。
- HTML Artifacts：Markdown 仍是可维护源文件，HTML 用于评审、对比、状态报告和发版交接。

## 安装

```bash
npm install -g @hongmaple0820/scale-engine
scale --version
```

需要 Node.js 20 或更高版本。

## 更新工作流

SCALE 把升级分成三层：CLI 自身、已生成到项目里的 governance pack 文件、第三方 skills/MCP/CLI 能力。默认只检查和生成计划，不自动覆盖用户改过的文件，也不自动安装第三方工具。

```bash
scale upgrade check --dir .
scale upgrade plan --dir . --html
scale upgrade apply --dir . --confirm
scale upgrade rollback --dir .
scale tools outdated --dir .
scale skill outdated --dir .
```

升级原则：

- `scale upgrade check` 读取 `.scale/governance.lock.json`，判断当前项目是干净、缺文件、模板过期，还是存在本地改动。
- `scale upgrade plan` 生成非破坏性计划；遇到用户改过的生成文件时标记 `manual-review`。
- `scale upgrade apply --confirm` 只恢复缺失生成文件和刷新锁文件，先写 `.scale/backups/upgrade-*` 回滚点。
- `scale upgrade rollback` 只撤回最近一次 SCALE 管理的安全应用。
- `scale tools outdated` 和 `scale skill outdated` 只列出更新面、来源、信任等级和安全策略，不做自动安装。
- 第三方社区来源默认人工评审，高权限桌面自动化默认阻断自动升级。

详细说明见 [升级管理](docs/UPGRADE_MANAGEMENT.md)。

新用户和项目维护者可先看 [SCALE workflow upgrade guide](docs/start/workflow-upgrade.md)，它把 `scale init --interactive`、`scale upgrade check/plan/apply/rollback` 和仓库本地 `make workflow-upgrade-*` 入口放在一条可执行路径里。

## Governance Pack

在已有项目中安装治理工作流：

```bash
scale init --governance-pack standard
scale init --governance-pack project-scaffold
scale init --governance-pack moe-workspace
scale init --governance-pack resource-governance
scale init --governance-pack go-service-matrix
scale init --governance-pack node-library
scale init --governance-pack frontend-app
```

当前支持的治理包：

| Pack | 适用场景 |
| --- | --- |
| `standard` | 通用项目治理，包含任务 artifact、验证、指标、资源、规范和 skills policy |
| `project-scaffold` | 可复现的工程化工作流脚手架和治理 demo 项目 |
| `moe-workspace` | 父工作区 + 独立子仓库，适合 MOE/多仓协作 |
| `resource-governance` | 文档、报告、截图、脚本、媒体、生成产物等资源生命周期治理 |
| `go-service-matrix` | Go 后端服务矩阵，支持按服务 build/lint/test/security 验证 |
| `node-library` | Node/TypeScript 包的开发、发布和验证治理 |
| `frontend-app` | UI/UX、浏览器证据、响应式检查、E2E 和视觉评审治理 |

如果不确定选哪个，先用 `standard`。场景明确时再使用更具体的 pack：

更多命令和使用路径见 [入门文档索引](docs/start/README.md)。

## Vibe Templates（一键启动）

内置高质量提示词模板，无需输入复杂指令：

```bash
# 查看所有模板
scale vibe

# 使用组合包启动完整 MVP 流程
scale vibe --pack full-mvp --app "MyExpenseTracker"

# 单阶段生成提示词
scale vibe --phase prd --app "MyApp" --output docs/PRD-MyApp.md
```

**6 阶段流程**：

| 阶段 | 命令 | 预估时间 |
|------|------|----------|
| idea | `scale vibe --phase idea` | 15-20 min |
| research | `scale vibe --phase research` | 20-30 min |
| prd | `scale vibe --phase prd` | 15-20 min |
| design | `scale vibe --phase design` | 15-20 min |
| agents | `scale vibe --phase agents` | 1-2 min |
| build | `scale vibe --phase build` | 1-3 hrs |

详见 [Vibe Templates 文档](docs/VIBE-TEMPLATES.md)。

## 阶段工作流

```bash
scale define "Scoped release workflow" \
  --description "Implement a TypeScript CLI workflow with verification evidence, review records, rollback constraints, and release safety checks." \
  --success-criteria "verify evidence is persisted,review evidence is persisted,ship blocks unreviewed files"

scale plan <spec-id> --rollback "Revert the release commit and remove generated artifacts"
scale build <plan-id> --description "Implement scoped release workflow"
scale verify <task-id>
scale review <task-id>
scale ship <task-id> --message "feat(workflow): add scoped release workflow"
```

如果只需要生成交付报告，不创建 Git commit：

```bash
scale ship <task-id> --no-commit
```

需要严格校验 TDD 证据时：

```bash
scale verify <task-id> --tdd-strict --tdd-evidence .scale/tdd/<task-id>.json
```

TDD evidence JSON 需要包含 `red`、`green`、`refactor`、`testFirst` 且值都为 `true`。

## Memory Fabric

Memory Fabric 会在长会话中把 runtime evidence、session events、knowledge recall 和 graph status 压缩成可预算的 context pack：

```bash
scale memory pack --task "Fix OAuth callback state lookup" --task-id <task-id> --session-id <session-id> --level M --budget 4000
scale memory doctor --task "Review cross-module permission change" --level L --budget 3000
scale memory settle --task "Fix OAuth callback state lookup" --task-id <task-id> --session-id <session-id> --level M
```

`memory settle` 会把已记录的运行证据沉淀为 `.scale/memory/learning-candidates/` 下的学习候选。候选默认需要人审，避免把一次会话里的临时判断直接污染长期知识库。

详见 [Memory Fabric](docs/MEMORY_FABRIC.md)。

## Context Budget 与 Progressive Governance

Context Budget 会把 always-loaded、on-demand、evidence、archive、generated 上下文分开统计，避免 Agent 把所有规则、历史方案、报告和生成物一次性塞进提示词。

```bash
scale context budget --json
scale context doctor --max-always 2500 --max-task 8000
scale context pack --task "Review frontend route with browser evidence" --level L --budget 4000 --json
```

Progressive Governance 会根据任务文本和变更文件自动推荐 `minimal`、`standard`、`expanded` 或 `critical` 治理模式，并用 ROI 报告解释治理收益和开销：

```bash
scale governance mode --task "Change auth permissions" --files src/auth/user.ts --requested-mode minimal --json
scale governance roi --task-id <task-id> --task "Review frontend route" --files src/routes/upload.tsx --json
```

详见 [Context Budget And Progressive Governance](docs/CONTEXT_BUDGET.md)。

## Code Intelligence 与探索 ROI

Code Intelligence 是 adapter-first 的代码理解层：优先消费外部 CodeGraph 或 Graphify 产物，缺失时明确降级到内部 source scan，不静默假装已经完成代码图谱分析。

```bash
scale codegraph init
scale codegraph status --json
scale codegraph query "UserService.create" --json
scale codegraph impact --symbol UserService.create --json
scale codegraph context --symbol UserService.create --budget 2000 --json
scale codegraph roi --symbol UserService.create --json
```

它会输出 provider、fallback 状态、相关文件、confidence，以及 `fileReadsSaved` / `toolCallsSaved` 等探索收益指标。`scale governance roi` 也可以通过 `--symbol` 或 `--code-query` 把代码智能纳入治理 ROI。

详见 [Code Intelligence](docs/CODE_INTELLIGENCE.md)。

## Workflow Eval 与 Failure Replay

Workflow Eval 用轻量套件衡量工作流是否真的减少返工、工具调用、token 消耗和人类纠偏。失败时会保留 Failure Replay，而不是只留下一个失败状态。

```bash
scale eval init
scale eval run --suite workflow-baseline --json
scale eval compare --baseline <run-id> --candidate <run-id> --json
scale eval failures --since 30d --json
scale eval promote-failure <failure-id>
```

默认产物写入 `.scale/evals/`，属于本地运行时证据。长期提交到 Git 的应是经过整理的报告、基准 fixture 或明确要沉淀的改进项。

详见 [Workflow Eval Harness](docs/WORKFLOW_EVAL.md)。

## Skill Radar

Skill Radar chooses skills, MCP, browser automation, desktop automation, and external CLIs by task intent instead of relying on a static prompt list. It returns confidence, safety level, evidence requirements, and fallback behavior so agents can actively use tools without silently crossing safety boundaries.

```bash
scale skill radar --task "Design upload UI and run browser E2E checks" --files src/pages/upload.tsx
scale skill radar --task "Automate WPS desktop workflow with CUA" --json
scale skill doctor --supply-chain
```

Desktop CUA and external agent CLIs are blocked by default through Tool Policy until deliberately enabled. Third-party skills stay review-required until source, scripts, license, and pinned revision are checked.

See [Skill Radar](docs/SKILL_RADAR.md).

## Memory Brain

Memory Brain stores long-term project knowledge separately from the short context pack. Runtime evidence and learning candidates enter as candidates first; active memory requires evidence paths, project scope, confidence, and explicit promotion.

```bash
scale memory ingest --from evidence --task-id <task-id>
scale memory ingest --from failure --failure-id <failure-replay-id>
scale memory query "OAuth callback state design"
scale memory contradictions --json
scale memory dream --json
scale memory promote <candidate-id>
```

The point is not to remember everything. The point is to keep useful, reviewed project facts while reporting contradictions instead of silently overwriting them.

See [Memory Brain](docs/MEMORY_BRAIN.md).

## Governance Dashboard

Governance Dashboard renders a local HTML health view from runtime evidence, Workflow Eval, Memory Brain, Resource Governance, and task HTML artifacts:

```bash
scale artifact dashboard
scale artifact dashboard --task-id <task-id> --json
```

Default output is `.scale/reports/governance-dashboard.html`. Markdown and JSON remain the maintainable source of truth; the dashboard is a review surface for humans.

See [Governance Dashboard](docs/GOVERNANCE_DASHBOARD.md).

## Runtime Evidence

M/L/CRITICAL 任务在最终交付前应留下运行时证据，避免 Agent 没有真实验证就声称完成：

```bash
scale runtime start --session-id <session-id> --task-id <task-id> --level M --agent codex
scale runtime record --title "build" --kind command --status passed --command "npm run build" --exit-code 0 --summary "build passed"
scale runtime final-check --task-id <task-id> --session-id <session-id> --level M
scale runtime doctor --task-id <task-id> --session-id <session-id> --level M
```

证据写入 `.scale/events/sessions/` 和 `.scale/evidence/runtime/`，默认属于本地运行时产物，不应提交到 Git。详见 [Runtime Evidence](docs/RUNTIME_EVIDENCE.md)。

## Evolution 自改进闭环

从会话缺陷中提取教训，晋升为规则和 Hook：

```bash
# 从会话提取 Lessons
scale evolution extract <session-id>

# 运行自改进闭环：Defect → Lesson → Rule → Hook
scale evolution improve <session-id>

# 显示自改进报告
scale evolution report <session-id>

# 查看生成的 Hooks 配置
scale evolution hooks <session-id> --json
```

阈值配置：
- Lesson → Rule：需验证 3 次
- Rule → Active：需触发 10 次
- Rule → Hook：需触发 20 次

## 安全模型

| 层级 | 作用 |
| --- | --- |
| FSM | 阻止非法 artifact 状态流转 |
| GateSystem | 执行 build、lint、test、coverage、security 门禁 |
| EvidenceStore | 持久化验证证据，用于审计和发布门禁 |
| ReviewStore | 持久化确定性 review 记录 |
| ReviewAnalyzer | 扫描 diff 中的高风险代码、流程债和缺失安全证据 |
| Detectors | 检测暴力重试、过早完成、甩锅、忙碌假象等失败模式 |
| Ship gate | 发布前必须验证通过，并且 review evidence 必须存在且通过 |

`ship` 不再执行 `git add .`。它只会暂存已通过 review 记录覆盖的文件；如果 review 后出现新的可 review 变更，`ship` 会阻断并要求重新 review。

Git 分支采用 GitLab Flow 变体：短分支合入 `dev`，验证后进入 `master`，生产发布由 `master` 上的 `vX.Y.Z` tag 触发。`scale ship` 会阻断在 `dev`、`master`、`main` 或 detached HEAD 上直接创建治理提交，并在临时 worktree 存在未推送或未合并提交时阻断清理。完整规则见 [docs/GITLAB_FLOW.md](docs/GITLAB_FLOW.md)。

G7 `SecurityGate` 内置轻量安全扫描，覆盖硬编码密钥、私钥、TLS 校验关闭、`eval`/`Function`、原始 HTML 注入、危险 shell 命令、shell 执行和空 `catch` 等模式。兼容模式只阻断 CRITICAL；严格模式会同时阻断 HIGH。

## 支持的平台与角色

SCALE Engine 内置 16 个平台适配器，包括 Claude Code、Codex CLI、OpenCode、Cursor、Gemini CLI、OpenClaw、Hermes、Trae、WorkBuddy、VS Code Copilot CLI、QCoder、DeepSeek-TUI、Aider、Windsurf、Kimi、Doubao。

内置 12 个专业 Agent Profile：

- frontend
- backend
- testing
- UI design
- operations
- product
- code review
- security
- database
- performance
- documentation
- architecture

## 项目结构

```text
src/api/cli.ts                 CLI 入口
src/cli/phaseCommands.ts       DEFINE/PLAN/BUILD/VERIFY/REVIEW/SHIP
src/cli/evolutionCommands.ts   L6 Evolution CLI 命令
src/workflow/gates/            质量门禁与验证证据
src/workflow/ReviewAnalyzer.ts 确定性 review 分析
src/workflow/ReviewStore.ts    review 记录持久化
src/workflow/EvidenceStore.ts  gate evidence 持久化
src/workflow/evolution/        LessonExtractor + SelfImproveEngine
src/workflow/qa/               BrowserQA + E2ETestRunner
src/artifact/                  artifact 存储与 FSM 定义
src/guardrails/                detector 与 gateway
src/guardrails/OWASPDetector.ts OWASP Top 10 安全检测
src/capabilities/BrowserQACapability.ts Playwright MCP 包装器
src/evolution/                 Defect/Lesson/Rule/Hook 自进化层
tests/                         Vitest 测试套件
```

## 开发与验证

```bash
npm install
npm run build
npx vitest run
npm pack --dry-run
```

工作流相关定向测试：

```bash
npx vitest run tests/workflow/phaseCli.test.ts
npx vitest run tests/workflow/reviewAnalyzer.test.ts tests/workflow/reviewStore.test.ts tests/workflow/gateSystem.test.ts
```

## v0.20.0 Updates

- Added Context Budget and Progressive Governance so low-risk S tasks stay lightweight while auth, data, security, deployment, and cross-module changes escalate automatically.
- Added Code Intelligence with adapter-first CodeGraph / Graphify support, explicit fallback, impact analysis, context recommendations, and exploration ROI.
- Added Workflow Eval, Failure Replay, and improvement candidates with pass@k, fix iterations, tool-call counts, token estimates, and human-correction metrics.
- Added Skill Radar for intent-based skills, MCP, browser, desktop automation, and external CLI recommendations with confidence, safety level, and evidence requirements.
- Added Memory Brain for evidence-backed long-term memory candidates, contradiction detection, dream maintenance, explicit promotion, and failure replay ingestion.
- Added Governance Dashboard to summarize runtime, eval, memory, resource, and HTML artifact evidence in a local HTML review surface.
- Fixed new --dir-aware commands so relative .scale state resolves inside the target project instead of the caller workspace.

## v0.18.0 更新

- 新增受治理 HTML artifact：`scale artifact render/doctor/settle/open`。
- Markdown 保持为可维护源文件；生成 HTML 作为可追溯任务证据。
- governance pack 增加 output policy 和 HTML artifact 资源分类。
- 增加 HTML 渲染、安全检查、settlement evidence 和模板生成测试。

## v0.17.0 更新

- 新增主动工作流命令门控：`scale context`、`scale diagnose`、`scale tdd`、`scale status`。
- 增加 required next-action queue，减少 Agent 静默跳过上下文、调试、TDD 或验证步骤。

## v0.16.0 更新

- 新增受治理 skill repository、skill 推荐、安装安全检查、可视化 Vibe 模板和领导者角色预设。
- 加强工具编排、资源治理和工程规范治理。

## v0.15.1 更新

- 新增 UI/UX、联网研究、浏览器自动化、桌面自动化和外部 Agent CLI 路由契约。
- 为生成项目包增加资源治理和工程规范治理。

## v0.11.1 更新

- Phase Commands FSM 阻断：`canTransition` + `process.exit(1)` 确保 guard 失败时阻塞
- OWASP Top 10 检测器：19 类安全检测模式
- Browser QA Capability：Playwright MCP 包装器用于 E2E 测试
- L6 Evolution：`Defect → Lesson → Rule → Hook` 自改进闭环
- Evolution CLI：`scale evolution extract/improve/report/hooks`
- ReviewAnalyzer regex 修复：避免模式定义误报
- Vitest 测试套件纳入发布验证

## v0.10.1 更新

- 新增 `ship --no-commit`。
- 强化 `ship`：发布提交只暂存已 review 文件。
- 新增可选严格 TDD evidence 校验。
- 增强命令证据元数据：工作目录、时间戳、stdout/stderr 尾部和输出 hash。
- 强化 deterministic review scanner：阻断空 `catch`、`@ts-ignore`、focused test、危险 shell/git 命令与缺 G7 证据的安全敏感变更。
- 强化 G7 内置安全扫描：输出文件/行号证据，默认阻断 CRITICAL，严格模式阻断 HIGH。
- 新增 `review -> ship`、未 review 文件阻断和安全扫描误报边界的 CLI/单元回归测试。
- 发版前已验证 `npm run build`、完整 Vitest 测试和 `npm pack --dry-run`。

## v0.10.0 更新

- 新增阶段化 CLI 工作流，并接入 FSM。
- 新增验证证据和 review 记录持久化。
- 发布 `@hongmaple0820/scale-engine@0.10.0`。

## License

MIT
