# 变更文档模板

> 变更管理目录结构：changes/{需求ID}/

## 目录结构

```
changes/
└── {需求ID}/              # 如 REQ-20260115-001
    ├── spec.md            # WHAT: 需求描述
    ├── plan.md            # HOW: 技术方案
    ├── tasks.md           # DO: 任务列表
    ├── evidence.md        # 验证证据
    └── rollback.md        # 回滚方案
```

## spec.md 内容

```markdown
# {需求标题}

## 背景
为什么需要这个变更？

## 目标
变更后的预期状态。

## 边界
- In Scope: 包含的内容
- Out of Scope: 不包含的内容

## 验收标准
- [ ] 标准 1
- [ ] 标准 2
```

## plan.md 内容

```markdown
# 技术方案

## 技术选型
- 方案 A vs 方案 B 的权衡

## 影响面分析
- 模块 1: 修改点
- 模块 2: 新增点

## 数据模型变更
- 新增表/字段
- 迁移策略

## 回滚策略
如何安全回滚？
```

## tasks.md 内容

```markdown
# 任务列表

## Phase 1: 准备
- [ ] TASK-001: 创建数据模型
- [ ] TASK-002: 编写迁移脚本

## Phase 2: 实现
- [ ] TASK-003: 实现核心逻辑
- [ ] TASK-004: 编写测试

## Phase 3: 验证
- [ ] TASK-005: 运行测试
- [ ] TASK-006: 代码评审
```
