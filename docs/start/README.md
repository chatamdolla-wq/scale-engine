# SCALE Engine 入门路径

这个目录只放面向新用户的上手内容。目标是让用户先跑通，再理解完整体系。

## 推荐阅读顺序

1. [3 分钟快速开始](quickstart.md)
   从空目录初始化治理工作流，看到 `.scale`、模板、验证 profile 和状态输出。

2. [官方 Demo Walkthrough](agent-governance-demo.md)
   用一个 OAuth state 加固任务演示：上下文对齐、诊断计划、TDD 切片、HTML artifact、资源治理和工程规范扫描。

3. 回到根目录 [README](../../README.md)
   理解 SCALE Engine 的核心能力和 governance pack 选择。

4. [升级管理](../UPGRADE_MANAGEMENT.md)
   理解工作流更新、第三方 skills/MCP/CLI 更新时如何先检查、生成计划、避免覆盖本地改动。

5. 查看 [文档地图](../README.md)
   区分哪些文档是用户指南、哪些是参考资料、哪些是历史规划和过程记录。

## 你应该先看到什么

跑完 quickstart 后，至少应该能看到：

- `scale preflight --preflight-profile quick` 可以执行。
- `scale status` 能告诉你当前项目下一步该做什么。
- `.scale/verification.json` 存在，并描述本地验证 profile。
- `docs/workflow/templates/` 存在，并包含 Mini-PRD、plan、verification、review、summary 等模板。
- `scale artifact render` 可以把任务 Markdown 证据渲染成 HTML。

如果其中任何一步失败，先看命令输出，不要假设是环境问题。SCALE 的原则是：没有真实命令结果，就不声称通过。

## 场景选择

| 场景 | 推荐入口 |
| --- | --- |
| 第一次试用 | [3 分钟快速开始](quickstart.md) |
| 想看 Agent 治理闭环 | [官方 Demo Walkthrough](agent-governance-demo.md) |
| 前端项目 | `scale init --governance-pack frontend-app` |
| Node/TypeScript 包 | `scale init --governance-pack node-library` |
| Go 多服务后端 | `scale init --governance-pack go-service-matrix` |
| 多仓库/MOE 工作区 | `scale init --governance-pack moe-workspace` |
| 文档、报告、截图、脚本混乱 | `scale init --governance-pack resource-governance` |
| 工作流或第三方能力要升级 | `scale upgrade check && scale upgrade plan --html` |


## 工作流升级短路径

已有项目先看 [SCALE workflow upgrade guide](workflow-upgrade.md)。它说明 `scale init --interactive`、`scale upgrade check/plan/apply/rollback`、仓库本地 `make workflow-upgrade-*` 入口，以及生成文件更新和项目级验证之间的边界。
