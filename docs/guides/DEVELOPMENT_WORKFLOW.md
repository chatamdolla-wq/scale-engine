# SCALE Engine 开发工作流

这份文档说明日常如何在 `scale-engine` 仓库里按最新工程化工作流工作。

## 标准闭环

```text
探索 -> 规划 -> 执行 -> 验证 -> 沉淀
```

## 1. 探索

目标：先弄清真实仓库状态，再动手。

```bash
make new-task NAME=task-slug LEVEL=M
make plan NAME=task-slug LEVEL=M
make explore FILES='AGENTS.md CLAUDE.md README.md package.json src/api/cli.ts' MSG='main contradiction'
make gate-workflow
```

最低要求：

- 至少读 3 个相关文件。
- 写清主矛盾，而不是只列文件名。
- 对不确定项明确标出，不靠猜。

## 2. 规划

在 `.planning/tasks/<task>/plan.md` 里至少补齐这些信息：

- scope / boundary
- acceptance criteria
- exception / failure path
- rollback / fallback
- verification commands

如果任务改动发布、权限、安全、凭据、npm 发版或破坏性行为，按 `CRITICAL` 处理。

## 3. 执行

原则：

- 最小必要修改。
- 优先复用现有脚本和 `npm` 命令，不再发明第二套命令。
- 改 `src/` 行为时，原则上同步改 `tests/`，否则会被 G3 拦下。

## 4. 验证

推荐顺序：

```bash
make gate-quality
make verify PROFILE=default
git diff --check
```

其中：

- `G4` 验证 workflow 脚本本身可解析。
- `G5` 运行 `lint + typecheck + test + build`。
- `G6` 检查任务证据和 diff hygiene。
- `G7` 是安全面，默认走 `npm audit --audit-level=high`。
- `G8` 检查 Markdown 与工作流文档的基础卫生。

## 5. 沉淀

应该留下：

- `verification.md`
- `review.md`
- `summary.md`
- 必要的长期规则文档更新

不应该留下：

- 临时日志
- worktree 状态
- 截图、trace、缓存
- 只对一次任务有意义的中间文件
