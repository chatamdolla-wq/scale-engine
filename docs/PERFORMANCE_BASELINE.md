# SCALE Engine — Performance Baseline

**版本**: 1.0  
**首次测量**: 2026-06-03  
**最近更新**: 2026-06-03  
**测量环境**: Windows 10, MINGW64_NT-10.0-19045 x86_64, Node v22.13.1

---

## 概述

本文档记录 SCALE Engine 门禁系统的性能基线数据。用于：
- 建立性能参考线
- 检测性能回归
- 指导优化方向

**目标**: Fast-lane 总耗时 <120s（当前未达标，主要瓶颈在 G5 测试）

---

## Fast-lane 基线 (G0/G3/G4/G5)

| Gate | 名称 | 平均耗时 | 最小 | 最大 | 样本数 | 状态 |
|------|------|----------|------|------|--------|------|
| G0 | Build | — | — | — | 0 | ⏭ skipped (无脚本) |
| G3 | TDD Evidence | 281ms | 250ms | 303ms | 3 | ✅ fast |
| G4 | Lint | 1,755ms | 1,408ms | 2,276ms | 3 | ✅ fast |
| G5 | Tests | 467,550ms | 347,239ms | 680,111ms | 3 | ❌ bottleneck |
| **Total** | | **470,168ms** | — | — | 3 | ❌ >120s |

### 详细数据 (CSV)

```
run,gate,duration_ms,status
1,G3,303,pass
1,G4,2276,pass
1,G5,680111,pass
2,G3,290,pass
2,G4,1583,pass
2,G5,375300,pass
3,G3,250,pass
3,G4,1408,pass
3,G5,347239,pass
```

---

## 性能分布

```
G3 (TDD Evidence)    ████ 0.3s (0.06%)
G4 (Lint)            ██████████ 1.8s (0.37%)
G5 (Tests)           ████████████████████████████████████████████████████ 467.5s (99.57%)
```

**关键发现**: G5 (Tests) 占总耗时 99.6%，是唯一的性能瓶颈。

---

## 优化建议

### 1. 测试分层 (高优先级)

当前 G5 运行完整测试套件 (1669 tests)。建议：
- Fast-lane 模式只运行受影响的测试 (vitest --changed)
- 或将测试分为 smoke/full 两层
- 预期收益: 467s → 30-60s

### 2. 并行化 (中优先级)

- vitest 默认单线程，可配置 `--pool=threads` 或 `--pool=forks`
- 预期收益: 467s → 200-250s

### 3. 缓存 (中优先级)

- 测试结果可缓存 (vitest --cache)
- Lint 结果可缓存 (eslint --cache)
- 预期收益: 重复运行时 G4/G5 大幅加速

### 4. G0 脚本补全 (低优先级)

- 当前 G0 (Build) 无 shell 脚本，被跳过
- G5 内部已包含 build，但独立的 G0 脚本可提供更清晰的反馈

---

## 目标

| 指标 | 当前 | 短期目标 (3月) | 长期目标 (6月) |
|------|------|----------------|----------------|
| Fast-lane 总耗时 | ~470s | <120s | <60s |
| G3 (TDD) | 281ms | <500ms | <500ms |
| G4 (Lint) | 1.8s | <3s | <2s |
| G5 (Tests) | 467s | <100s | <50s |

---

## 复现方法

```bash
# 运行性能测量 (3 次)
bash scripts/performance/measure-gates.sh --runs 3 --mode fast-lane

# 查看结果
cat performance-trend.csv
```

---

## 相关文档

- [IMPROVEMENT_ROADMAP.md](workflow/IMPROVEMENT_ROADMAP.md) — 改进路线图 #7
- [FAST_COMMIT_GUIDE.md](guides/FAST_COMMIT_GUIDE.md) — Fast-lane 使用指南
- [DEVELOPMENT_WORKFLOW.md](guides/DEVELOPMENT_WORKFLOW.md) — 完整开发流程
