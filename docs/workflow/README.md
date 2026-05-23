# SCALE Engine 仓库工作流

这里描述的是 `scale-engine` 仓库自身的工程化工作流，不是终端用户如何使用 `scale` CLI。

## 入口

- 新维护者先读 [GETTING_STARTED.md](../guides/GETTING_STARTED.md)
- 日常开发读 [DEVELOPMENT_WORKFLOW.md](../guides/DEVELOPMENT_WORKFLOW.md)
- 机器可读分支策略看 [../../.scale/workspace.json](../../.scale/workspace.json)

## 最小命令面

```bash
make preflight
make new-task NAME=workflow-adaptation LEVEL=M
make plan NAME=workflow-adaptation LEVEL=M
make explore FILES='AGENTS.md CLAUDE.md README.md package.json' MSG='main contradiction'
make gate-workflow
make gate-quality
make verify PROFILE=default
scale gates status --json
scale score task --changed --json
scale prompt optimize --input "raw coding request" --json
```

PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/workflow/verify.ps1 -Profile default
```

See [GATES_AND_SCORE.md](GATES_AND_SCORE.md) for gate catalog visibility, architecture standards gate scope, and deterministic task scoring.

See [PROMPT_OPTIMIZATION.md](PROMPT_OPTIMIZATION.md) for the deterministic prompt rewrite layer used by `scale prompt optimize` and `scale define`.

## 门禁说明

| Gate | 作用 |
| --- | --- |
| G1 | 探索是否记录到状态文件，且至少读了 3 个文件 |
| G2 | 计划是否包含边界、异常、回滚、现实校验 |
| G3 | `src/` 行为改动是否伴随测试改动 |
| G4 | workflow 脚本是否可解析 |
| G5 | `lint + typecheck + test + build` 是否通过 |
| G6 | 任务证据和 `git diff --check` 是否通过 |
| G7 | 安全面是否通过 |
| G8 | Markdown 与工作流文档是否符合基础卫生规则 |

## 分支策略

当前仓库采用 GitLab Flow 风格：

```text
feature/fix/docs/chore/codex -> dev -> master
```

约束：

- `dev` 是集成分支。
- `master` 是生产基线。
- `release/*` 只在必须从生产基线隔离发版时使用。
- `hotfix/*` 用于生产紧急修复，并要求回流 `dev`。

## 升级入口

如果要把仓库工作流继续升级到更新的 `scale-engine` 版本，先跑：

```bash
make bootstrap-scale
make workflow-upgrade-check
make workflow-upgrade-plan
make workflow-aios-adopt
```

先审计划，再决定是否 `make workflow-upgrade-apply`。如果计划提示 AI OS runtime 尚未接入，使用 `make workflow-aios-adopt` 生成运行态目录、首份 dry-run、benchmark 和 doctor 报告。
