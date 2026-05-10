<p align="center">
  <img src="https://img.shields.io/badge/version-0.10.1-orange?style=flat-square" alt="version" />
  <img src="https://img.shields.io/badge/platforms-11-blue?style=flat-square" alt="platforms" />
  <img src="https://img.shields.io/badge/agents-12-blue?style=flat-square" alt="agents" />
  <img src="https://img.shields.io/badge/workflows-10-green?style=flat-square" alt="workflows" />
  <img src="https://img.shields.io/badge/detectors-9-red?style=flat-square" alt="detectors" />
  <img src="https://img.shields.io/badge/tests-461-passing-brightgreen?style=flat-square" alt="tests" />
  <img src="https://img.shields.io/badge/npm-0.10.1-cb3837?style=flat-square&logo=npm" alt="npm" />
</p>

# SCALE Engine v0.10.1

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

v0.10.1 聚焦阶段化交付链路加固：

- `define -> plan -> build -> verify -> review -> ship`
- Spec、Plan、Task artifact 接入 FSM
- 验证门禁证据持久化
- 代码 review 记录持久化
- 确定性 review scanner 会阻断空 `catch`、`@ts-ignore`、focused test、危险 shell/git 命令和缺 G7 证据的安全敏感变更
- G7 内置安全扫描会记录可解释的文件/行号证据，默认阻断 CRITICAL，严格模式可阻断 HIGH
- 可选严格 TDD evidence 门禁：`--tdd-evidence` 和 `--tdd-strict`
- `ship --no-commit` 交付报告
- `ship` 发布前强制验证 review evidence
- 11 个平台适配器，12 个专业 Agent Profile
- Exa/search capability 集成
- 本轮 scoped ship、TDD evidence、review scanner 与 G7 security scan 加固后，461 个 Vitest 测试通过

## 安装

```bash
npm install -g @hongmaple0820/scale-engine
scale --version
```

需要 Node.js 20 或更高版本。

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

SCALE Engine 内置 11 个平台适配器，包括 Claude Code、Codex CLI、OpenCode、Cursor、Gemini CLI、OpenClaw、Hermes、Trae、WorkBuddy、VS Code Copilot CLI、QCoder。

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
src/workflow/gates/            质量门禁与验证证据
src/workflow/ReviewAnalyzer.ts 确定性 review 分析
src/workflow/ReviewStore.ts    review 记录持久化
src/workflow/EvidenceStore.ts  gate evidence 持久化
src/artifact/                  artifact 存储与 FSM 定义
src/guardrails/                detector 与 gateway
src/evolution/                 Defect/Lesson/Rule/Hook 自进化层
tests/                         Vitest 测试
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
