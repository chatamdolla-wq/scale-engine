# SCALE Engine 文档地图

这个目录同时包含用户指南、参考文档、历史规划和推广材料。为了避免新用户迷路，请按下面的分层阅读。

## 新用户入口

| 文档 | 说明 |
| --- | --- |
| [start/README.md](start/README.md) | 入门路径总览 |
| [start/quickstart.md](start/quickstart.md) | 3 分钟快速开始 |
| [start/agent-governance-demo.md](start/agent-governance-demo.md) | 官方 demo walkthrough |
| [../README.md](../README.md) | 项目主页和能力总览 |

## 当前治理能力

| 文档 | 说明 |
| --- | --- |
| [RESOURCE_GOVERNANCE.md](RESOURCE_GOVERNANCE.md) | 文档、报告、媒体、脚本、临时产物的生命周期治理 |
| [ENGINEERING_STANDARDS.md](ENGINEERING_STANDARDS.md) | 日志、安全、ORM、框架、测试、部署等工程规范 |
| [TOOL_ORCHESTRATION.md](TOOL_ORCHESTRATION.md) | skills、MCP、CLI、浏览器、桌面自动化的编排策略 |
| [SKILL-REPOSITORY.md](SKILL-REPOSITORY.md) | 受治理 skill repository 和安装安全策略 |
| [VIBE-TEMPLATES.md](VIBE-TEMPLATES.md) | 可复制的 Vibe Coding 提示词模板 |
| [LEADERSHIP-PRESETS.md](LEADERSHIP-PRESETS.md) | CEO/CTO/PM/Architect 等内置领导者角色预设 |

## 架构与参考

| 文档 | 说明 |
| --- | --- |
| [00-OVERVIEW.md](00-OVERVIEW.md) | 系统概览 |
| [01-ARCHITECTURE.md](01-ARCHITECTURE.md) | 架构设计 |
| [02-DATA-MODEL.md](02-DATA-MODEL.md) | 数据模型 |
| [03-CORE-MODULES.md](03-CORE-MODULES.md) | 核心模块 |
| [04-INTEGRATION.md](04-INTEGRATION.md) | 平台与集成 |
| [06-DECISIONS.md](06-DECISIONS.md) | 架构决策记录 |

## 历史规划和过程记录

这些文档是历史上下文，不一定代表当前产品入口：

| 文档 | 说明 |
| --- | --- |
| [05-ROADMAP.md](05-ROADMAP.md) | 路线图 |
| [OPTIMIZATION_PLAN.md](OPTIMIZATION_PLAN.md) | 历史优化计划 |
| [WEEK1-2-REPORT.md](WEEK1-2-REPORT.md) | 阶段报告 |
| [TASK_GUARD_SUMMARY.md](TASK_GUARD_SUMMARY.md) | Task Guard 总结 |
| [TASK_GUARD_WORKFLOW_DEMO.md](TASK_GUARD_WORKFLOW_DEMO.md) | 早期 workflow demo |
| [plans/](plans/) | 规划方案和技术方案归档 |
| [superpowers/](superpowers/) | 外部方法论对照和计划归档 |

## 推广和素材

| 文档 | 说明 |
| --- | --- |
| [promote-article-v3.md](promote-article-v3.md) | 推广文章草稿 |
| [promote-article-v3.html](promote-article-v3.html) | 推广文章 HTML 版本 |
| [imgs/](imgs/) | 社群二维码和推广图片 |

## 维护规则

- 面向新用户的文档优先放在 `docs/start/`。
- 当前可执行能力放在根 README 和当前治理能力文档中。
- 历史规划不要混入新手教程，避免用户把旧计划当当前事实。
- 如果 CLI 行为变化，必须同步更新 README、`docs/start/quickstart.md` 和相关 reference 文档。
- 如果新增 governance pack，必须同时更新 README、`docs/start/README.md` 和对应测试。

