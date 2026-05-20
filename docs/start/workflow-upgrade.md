# SCALE 工作流升级指南

本文是已有仓库安装、更新、适配 SCALE 工作流资产的短路径。

适合三类人：

| 角色 | 关注点 |
| --- | --- |
| 项目维护者 | 如何把 SCALE 接入已有仓库，并避免覆盖本地规则 |
| 普通开发者 | 拉取仓库后如何检查或安装正确的 SCALE 版本 |
| Agent 使用者 | 哪些步骤可以命令化，哪些必须人工或 Agent 审阅 |

## 哪些可以自动化

SCALE 把更新分成三层：

| 层级 | 命令支持 | 默认行为 |
| --- | --- | --- |
| SCALE CLI | `npm install -g @hongmaple0820/scale-engine@latest` | 用户显式安装或升级 |
| 生成的工作流文件 | `scale upgrade check/plan/apply/rollback` | 先安全检查和生成计划，只有 `--confirm` 才应用 |
| 项目级验证 | 仓库 `make` 目标和 `scripts/workflow/*` | 必须保留项目语义；SCALE 不猜业务路由、凭据和服务拓扑 |

这意味着工作流适配不是 Codex-only。Codex 可以帮助审阅和处理 `manual-review`，但常规路径应该是命令驱动。

## 首次安装

```bash
npm install -g @hongmaple0820/scale-engine
scale --version
```

已有项目可以用交互式初始化选择最接近的 governance pack：

```bash
scale init --interactive
```

也可以直接指定：

```bash
scale init --governance-pack standard
scale init --governance-pack project-scaffold
scale init --governance-pack scale-engine-repo
scale init --governance-pack moe-workspace
scale init --governance-pack go-service-matrix
scale init --governance-pack node-library
scale init --governance-pack frontend-app
```

不确定时先用 `standard`。仓库形态明确时再用更具体的 pack。`scale-engine-repo` 是 `scale-engine` 仓库自身的自托管 pack，不是普通业务仓库默认选项。

## 更新已有工作流

按这个顺序运行：

```bash
scale upgrade check --dir .
scale upgrade plan --dir . --html
scale upgrade apply --dir . --confirm
scale preflight --dir . --service all --preflight-profile quick
```

如果仓库已有本地封装，优先使用本地命令，因为它们编码了项目默认值：

```bash
make workflow-upgrade-check
make workflow-upgrade-plan
make workflow-upgrade-apply
make workflow-upgrade-verify
```

回滚只撤回最近一次 SCALE 管理的安全应用：

```bash
scale upgrade rollback --dir .
```

## 如何读取结果

| 结果 | 含义 | 下一步 |
| --- | --- | --- |
| clean | 生成的工作流集合和 lock 文件一致 | 运行项目级验证 |
| missing | 生成文件缺失 | 通常可用 `apply --confirm` 恢复 |
| outdated | SCALE 有更新的生成模板 | 审阅计划，确认安全后应用 |
| manual-review | 生成文件已有本地修改 | 检查 diff，不要自动覆盖 |

`manual-review` 是有意设计。SCALE 不应该抹掉本地项目知识、服务命令或 Agent 规则。

## 项目级适配

生成文件更新后，再按真实仓库适配这些文件：

- `.scale/verification.json`: service matrix, required checks, optional UI or E2E checks.
- `.scale/workspace.json`: branch model, protected branches, monorepo or workspace boundaries.
- `AGENTS.md` and `CLAUDE.md`: short agent entry rules.
- `docs/workflow/README.md`: human-readable workflow and verification commands.
- Repository wrappers such as `Makefile` and `scripts/workflow/verify.ps1`.

对 `netdisk-project` 这类多服务产品，不能把 `/health` 当作充分验证。验证必须覆盖本次变更影响的真实产品路径，例如 gateway 路由、`/api/v1/*` 请求、OAuth callback、存储驱动、UI 调用和数据持久化。

## Agent 本地产物忽略规则

工作流资产和团队协作规则可以提交；Agent 平台的本地状态、临时 worktree、缓存、日志和会话产物不应提交。已有项目接入或升级 SCALE 时，检查根 `.gitignore` 是否至少覆盖这些本地产物：

```gitignore
.claude/worktrees/
.claude/tmp/
.claude/local/
.codex/worktrees/
.codex/tmp/
.codex-tmp/
.cursor/tmp/
.continue/
.aider*
.gemini/tmp/
.omc/
.roo/tmp/
.cline/tmp/
.windsurf/
.playwright-mcp/
```

不要为了省事直接忽略所有协作配置目录。像 `AGENTS.md`、`CLAUDE.md`、`.cursor/rules/`、团队共享的 `.claude/settings.json`、`.scale/governance.lock.json` 这类稳定规则可以进入版本库。

## 推荐仓库封装

接入 SCALE 的仓库建议暴露这些命令：

```makefile
workflow-upgrade-check:
	scale upgrade check --dir .
workflow-upgrade-plan:
	scale upgrade plan --dir . --html
workflow-upgrade-apply:
	scale upgrade apply --dir . --confirm
workflow-upgrade-rollback:
	scale upgrade rollback --dir .
workflow-upgrade-verify:
	scale preflight --dir . --service all --preflight-profile quick
```

如果 Windows 环境没有 `make`，提供等价 PowerShell 脚本，或在文档里写清原始 `scale` 命令。

## 完成检查

- `scale --version` 输出预期版本。
- `scale upgrade check --dir .` 没有非预期 drift。
- 有变更时，`scale upgrade plan --dir . --html` 能生成可审阅计划。
- `scale upgrade apply --dir . --confirm` 只在审阅计划后使用。
- 项目级验证通过，或记录清楚已知失败。
- `README.md`、`AGENTS.md`、`CLAUDE.md`、`docs/workflow/README.md` 指向同一组工作流命令。
