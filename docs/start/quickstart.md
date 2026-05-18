# 3 分钟快速开始

目标：在一个空目录中安装 SCALE 治理工作流，并看到可验证的项目产物。

## 前置条件

- Node.js 20 或更高版本。
- 已安装 npm。
- Windows PowerShell、Git Bash、macOS/Linux shell 都可以执行。

## 1. 安装 CLI

```bash
npm install -g @hongmaple0820/scale-engine
scale --version
```

如果你在开发 `scale-engine` 本仓库，也可以用本地构建后的命令：

```bash
node E:/project/scale-engine/dist/api/cli.js --help
```

## 2. 初始化一个空项目

```bash
mkdir scale-demo
cd scale-demo
scale init --governance-pack standard
```

这一步会生成：

```text
.scale/
docs/
scripts/
AGENTS.md 或对应 Agent 入口文档
```

重点看这些文件：

| 文件 | 用途 |
| --- | --- |
| `.scale/verification.json` | 本地验证 profile 和服务矩阵 |
| `.scale/skills.json` | Agent 应该如何选择 skills，以及哪些需要证据 |
| `.scale/tools.json` | CLI、MCP、浏览器、桌面自动化等工具使用策略 |
| `.scale/resource-policy.json` | 文档、报告、截图、脚本、临时产物的生命周期规则 |
| `.scale/engineering-standards.json` | 日志、安全、ORM、框架、测试、部署等工程规范 |
| `docs/workflow/templates/` | M/L 任务使用的标准 artifact 模板 |

## 3. 跑第一轮本地检查

```bash
scale preflight --preflight-profile quick
scale status
scale assets scan --dir .
scale standards scan --dir .
```

预期效果：

- `preflight` 能说明当前治理文件是否完整。
- `status` 会告诉 Agent 下一步应该做什么。
- `assets scan` 会把文档、模板、脚本、报告等资源分类。
- `standards scan` 会扫描日志噪音、敏感信息、危险输入、测试和架构风险。

## 4. 建立第一个任务上下文

```bash
scale context init --name "Scale Demo"
scale context grill --task-id 2026-05-18-oauth-hardening --task "加固 OAuth callback"
scale diagnose plan --task-id 2026-05-18-oauth-hardening --symptom "callback 在 state 过期时返回 500"
scale tdd slice --task-id 2026-05-18-oauth-hardening --behavior "拒绝过期 OAuth state" --public-interface "GET /oauth/callback" --failing-test "expired state returns 401" --test-file tests/oauth.test.ts --impl-files src/oauth.ts
```

这些命令的目的不是替代人类判断，而是把 Agent 必须做的思考显式记录下来：

- `context grill`：逼 Agent 先澄清上下文、成功标准和风险。
- `diagnose plan`：遇到问题先诊断，不允许盲修。
- `tdd slice`：把行为、公共接口、失败测试和实现文件绑定成一个可检查切片。

## 5. 生成 HTML 交付视图

```bash
scale artifact render --task-id 2026-05-18-oauth-hardening --artifact-dir docs/worklog/tasks/2026-05-18-oauth-hardening
scale artifact doctor --artifact-dir docs/worklog/tasks/2026-05-18-oauth-hardening
scale artifact open --task-id 2026-05-18-oauth-hardening --artifact-dir docs/worklog/tasks/2026-05-18-oauth-hardening
```

规则：

- Markdown 是长期维护源文件。
- HTML 是给评审、对比、状态汇报、交付和发版使用的可视化产物。
- `artifact doctor` 会检查 HTML 是否可追溯、是否引用远程资源、是否可能包含敏感信息。

## 6. 下一步

如果你只是试用，到这里已经能看到 SCALE 的价值：它把 Agent 的工作过程变成了可以审计的证据链。

如果你要接入真实项目，按项目类型选择 governance pack：

```bash
scale init --governance-pack node-library
scale init --governance-pack frontend-app
scale init --governance-pack go-service-matrix
scale init --governance-pack moe-workspace
scale init --governance-pack resource-governance
```

继续阅读 [官方 Demo Walkthrough](agent-governance-demo.md)，看一个真实任务如何从需求到验证证据。

