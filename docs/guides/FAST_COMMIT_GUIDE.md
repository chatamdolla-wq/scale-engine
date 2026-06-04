# Fast-lane 快速提交指南

**适用场景**: S 级任务（typo、注释、配置改动、文档修正）
**目标耗时**: <120s（vs 标准流程 200s+）

---

## 什么时候用 Fast-lane

| 用 Fast-lane | 不用 Fast-lane |
|---|---|
| 修 typo | 新增功能 |
| 改注释 | 修改业务逻辑 |
| 调配置值 | 涉及安全/认证 |
| 更新文档链接 | 数据库变更 |
| 格式化代码 | 架构调整 |

**判断标准**: 改动不涉及 `src/` 下的业务代码，或改动量 <10 行且无逻辑变化。

---

## 使用方法

### Shell（推荐）

```bash
bash scripts/gates/all.sh --fast-lane
```

### Makefile

```bash
make gate-fast-lane
```

### CLI

```bash
scale preflight --preflight-profile fast-lane
```

---

## Fast-lane 运行哪些 Gate

| Gate | 名称 | 说明 |
|------|------|------|
| G3 | TDD Evidence | 检查测试文件是否同步修改 |
| G0 | Build | 构建必须通过 |
| G4 | Lint | 代码风格检查 |
| G5 | Tests | 测试必须通过 |

### 跳过的 Gate

| Gate | 名称 | 为什么跳过 |
|------|------|-----------|
| G1 | Exploration | S 级不需要探索记录 |
| G2 | Planning | S 级不需要规划文档 |
| G6 | Coverage | S 级改动小，覆盖率影响可忽略 |
| G7 | Security | S 级不涉及安全变更 |
| G8 | Doc Standards | 文档标准在 G4 lint 中覆盖 |
| G9-G15 | Meta Governance | 元治理对 S 级过重 |
| G16-G22 | Enhanced Gates | 增强门禁对 S 级过重 |

---

## 工作流对比

```
标准流程 (M/L 级):
  explore → plan → execute → gate-workflow → gate-quality → verify
  耗时: ~200s

Fast-lane (S 级):
  edit → gate-fast-lane → commit
  耗时: <120s
```

---

## 示例

### 修复文档 typo

```bash
# 1. 修改文件
vim README.md

# 2. 跑 fast-lane
make gate-fast-lane

# 3. 提交
git add README.md
git commit -m "docs: fix typo in README"
```

### 调整配置值

```bash
# 1. 修改配置
vim .scale/verification.json

# 2. 跑 fast-lane
make gate-fast-lane

# 3. 提交
git add .scale/verification.json
git commit -m "chore: update verification config"
```

---

## 常见问题

### Q: Fast-lane 可以用于 M/L 级任务吗？

**不行。** M/L 级任务必须走标准流程（gate-workflow + gate-quality）。Fast-lane 仅适用于 S 级。

### Q: Fast-lane 失败了怎么办？

如果 G0/G3/G4/G5 任何一个失败，说明改动有问题，需要修复后重跑。Fast-lane 失败不应该被忽略。

### Q: 如何确认任务是 S 级？

按 SCALE 任务分级：
- **S 级**: ≤30 行改动 / typo / 注释 / 配置
- **M 级**: 30-200 行 / 2-5 文件 / 有逻辑变化
- **L 级**: ≥200 行 / 跨模块 / 架构变更

---

## 相关文档

- [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md) - 完整开发流程
- [GATES_AND_SCORE.md](../workflow/GATES_AND_SCORE.md) - 门禁定义
- [IMPROVEMENT_ROADMAP.md](../workflow/IMPROVEMENT_ROADMAP.md) - 改进项 #1
