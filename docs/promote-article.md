# SCALE Engine v0.8.0 发布：让 AI Agent 在物理约束下工作，告别提示词"自律"

> 当你的 AI 编码助手声称"已完成"但没跑测试时，你会怎么做？
> 当它反复用同一策略重试失败时，你还能相信它吗？
> 当它甩锅说"环境问题"却没有任何验证时，你是不是很崩溃？

---

## 问题：AI 编码的"自律陷阱"

如果你用过 Claude Code、Cursor、Copilot 等 AI 编码工具，一定遇到过这些场景：

```
❌ 提示词说 "你应该跑测试"    → AI 可以假装跑了
❌ 提示词说 "不要硬编码密钥"  → AI 可以忽视规则  
❌ 提示词说 "别暴力重试"      → AI 可以反复重试
❌ 提示词说 "先规划再写代码"  → AI 可以跳过规划直接写
```

**根本问题：提示词是"建议"，AI 可以选择性遵守。**

这就是 **AI 编码的"自律陷阱"** —— 我们试图用提示词教 AI "自律"，但 AI 本质上是概率模型，它没有真正的意志力。

---

## 解决方案：物理约束，而非提示词自律

**SCALE Engine** 的核心理念是：**不要让 AI "自律"，而是用物理约束强制 AI 遵守规则。**

```
✅ Stop Hook 检查 "未跑测试"  → AI 物理无法跳过验证
✅ PreTool Hook 拦截危险命令  → AI 物理无法执行 rm -rf
✅ FSM 状态机控制工作流       → AI 物理无法跳过规划阶段
✅ Role 网关限制工具权限      → AI 物理无法越权访问敏感文件
✅ 检测器发现异常行为         → AI 物理无法隐藏暴力重试
```

SCALE Engine 把"编码规范"从提示词层下沉到工具链层，用 **六层架构** 实现 AI 工程化。

---

## v0.8.0 新特性

### 🤝 12 专业 Agent Profiles

让前端 Agent 写 UI，后端 Agent 写 API，测试 Agent 写 E2E，**并行工作！**

| Agent | 专长 | 典型任务 |
|-------|------|---------|
| frontend-agent | React/Vue/CSS | 页面组件开发 |
| backend-agent | API/DB/Auth | 服务端逻辑 |
| test-agent | TDD/E2E | 测试用例编写 |
| code-review-agent | 质量/安全 | 代码审查 |

**使用示例：**

```bash
scale agent spawn --profile frontend
scale team create --profiles frontend,backend,test --task "实现用户认证"
scale team execute --parallel
```

### 🧠 TF-IDF 记忆召回

知识库真正"理解"你的问题：

```typescript
kb.recallByVector("登录失败怎么办", 10)  // 语义召回，不依赖精确 tags
```

### 🔄 自进化闭环

当 AI 犯错时，系统自动"学习"并阻止同类错误再发生：

```
Detector 发现异常 → 创建 Defect → 提取 Lesson → 生成 Rule → 写入 Hook
```

**Karpathy 反惰性原则：** 暴力重试、甩锅、工具闲置、忙碌假象、被动等待 —— 5 种懒惰模式都有反制机制。

---

## 实战案例：FSM 状态机阻止跳步

```
PENDING → PLANNING → APPROVED → IMPLEMENT → VERIFY → COMPLETE
   ↓          ↓          ↓           ↓          ↓
 必须输出   人工审核    才能编码    必须测试    才能完成
 设计文档
```

AI **物理无法**跳过任何阶段！

---

## 快速开始

```bash
npm install @hongmaple0820/scale-engine

scale init --scenario standard
scale doctor
scale workflow list
```

支持 11 种主流 AI Agent：Claude Code、Codex CLI、OpenCode、Cursor、Gemini CLI 等。

---

## 开源信息

| 项目 | 链接 |
|------|------|
| GitHub | https://github.com/hongmaple0820/scale-engine |
| Gitee | https://gitee.com/hongmaple/scale-engine |
| npm | @hongmaple0820/scale-engine |
| 测试覆盖 | 410 tests |

---

## 加入社区

- **公众号「鸿枫技术栈」** — 关注获取最新动态
- **微信群** — 添加 mapleCx330 入群
- **知识星球（¥99/年）** — 专属技能包 + 深度案例 + 1v1 答疑

> 加入知识星球：https://t.zsxq.com/6T5Eq

---

开源不易，欢迎 Star ⭐ 支持！

GitHub: https://github.com/hongmaple0820/scale-engine
