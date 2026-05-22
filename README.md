<p align="center">
  <img src="https://img.shields.io/badge/version-0.37.0-orange?style=flat-square" alt="version" />
  <img src="https://img.shields.io/badge/platforms-22-blue?style=flat-square" alt="platforms" />
  <img src="https://img.shields.io/badge/agents-12-blue?style=flat-square" alt="agents" />
  <img src="https://img.shields.io/badge/tests-verified-brightgreen?style=flat-square" alt="tests" />
  <img src="https://img.shields.io/badge/npm-0.37.0-cb3837?style=flat-square&logo=npm" alt="npm" />
</p>

# SCALE Engine

SCALE Engine 让 AI Agent 不再只靠"自觉"遵守工程规范。它把探索、规划、实现、验证、评审、发版这些要求变成可执行的命令、门禁和证据文件，让人类可以看见 Agent 做了什么、跳过了什么、为什么能交付或不能交付。

源码仓库：https://github.com/hongmaple0820/scale-engine
国内镜像：https://gitee.com/hongmaple/scale-engine
npm：https://www.npmjs.com/package/@hongmaple0820/scale-engine
语言：[中文](README.md) | [English](README.en.md)
更新记录：[CHANGELOG.md](CHANGELOG.md)

## 它解决什么问题

| 常见问题 | SCALE 的处理方式 |
| --- | --- |
| Agent 没验证却说"测试通过" | 通过 verification profile 和 evidence store 记录真实命令与结果 |
| Agent 跳过需求澄清、设计、TDD 或 review | 通过 `scale context`、`scale diagnose`、`scale tdd`、`scale status` 生成下一步动作 |
| Agent 攒代码不提交，最后难以分段 | 通过 Commit Discipline 监控 git 状态，双阈值告警，自动分组建议 |
| Agent 误提交无关文件或跨仓库改错位置 | 通过 review-gated ship、MOE workspace 和子仓库 blocker 控制边界 |
| 多会话并行开发产生冲突 | 通过 Session Coordinator 文件重叠检测、冲突记录、依赖拓扑排序 |
| 多仓库项目 Git 工作流混乱 | 通过 Cross-Repo Orchestrator 协调分支、合并计划、ship 流水线 |

## 3 分钟看到效果

```bash
npm install -g @hongmaple0820/scale-engine
mkdir scale-demo && cd scale-demo
scale init --governance-pack standard
scale preflight --preflight-profile quick
scale status
```

你会得到一套可提交到项目里的治理文件：

- `.scale/verification.json`：服务矩阵和验证 profile
- `.scale/skills.json`：skill 路由和证据要求
- `.scale/tools.json`：CLI/MCP/browser/desktop 工具编排规则
- `docs/workflow/templates/`：Mini-PRD、plan、verification、review、summary 模板
- `docs/standards/`：工程规范、Git 协作、资源治理规则

继续体验完整闭环：

```bash
scale context grill --task-id TASK-001 --task "加固 OAuth callback"
scale diagnose plan --task-id TASK-001 --symptom "callback 在 state 过期时返回 500"
scale tdd slice --task-id TASK-001 --behavior "拒绝过期 OAuth state" --failing-test "expired state returns 401"
```

完整教程见 [3 分钟快速开始](docs/start/quickstart.md) 和 [官方 Demo Walkthrough](docs/start/agent-governance-demo.md)。

## 安装

```bash
npm install -g @hongmaple0820/scale-engine
scale --version
```

需要 Node.js 20 或更高版本。

## 适合谁

- 正在用 Codex、Claude Code、Cursor、Gemini CLI、OpenCode、Aider 等 Agent 写真实项目的团队。
- 有多服务、多仓库、MOE workspace、前后端分离需求的团队。
- 希望 Agent 主动使用 skills、MCP、CLI、浏览器、E2E，但又需要安全边界和证据闭环的团队。
- 经常遇到"AI 改得快，但难审、难验、难维护"的项目负责人。

## 核心能力

| 能力 | 说明 |
|------|------|
| **Workflow Engine** | `define → plan → build → verify → review → ship` 阶段化交付状态机 |
| **Gate System** | build、lint、test、coverage、security、TDD、review 门禁 |
| **AI OS Runtime** | `scale ai-os plan/run/status` — 任务规划、受控运行、治理仪表盘 |
| **Commit Discipline** | 监控 git 状态，双阈值告警，自动分组未提交文件 |
| **Session Coordinator** | 多会话并行协调，文件重叠检测，冲突记录 |
| **Cross-Repo Orchestrator** | 多仓库 Git 工作流编排，协调分支/合并/ship |
| **Task Dependency Graph** | DAG 依赖声明，拓扑排序，环检测 |
| **Ship Pipeline** | 8 步 ship 闭环，支持 dry-run、skip、version bump |
| **Security Audit** | OWASP Top 10 + STRIDE 安全审计引擎 |
| **Role Skills** | 6 个角色化审查视角（eng-manager、security-reviewer、qa-lead 等） |
| **Memory Intelligence** | 6 信号质量评分，跨 provider 冲突检测，新鲜度衰减 |
| **Governance ROI** | 端到端治理 ROI 度量 — token 成本 vs 质量 vs 门禁摩擦 |

## AI OS Runtime

AI OS Runtime 是 SCALE 的核心运行时规划层。`scale ai-os plan` 在一次命令里生成风险治理模式、Context Compiler 预算、Memory Provider 召回、Skill Routing 执行计划和 Governance ROI，让 Agent 在开始任务前就知道应该加载什么上下文、调用什么能力、补什么证据。

```bash
scale ai-os plan \
  --task-id TASK-123 \
  --task "修复 OAuth callback auth token 并验证浏览器回调流程" \
  --level L \
  --files src/auth/oauth.ts,src/ui/callback.tsx \
  --budget 8000 \
  --json
```

详细命令见 [AI OS Runtime 文档](docs/AI_ENGINEERING_OS_POSITIONING.md)。

## 学习路径

| 目标 | 入口 | 你应该学会什么 |
| --- | --- | --- |
| 先跑起来 | [3 分钟快速开始](docs/start/quickstart.md) | 安装 CLI、初始化治理文件、运行 preflight |
| 看完整闭环 | [官方 Demo Walkthrough](docs/start/agent-governance-demo.md) | 任务上下文、诊断、TDD、artifact 和验证证据如何串起来 |
| 接入已有项目 | [SCALE 工作流升级指南](docs/start/workflow-upgrade.md) | `init`、`upgrade check/plan/apply`、本地 `make` 包装入口 |
| 选择治理包 | [Governance Pack 文档](docs/start/README.md) | 不同项目形态应该选哪个 pack |
| 维护或扩展 SCALE | [docs/README.md](docs/README.md) | 文档地图、内部模块和长期维护资料 |
| 开发本仓库 | [docs/guides/GETTING_STARTED.md](docs/guides/GETTING_STARTED.md) | `scale-engine` 仓库自身的工程化工作流 |

## 更新工作流

```bash
scale upgrade check --dir . --lang zh
scale upgrade plan --dir . --html --lang zh
scale upgrade apply --dir . --confirm --lang zh
```

SCALE 把升级分成三层：CLI 自身、已生成到项目里的 governance pack 文件、第三方 skills/MCP/CLI 能力。默认只检查和生成计划，不自动覆盖用户改过的文件。详见 [SCALE 工作流升级指南](docs/start/workflow-upgrade.md)。

## 开发本仓库

```bash
make preflight
make gate-workflow
make gate-quality
make verify PROFILE=default
```

入口文档：
- [docs/guides/GETTING_STARTED.md](docs/guides/GETTING_STARTED.md) — 15 分钟上手
- [docs/guides/DEVELOPMENT_WORKFLOW.md](docs/guides/DEVELOPMENT_WORKFLOW.md) — 日常开发闭环
- [docs/workflow/README.md](docs/workflow/README.md) — 门禁、分支策略和升级入口

## 社区与推广

| 平台 | 链接 | 说明 |
|------|------|------|
| GitHub | https://github.com/hongmaple0820/scale-engine | 源码、Issues、PR |
| Gitee | https://gitee.com/hongmaple/scale-engine | 国内镜像与反馈 |
| npm | https://www.npmjs.com/package/@hongmaple0820/scale-engine | CLI 包下载 |

<p align="center">
  <img src="image/wechat-public.jpg" alt="SCALE Engine 微信公众号" width="220" />
</p>

## 赞赏与支持

如果 SCALE Engine 节省了你的工程治理时间，或帮助你的团队把 AI Agent 工作流落到可验证、可复盘、可发版的闭环里，欢迎赞赏支持。赞赏用于持续维护、示例项目、文档、测试矩阵和社区支持。

<p align="center">
  <img src="image/wxPay.jpg" alt="微信赞赏" width="220" />
  &nbsp;&nbsp;
  <img src="image/zfb.jpg" alt="支付宝赞赏" width="220" />
</p>

## License

[MIT](LICENSE)
