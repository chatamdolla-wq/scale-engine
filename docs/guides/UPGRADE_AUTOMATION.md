# SCALE Engine 升级自动化指南

**版本**: v0.46.0+

---

## 概述

SCALE Engine 提供安全的升级流程，从检查到应用到回滚，每一步都有保护。

```
scale upgrade check       → 查看当前状态
scale upgrade recommend   → 自动评估风险，推荐操作
scale upgrade plan        → 生成详细计划 (HTML)
scale upgrade apply       → 安全应用 (带备份)
scale upgrade rollback    → 回滚到上一版本
```

---

## 快速升级 (推荐)

```bash
# 1. 一键推荐 + 自动应用
scale upgrade recommend --dir . --auto-apply

# 等价于:
#   scale upgrade recommend --dir .   # 评估风险
#   scale upgrade apply --dir . --confirm --auto-backup  # 安全应用
```

---

## 命令详解

### `scale upgrade recommend`

自动分析升级风险，计算风险分数，推荐操作。

```bash
scale upgrade recommend --dir .
scale upgrade recommend --dir . --json
scale upgrade recommend --dir . --auto-apply
```

**输出示例**:
```
SCALE 升级推荐
  项目: /path/to/project
  🟢 风险分数: 2 (low)
  ✅ 推荐: safe-to-apply
  摘要: 2 step(s), risk score 2; SCALE Engine up to date
  应用模式: safe
  建议命令:
    scale upgrade apply --dir . --confirm --auto-backup
    scale preflight --preflight-profile quick
```

**风险分数**:
- 每个步骤根据风险等级计分: low=1, medium=3, high=5
- 每个 blocker 额外 +5 分
- 总分 <4 = low, 4-9 = medium, >=10 = high

**推荐类型**:
- `safe-to-apply`: 无 blocker，applyMode=safe，可直接应用
- `review-first`: 有本地改动或需要人工审查
- `blocked`: 有 blocker，需先解决

---

### `scale upgrade apply --auto-backup`

应用升级前自动创建 git 分支备份。

```bash
scale upgrade apply --dir . --confirm --auto-backup
```

**自动备份流程**:
1. 检查是否在 git 仓库中
2. 如有未提交更改，先 `git stash`
3. 创建备份分支 `scale-backup-<timestamp>`
4. 恢复 stash (如有)
5. 继续正常的文件级备份和升级应用

**回滚到 git 备份**:
```bash
# 查看备份分支
git branch | grep scale-backup

# 回滚到备份
git reset --hard scale-backup-2026-06-03T12-00-00-000Z
```

---

### `scale upgrade check`

检查当前升级状态。

```bash
scale upgrade check --dir .
scale upgrade check --dir . --json
```

**状态说明**:
- `clean`: 一切最新，无需升级
- `updates-available`: 有可用更新
- `local-changes`: 生成文件有本地改动
- `missing-lock`: 缺少 governance.lock.json

---

### `scale upgrade plan`

生成详细的非破坏性升级计划。

```bash
scale upgrade plan --dir .
scale upgrade plan --dir . --html  # 生成 HTML 报告
```

---

### `scale upgrade rollback`

回滚最近一次升级。

```bash
scale upgrade rollback --dir .
```

---

## 升级故障排查

### 常见问题

#### 1. `applyMode: manual-review`

**原因**: 生成文件有本地改动，SCALE 不会自动覆盖。

**解决**:
```bash
# 查看哪些文件有改动
scale upgrade check --dir .

# 手动审查改动
git diff .scale/

# 确认后强制应用
scale upgrade apply --dir . --confirm
```

#### 2. `missing-governance-lock`

**原因**: 没有 governance.lock.json，SCALE 无法追踪文件状态。

**解决**:
```bash
scale init --governance-pack standard
```

#### 3. Git 备份失败

**原因**: 不在 git 仓库中，或 git 配置问题。

**解决**: 文件级备份仍会创建在 `.scale/backups/` 中，可手动回滚:
```bash
scale upgrade rollback --dir .
```

#### 4. 升级后测试失败

**解决**:
```bash
# 回滚
scale upgrade rollback --dir .

# 或回滚到 git 备份
git reset --hard scale-backup-<timestamp>
```

---

## 最佳实践

1. **总是先 recommend**: `scale upgrade recommend --dir .` 了解风险
2. **使用 --auto-backup**: 升级前创建 git 备份点
3. **升级后跑 preflight**: `scale preflight --preflight-profile quick`
4. **保留备份分支**: 确认升级无问题后再删除: `git branch -d scale-backup-<timestamp>`

---

## 相关文档

- [MIGRATION.md](MIGRATION.md) — 版本迁移指南
- [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md) — 开发流程
- [PERFORMANCE_BASELINE.md](../PERFORMANCE_BASELINE.md) — 性能基准
