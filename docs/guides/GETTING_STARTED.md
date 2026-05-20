# SCALE Engine 仓库上手

这份文档面向要开发 `scale-engine` 仓库本身的人，不是面向安装 CLI 的最终用户。

## 15 分钟路径

1. 先读根目录 [README.md](../../README.md)。
2. 跑本仓库 workflow 预检：

```bash
make preflight
```

3. 看当前可用验证面：

```bash
make verify-list
```

4. 建一个任务骨架并记录探索：

```bash
make new-task NAME=example LEVEL=M
make plan NAME=example LEVEL=M
make explore FILES='AGENTS.md CLAUDE.md README.md package.json' MSG='main contradiction'
make gate-workflow
```

5. 做完改动后跑质量面：

```bash
make gate-quality
make verify PROFILE=default
git diff --check
```

## 你应该看到什么

- `.scale/workspace.json` 明确了 `dev -> master` 的仓库分支策略。
- `.agent/project.json` 定义了本仓库的 Node/TypeScript 验证命令。
- `scripts/gates/*` 和 `scripts/workflow/*` 不是说明文档，而是可执行入口。
- `.planning/tasks/<date>-<task>/` 用于任务级证据，不再把临时过程写进 `docs/`。

## 常见误区

- `make gate-workflow` 通过，不代表代码质量通过。
- `make gate-quality` 通过，也不代表你已经记录了风险、回滚和未验证项。
- `G8` 会检查改动过的 Markdown 和工作流文档卫生，不替代业务验证。
- `--dry-run` 只能证明入口存在，不能写成“测试通过”。
- 不要把 `.claude/worktrees/`、`.agent/state/`、日志或截图提交进仓库。
