# SCALE Engine

> **S**caffold · **C**ontrol · **A**rtifact · **L**earn · **E**volve
>
> AI 工程化脚手架引擎 — 让 AI Agent 在物理约束下工作，而不是靠提示词自律。

[![Tests](https://img.shields.io/badge/tests-148%2B%20passed-brightgreen)]()
[![Node](https://img.shields.io/badge/node-%3E%3D20-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

## 核心理念

```
提示词说 "你应该跑测试"    → AI 可以假装跑了  ❌
Stop Hook 检查 "未跑测试"  → AI 物理无法跳过  ✅
```

## 六层架构

```
L1 Context       — Token 预算 + 上下文组装
L2 Guardrails    — 8 检测器 + Role 网关
L3 Observability — EventBus + BehaviorTracker
L4 Orchestration — TaskEngine + Effects + ModelRouter
L5 Memory        — KnowledgeBase + 衰减算法
L6 Evolution     — Defect→Lesson→Rule→Hook 自进化
```

## 快速开始

```bash
npm install -g @hongmaple0820/scale-engine
cd your-project
scale init --agent claude-code
scale doctor
scale create Spec "用户导出 Excel 功能"
scale transition SPEC-xxx refine
scale transition SPEC-xxx approve   # ambiguity > 0.2 物理拦截
```

## CLI 命令 (13 个)

| 命令 | 说明 |
|------|------|
| `scale init` | 初始化 (.scale/ + hooks + CLAUDE.md) |
| `scale doctor` | 环境诊断 + 健康检查 |
| `scale create` | 创建 Artifact |
| `scale list` | 列表查询 |
| `scale show` | 详情 |
| `scale transition` | 状态迁移 (含 guard) |
| `scale role` | 角色切换 |
| `scale context` | 组装上下文 |
| `scale evolve` | 进化周期 |
| `scale stats` | 统计 |
| `scale session` | 会话管理 |
| `scale gate` | 网关检查 |

## 11 种 Artifact · 4 级自进化 · 8 个检测器

详见 `docs/` 目录。

## License

MIT
