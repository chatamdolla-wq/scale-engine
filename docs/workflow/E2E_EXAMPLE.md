# 端到端示例：从 `make new-task` 到提交

本文走一遍**完整一次任务**：建任务 → 探索 → 规划 → 过工作流门 → 提交。
用 **L 级**任务，因为它能覆盖 G2 对「human confirmation」的要求。

> 范围说明：本文聚焦 `make new-task → 提交全程`。
> 关于 FSM Guard（物理阻止「未验证就 COMPLETE」）的**状态机**示例，
> 见 [../TASK_GUARD_WORKFLOW_DEMO.md](../TASK_GUARD_WORKFLOW_DEMO.md)，本文不重复。
>
> 模板怎么选见 [TEMPLATE_GUIDE.md](TEMPLATE_GUIDE.md)，门禁目录见 [GATES_AND_SCORE.md](GATES_AND_SCORE.md)。

下面每条命令和输出均在本仓库实跑（日期取运行当天，你本地会不同）。

---

## 1. 建任务

```bash
make new-task NAME=add-dark-mode LEVEL=L
```

```text
bash scripts/workflow/new-task.sh "add-dark-mode" "L"
[NEW-TASK] created: /.../.planning/tasks/2026-06-11-add-dark-mode
[NEW-TASK] state: /.../.agent/state/current.json
[NEW-TASK] next: fill explore.md, runtime.md, and reality-check.md before execution
```

`new-task` 在 `.planning/tasks/<date>-add-dark-mode/` 一次性生成 9 个核心制品：
`explore.md`、`mini-prd.md`、`plan.md`、`runtime.md`、`reality-check.md`、
`resource-cleanup.md`、`verification.md`、`review.md`、`summary.md`。

> 需要 `spec.md` / `tasks.md`（深规划）时改用 `make plan NAME=add-dark-mode LEVEL=L`。

---

## 2. 探索（G1）

读至少 3 个相关文件并写清主矛盾：

```bash
make explore FILES='AGENTS.md docs/workflow/templates/plan.md src/api/cli.ts' \
  MSG='template selection has no guidance'
```

```text
[EXPLORE] recorded 3 files
[EXPLORE] main contradiction: template selection has no guidance
```

---

## 3. 规划（G2）

编辑 `.planning/tasks/<date>-add-dark-mode/plan.md`，把各段的 `TBD` 填成真内容。
模板已内置 G2 需要的全部段落（见 [TEMPLATE_GUIDE §4](TEMPLATE_GUIDE.md#4-模板--门禁映射)）：
范围、异常（≥3 次）、回滚、验收，以及 **L/CRITICAL 的 `## Human Confirmation` 段**。
你要做的是**填内容**，而不是补标题。

跑计划门，开箱即过：

```bash
bash scripts/gates/G2-verify.sh
```

```text
========================================
[G2] Plan gate
========================================
[G2] checking: /.../.planning/tasks/2026-06-11-verify-plan-template/plan.md
[G2] passed
[G2] exception/error mentions: 6
```

> `exception/error mentions: 6` 说明异常覆盖 ≥ 3，满足 G2。
> 若把 `## Human Confirmation` 段删掉，L/CRITICAL 会被 G2 拦下
> （`[G2] L/CRITICAL plan should record human confirmation requirement`）——
> 这正是模板默认保留该段的原因。

---

## 4. 执行 + 工作流门（G1/G2/G3/G16）

写代码时记住：改 `src/` 行为要同步改 `tests/`，否则 G3 拦下。改完跑：

```bash
make gate-workflow
```

该聚合命令依次跑 G1、G2、G3、G16。本次因为只动文档/计划、未改 `src/`，
G3 会跳过（`no source behavior changes detected; skip`）。

---

## 5. 质量门 + 完整验证

```bash
make gate-quality            # G0,G4,G5,G6,G7,G8,G17,G18,G19,G20
make verify PROFILE=default  # 完整 profile 验证
git diff --check
```

L 级任务别忘了留审查记录（`.agent/state/review-*.json`），否则 G19 阻断。

---

## 6. 提交

按 [CONTRIBUTING.md](../../CONTRIBUTING.md) 的约定从 `master` 切 `docs/*`、
`feature/*` 或 `fix/*` 分支，提交信息用 `<type>: <desc>`：

```bash
git checkout -b feature/add-dark-mode
git add src/ tests/
git commit -m "feat: add dark mode toggle"
```

> `.planning/` 与 `.agent/state/` 已在 `.gitignore` 中，任务制品不会被提交，
> 它们是给门禁和人审用的过程证据，不进生产代码。

---

## 速查

```text
make new-task NAME=x LEVEL=L     # 建任务 + 生成制品
make explore FILES='...' MSG='...'  # G1：探索 ≥3 文件 + 主矛盾
# 编辑 plan.md（含 Human Confirmation）
make gate-workflow               # G1,G2,G3,G16
make gate-quality                # G0,G4,G5,G6,G7,G8,G17,G18,G19,G20
make verify PROFILE=default      # 完整验证
git diff --check
```
