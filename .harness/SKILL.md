# Harness Engineering Skill

> 基于「Harness Engineering」最佳实践，实现 AI Coding 90% 成功率

## 核心能力

### 1. 程序化质量门禁

使用 GateEvaluator 程序化验证：

```typescript
// CI 严格门禁
GateEvaluator.checkGate('ci-strict', {
  buildExitCode: 0,
  testPassed: true,
  testTotal: 50,      // 必须 > 0，防止空测试
  testFailed: 0
})

// 覆盖率门禁
GateEvaluator.checkGate('coverage-80', { testCoverage: 82 })
```

### 2. Premature Done 检测

PrematureDoneDetector 检测 4 种场景：
- 未运行验证命令
- 验证在编辑之前
- 测试 0/0 异常
- 测试失败
- 编译失败

### 3. SessionStart 标准序列

SessionStartSequence 执行：
1. Git Status → 未提交文件
2. Git Log → 最近 3 次提交
3. Progress File → 未完成任务
4. Recommendations → 建议下一步

### 4. 强制评审阶段

ReviewEnforcer 确保：
- 实现 Agent ≠ 评审 Agent
- 最多 2 次评审迭代
- 失败自动回滚

### 5. 分层编码规范

7 层规范文件：
- controller-spec.md: RPC Provider 模式
- service-interface-spec.md: DTO 设计
- service-impl-spec.md: 事务管理
- domain-spec.md: 价格 Long/分
- dao-spec.md: 乐观锁
- adapter-spec.md: 熔断/降级
- doc-spec.md: API 文档格式

## 触发条件

- 任务涉及代码编写 → 调用 coding-specs
- 声称完成 → PrematureDoneDetector 检测
- Session 开始 → SessionStartSequence

## 使用示例

```bash
# 检查质量门禁
scale gate check ci-strict

# 运行 SessionStart 序列
scale context inject --session-id $SESSION_ID

# 强制评审
scale review enforce --task TASK-001
```
