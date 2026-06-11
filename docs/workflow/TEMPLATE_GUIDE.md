# 模板选择指南（Template Guide）

本指南回答两个一直没有文档化的问题：

1. **一个任务到底该用哪些模板？**（按等级 + 按改动类型）
2. **每个模板和哪个门禁挂钩？**（写不对会被哪个 Gate 拦下）

模板本体在 [`./templates/`](./templates/)，门禁目录见 [GATES_AND_SCORE.md](GATES_AND_SCORE.md)，
日常闭环见 [../guides/DEVELOPMENT_WORKFLOW.md](../guides/DEVELOPMENT_WORKFLOW.md)。

> 数据来源：模板选择矩阵从 `src/skills/routing/SkillPolicy.ts` 的 `domains` 提取；
> 等级脚手架从 `scripts/workflow/new-task.sh` 与 `scripts/workflow/plan.sh` 提取；
> 模板↔门禁映射从 `scripts/gates/*-verify.sh` 提取。改了这些源文件请同步本表。

---

## 1. 模板全景（24 个）

| 模板 | 一句话场景 | 谁生成/何时用 |
| --- | --- | --- |
| [explore.md](./templates/explore.md) | 记录读了哪些文件、主矛盾是什么 | `new-task` 自动生成，G1 检查 |
| [mini-prd.md](./templates/mini-prd.md) | 一页纸目标/范围/验收，需求侧澄清 | `new-task` 自动生成 |
| [spec.md](./templates/spec.md) | What / Why / 约束的规格说明 | `make plan` 深规划时生成 |
| [plan.md](./templates/plan.md) | 边界、异常、回滚、验收的实现计划 | `new-task` 自动生成，**G2 核心** |
| [tasks.md](./templates/tasks.md) | 计划拆成可勾选的任务清单 | `make plan` 深规划时生成 |
| [runtime.md](./templates/runtime.md) | 配置来源、运行环境、运行时契约 | `new-task` 自动生成，G2/G18 |
| [reality-check.md](./templates/reality-check.md) | 已确认/未验证/造假/受限分区自检 | `new-task` 自动生成，**G2 必填** |
| [resource-cleanup.md](./templates/resource-cleanup.md) | 新增资源保留/移动/删除的处置表 | `new-task` 自动生成，G2 必须存在 |
| [verification.md](./templates/verification.md) | 实际跑了哪些验证命令、结果如何 | `new-task` 自动生成，G8 |
| [review.md](./templates/review.md) | 代码审查发现与结论 | `new-task` 自动生成，**G19（L/CRITICAL）** |
| [summary.md](./templates/summary.md) | 改了什么、验证了什么、未验证什么 | `new-task` 自动生成，沉淀阶段 |
| [api-contract.md](./templates/api-contract.md) | 接口端点、请求/响应、错误码契约 | 改 API/路由时（domain: api） |
| [db-change-plan.md](./templates/db-change-plan.md) | 表结构/数据变更与向后兼容 | 改 DB/迁移时（domain: db） |
| [security-review.md](./templates/security-review.md) | 资产、信任边界、鉴权规则审查 | 改鉴权/权限/迁移时（domain: security/db） |
| [architecture-review.md](./templates/architecture-review.md) | 触及的模块、公共契约、数据流评估 | 跨模块/标准类改动（domain: engineeringStandards） |
| [standards-impact.md](./templates/standards-impact.md) | 日志脱敏、架构边界、ORM 等规范核对 | 改 `src/` 工程规范面（domain: engineeringStandards） |
| [docs-impact.md](./templates/docs-impact.md) | 代码改动需要同步哪些文档 | 改文档或带文档影响时（domain: docs） |
| [resource-impact.md](./templates/resource-impact.md) | 产物的 Git 策略与保留期 | 涉及资产/媒体/报告时（domain: resourceGovernance） |
| [ui-spec.md](./templates/ui-spec.md) | 用户目标与主流程的 UI 规格 | 改前端/界面时（domain: ui） |
| [visual-review.md](./templates/visual-review.md) | 截图证据、布局与响应式核对 | 改 UI 后的视觉验收（domain: ui） |
| [e2e-plan.md](./templates/e2e-plan.md) | 用户路径与浏览器覆盖计划 | E2E/浏览器自动化（domain: e2e/browserAutomation） |
| [product-smoke.md](./templates/product-smoke.md) | 经真实产品边界的最小端到端路径 | 需要产品冒烟证据时（G8 profile） |
| [skill-plan.md](./templates/skill-plan.md) | 识别到的领域意图与技能选择 | skill 路由启用时（多数 domain 必备） |
| [skill-evidence.md](./templates/skill-evidence.md) | 技能/工具选择理由与证据 | skill 路由启用时（多数 domain 必备） |

---

## 2. 按任务等级选模板

任务等级定义见 [AGENTS.md](../../AGENTS.md) 的「任务等级」表。脚手架由
`make new-task` / `make plan` 生成，下表标注**最低**要求。

| 模板 | S | M | L | CRITICAL |
| --- | :-: | :-: | :-: | :-: |
| explore.md | ✅ | ✅ | ✅ | ✅ |
| plan.md | 选填 | ✅ | ✅ | ✅ |
| reality-check.md | 选填 | ✅ | ✅ | ✅ |
| runtime.md | 选填 | ✅ | ✅ | ✅ |
| resource-cleanup.md | 选填 | ✅ | ✅ | ✅ |
| verification.md | ✅ | ✅ | ✅ | ✅ |
| summary.md | 选填 | ✅ | ✅ | ✅ |
| mini-prd.md | — | 选填 | ✅ | ✅ |
| spec.md / tasks.md | — | 选填 | ✅ | ✅ |
| review.md | — | 选填 | ✅（G19 阻断） | ✅（G19 阻断） |
| security-review.md | — | 视改动 | 视改动 | ✅（安全/权限/发布） |

要点：

- `make new-task NAME=x LEVEL=M` 一次性生成 9 个核心制品（explore、mini-prd、plan、
  runtime、reality-check、resource-cleanup、verification、review、summary）。
- `make plan NAME=x LEVEL=L` 额外生成 spec.md、tasks.md（深规划）。
- **L / CRITICAL 的 plan.md 必须写「human confirmation / review before execution」**，
  否则 G2 直接报错（见 §4）。
- CRITICAL（安全、权限、发布、破坏性操作）需补 security-review.md 并完成人工确认。

---

## 3. 按改动类型选模板（领域矩阵）

下表直接对应 `SkillPolicy.ts` 的 `domains`。命中任一「触发」条件（改动的文件路径或
任务描述关键词），就应补齐对应**必备模板**。`skill-plan.md` 与 `skill-evidence.md`
在 skill 路由启用时（默认 M/L/CRITICAL）几乎都需要，表中不再重复列出。

| 改动类型 | 触发（文件/关键词，节选） | 必备模板（除 skill-plan/skill-evidence） |
| --- | --- | --- |
| 前端 / UI | `*.tsx` `*.css`，"ui/界面/组件/响应式" | mini-prd · ui-spec · visual-review |
| API / 接口 | `**/api/**` `**/routes/**`，"endpoint/接口/路由" | mini-prd · api-contract |
| 数据库 / 迁移 | `**/migrations/**` `*.sql` `schema.*`，"migration/迁移/schema" | db-change-plan · security-review |
| 安全 / 鉴权 | `**/auth/**` `**/permission/**`，"token/权限/密钥/rbac" | security-review |
| 文档 | `docs/**` `*.md`，"docs/文档/readme" | docs-impact |
| 资源治理 | 媒体/报告/`docs/modules/**`，"asset/资产/截图/视频" | docs-impact · resource-impact |
| 工程规范 | `src/**` `packages/**`，"日志/脱敏/架构规范/ORM" | standards-impact · architecture-review · security-review |
| E2E / 浏览器 | `tests/e2e/**` `playwright.config.*`，"e2e/浏览器/端到端" | e2e-plan · verification |
| 外部 CLI | `scripts/**` `.github/workflows/**`，"codex/claude code/gemini cli" | verification |
| 代码审查 | PR 模板，"review/评审/pull request" | review |
| 发版 / 发布 | `CHANGELOG.md` `package.json`，"release/发版/部署" | review · summary |
| 全栈原型 | "fullstack/mvp/prototype/next.js" | mini-prd · api-contract |

> 一个任务可同时命中多个领域（如「改 API + 写迁移」=api+db），取并集补齐。
> skill 路由的强弱由 `.scale/skills.json` 的 `mode`（off/warn/block）与 `enforceLevels` 决定。

---

## 4. 模板 → 门禁映射

下表说明「模板写不对/缺失会被哪个 Gate 拦下」，关键词约束直接来自门禁脚本，
**不要改这些关键词**，否则正则匹配失败、门禁立刻报错。

| 模板 | 门禁 | 门禁检查什么（关键词/条件） |
| --- | --- | --- |
| explore.md | G1 | 探索至少记录 3 个文件并写主矛盾 |
| plan.md | **G2** | 见下方 G2 关键词清单 |
| reality-check.md | **G2** | 必须含 6 个分区标题（见下） |
| runtime.md | G2 / G18 | G2 要求文件存在；G18 校验运行时证据新鲜度与退出码 |
| resource-cleanup.md | G2 | 必须存在于任务目录 |
| verification.md | G8 | 文档/工作流制品标准（避免 localhost 链接等） |
| review.md | **G19** | L/CRITICAL 任务需有审查记录（`.agent/state/review-*.json`） |
| 任意变更的 `*.md` | G17 | 变更的 markdown 内部相对链接必须有效 |

### G2 计划门——必须保留的关键词（来自 `scripts/gates/G2-verify.sh`）

| 检查项 | 必须匹配的关键词（任一，大小写不敏感） |
| --- | --- |
| 范围 | `scope` / `boundary` / `boundaries` / `limit` / `non-goal` |
| 异常覆盖 | `exception` / `error` / `fail` / `failure` / `rollback`（合计 **≥ 3 次**） |
| 回滚策略 | `rollback` / `recovery` / `disable` / `fallback` |
| 验收标准 | `acceptance` / `success criteria` / `definition of done` |
| L/CRITICAL | `human confirmation` / `review before execution` |

> ⚠️ `plan.md` 现有 `## Acceptance Criteria` 段名命中 `acceptance` 关键词。
> 若想改名，必须保留 `acceptance` / `success criteria` / `definition of done` 之一，
> 例如改成 `## Acceptance & Completion Criteria`，否则 G2 报「missing acceptance criteria」。

### G2 reality-check.md 必填分区

`## Confirmed`、`## Not Verified`、`## Stub / Fake / Partial`、`## Credential-Gated`、
`## Environment-Gated`、`## User-Visible Risk` 六个标题缺一不可。

---

## 5. 两套模板源（改之前先确认）

模板有两套独立来源，消费路径不同，**不要假设它们已经同步**：

| 源 | 路径 | 消费者 | 用途 |
| --- | --- | --- | --- |
| 文件版 | `docs/workflow/templates/*.md` | `new-task.sh` / `plan.sh` | 本仓库自用任务制品 |
| 内嵌版 | `src/workflow/GovernanceTemplates.ts` | `scale init` 脚手架 | 生成到**用户项目** |

- 改本仓库工作流：改**文件版**即可。
- 改 `scale` CLI 给用户生成的脚手架：改**内嵌版**（并注意 `tests/` 下的
  `governanceTemplates` 相关测试可能断言其内容）。
- 两套同步是独立任务，混在一起改容易让测试挂掉。

---

## 6. 端到端怎么走

从 `make new-task` 到提交的完整一遍真实命令演练，见
[E2E_EXAMPLE.md](./E2E_EXAMPLE.md)。
FSM Guard（阻止未验证就 COMPLETE）的状态机示例见
[../TASK_GUARD_WORKFLOW_DEMO.md](../TASK_GUARD_WORKFLOW_DEMO.md)。
