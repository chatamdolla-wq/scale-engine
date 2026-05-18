<p align="center">
  <img src="https://img.shields.io/badge/version-0.18.0-orange?style=flat-square" alt="version" />
  <img src="https://img.shields.io/badge/platforms-16-blue?style=flat-square" alt="platforms" />
  <img src="https://img.shields.io/badge/agents-12-blue?style=flat-square" alt="agents" />
  <img src="https://img.shields.io/badge/workflows-10-green?style=flat-square" alt="workflows" />
  <img src="https://img.shields.io/badge/detectors-19-red?style=flat-square" alt="detectors" />
  <img src="https://img.shields.io/badge/tests-verified-brightgreen?style=flat-square" alt="tests" />
  <img src="https://img.shields.io/badge/npm-0.18.0-cb3837?style=flat-square&logo=npm" alt="npm" />
</p>

# SCALE Engine v0.18.0

SCALE Engine 是一个面向 AI 编码 Agent 的工程化工作流运行时。它把提示词里的工程纪律，下沉为状态机、质量门禁、持久化证据、确定性 review 记录和发布检查。

源码仓库：https://github.com/hongmaple0820/scale-engine
国内镜像：https://gitee.com/hongmaple/scale-engine
npm：https://www.npmjs.com/package/@hongmaple0820/scale-engine
语言：[中文](README.md) | [English](README.en.md)

## 为什么需要它

提示词是建议，工程交付需要机制：

- Agent 可以声称测试通过，SCALE 会保存真实验证证据。
- Agent 可以跳过 review，SCALE 会在缺少 review 记录时阻断 `ship`。
- Agent 可以误提交无关文件，SCALE 只暂存已通过 review 覆盖的文件。
- Agent 可以丢失阶段状态，SCALE 会把 artifact 和 FSM 状态保存在 `.scale`。

## 当前版本

v0.18.0 聚焦可以生成到真实项目、可以本地验证的生产级工程治理工作流：

- governance pack 会生成 service matrix、verification profile、任务 artifact 模板、Mini-PRD/UI/spec 证据模板、metrics、resource policy、engineering standards 和 tool orchestration 规则。
- MOE 和非 MOE 项目都通过 `.scale/workspace.json`、子仓库生命周期检查、工作区感知验证来管理。
- 资源治理会区分长期维护文档、持久规格、任务证据、生成报告、临时文件、本地专属资产和禁止提交资产。
- 工程规范扫描覆盖日志噪音、敏感信息脱敏、安全输入、ORM/数据库、框架边界、架构一致性、UI/UX 期望、测试严谨性、部署就绪和安全控制。
- 工具与 skill 编排可以把 UI/UX、联网研究、浏览器 E2E、Chrome DevTools MCP、桌面自动化、外部 Agent CLI、skill 安全检查纳入有证据的流程。
- HTML artifact 已成为受治理的输出：Markdown 仍是可维护源文件，`scale artifact` 负责渲染、检查、打开和沉淀可追溯 HTML 报告。
- 主动命令门控（`scale context`、`scale diagnose`、`scale tdd`、`scale status`）用于引导 Agent 做上下文对齐、证据优先调试、TDD 切片和下一步动作。

历史 v0.11.1 新增四大优先级改进：

### Phase Commands FSM 阻断
- `canTransition` + `process.exit(1)` 确保 FSM guard 失败时阻塞流程，而非继续执行
- define/plan/build/verify 各阶段添加明确的阻断提示

### OWASP Top 10 检测器
- 新增 `OWASPDetector` 覆盖 SQL 注入、XSS、路径遍历、SSRF、Auth Bypass、弱加密、CORS 错误配置、CSRF、文件上传、敏感数据泄露
- 19 类安全检测模式，自动识别 regex 定义避免误报

### Browser QA Capability
- `BrowserQACapability` 封装 Playwright MCP 工具
- 支持导航、点击、截图、console 检查、E2E 测试流程

### L6 Evolution 自改进闭环
- `LessonExtractor` 从会话 Defect 事件提取可复用教训
- `SelfImproveEngine` 实现 `Defect → Lesson → Rule → Hook` 晋升流水线
- 新增 CLI 命令：`scale evolution extract/improve/report/hooks`

---

**完整阶段化交付链路**：

- `define -> plan -> build -> verify -> review -> ship`
- Spec、Plan、Task artifact 接入 FSM，guard 失败时阻断而非继续
- 验证门禁证据持久化
- 代码 review 记录持久化
- 确定性 review scanner 会阻断空 `catch`、`@ts-ignore`、focused test、危险 shell/git 命令和缺 G7 证据的安全敏感变更
- OWASP Top 10 安全检测器扩展安全覆盖
- G7 内置安全扫描会记录可解释的文件/行号证据，默认阻断 CRITICAL，严格模式可阻断 HIGH
- 可选严格 TDD evidence 门禁：`--tdd-evidence` 和 `--tdd-strict`
- `ship --no-commit` 交付报告
- `ship` 发布前强制验证 review evidence
- 16 个平台适配器，12 个专业 Agent Profile
- Browser QA Capability (Playwright MCP)
- Evolution 自改进闭环
- Vitest 测试套件纳入发布验证

## 安装

```bash
npm install -g @hongmaple0820/scale-engine
scale --version
```

需要 Node.js 20 或更高版本。

## Governance Pack 快速落地

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

初始化后，日常本地闭环建议使用：

```bash
scale preflight --preflight-profile quick
scale status
scale context init --name "MyProject"
scale context grill --task-id <task-id> --task "实现 OAuth callback 加固"
scale diagnose plan --task-id <task-id> --symptom "OAuth callback 返回 500"
scale tdd slice --task-id <task-id> --behavior "拒绝过期 OAuth state" --public-interface "GET /oauth/callback" --failing-test "expired state returns 401" --test-file tests/oauth.test.ts --impl-files src/oauth.ts
scale artifact render --task-id <task-id> --artifact-dir docs/worklog/tasks/<task-id>
scale artifact doctor --artifact-dir docs/worklog/tasks/<task-id>
scale assets scan --dir .
scale standards scan --dir .
scale metrics list
```

HTML 适合作为最终对比、评审、状态报告、事故报告和发版交接产物；Markdown 仍保留为长期维护源文件：

```bash
scale artifact render --task-id <task-id> --artifact-dir docs/worklog/tasks/<task-id>
scale artifact open --task-id <task-id> --artifact-dir docs/worklog/tasks/<task-id>
scale artifact settle --task-id <task-id> --artifact-dir docs/worklog/tasks/<task-id>
```

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
