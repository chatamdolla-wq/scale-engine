# 3 分钟快速开始

目标：在一个项目里安装 SCALE 工作流，完成依赖检查，并看到可验证的治理产物。

## 前置条件

- Node.js 20+
- npm
- Git
- Windows PowerShell、Git Bash、macOS/Linux shell 均可

Python、Bun、Rust/Cargo、uv/pipx 不是启动 SCALE 的硬要求。只有启用 Graphify、GBrain、RTK 等第三方能力时，安装器才会提示缺少哪些运行时以及可执行的修复命令。

## 1. 安装 CLI

```bash
npm install -g @hongmaple0820/scale-engine
scale --version
```

本仓库开发时也可以直接运行源码入口：

```bash
node --import tsx E:/project/scale-engine/src/api/cli.ts --help
```

## 2. 初始化项目

```bash
mkdir scale-demo
cd scale-demo
scale init --governance-pack standard
```

初始化会生成 `.scale/`、`docs/`、`scripts/` 以及对应 Agent 入口文件。已有项目升级不要盲目重跑 `init`，优先使用：

```bash
scale upgrade check --dir . --lang zh
scale upgrade plan --dir . --html --lang zh
```

## 3. 交互式安装第三方能力

默认输出语言是中文。需要英文时加 `--lang en`，也可以设置 `SCALE_LANG=en`。

推荐先只查看计划：

```bash
scale setup --pack full
```

确认后安装：

```bash
scale setup --pack full --yes
```

机器可读输出：

```bash
scale setup --pack full --json
```

`setup` 和 `bootstrap deps` 都会输出 `runtimeChecks`。如果机器缺少 `python`、`bun`、`cargo`、`uv/pipx`、`node/npm/npx`，会先显示缺失项和修复建议，再决定是否执行 `--yes` 或 `--apply`，避免安装中途卡住。

记忆供应商可以在安装入口直接切换，不需要手改 `.scale/memory-providers.json`：

```bash
scale setup --pack memory --memory-provider scale-local --json
scale setup --pack memory --memory-provider gbrain --memory-mode external-first --json
```

第三方能力的职责边界：

| 能力 | 默认定位 | 关键验证 |
| --- | --- | --- |
| `awesome-design-md` | 品牌、视觉语言、`DESIGN.md` 来源 | 是否同步上游 DESIGN.md catalog |
| `ui-ux-pro-max` | UX、状态、可访问性、响应式验收 | 是否通过官方 `uipro-cli` 安装 |
| `frontend-design` | 可选实现灵感，不再是 UI 默认必装项 | 需要时显式 `--include frontend-design` |
| `rtk` | CLI proxy/token 节省能力 | `rtk gain` 和 `rtk init -g --codex` |
| `gbrain` | 默认记忆供应商 | `gbrain doctor --json`，未初始化会提示 `gbrain init --pglite` |
| `graphify` | 知识图谱产物供应商 | `graphify install --platform codex` 和 `graphify-out/graph.json` |
| `codegraph` | 代码结构索引供应商 | `codegraph init -i` 和 `.codegraph/` |

低层命令仍可直接使用：

```bash
scale bootstrap deps --profile advanced --governance-pack frontend-app --lang zh
scale bootstrap deps --profile advanced --governance-pack frontend-app --apply --lang zh
```

## 4. 验证闭环

```bash
scale doctor
scale preflight --preflight-profile quick
scale status
scale assets scan --dir .
scale standards scan --dir .
scale runtime doctor --level S
scale memory provider status --json
scale codegraph status --json
```

未运行验证，不要声称通过。`setup --json` 和 `bootstrap deps --json` 只代表依赖计划可解析，不等于第三方服务已经可用。

## 5. 建立任务上下文

```bash
scale context init --name "Scale Demo"
scale runtime start --session-id 2026-05-18-oauth-hardening --task-id 2026-05-18-oauth-hardening --level M --agent codex
scale context grill --task-id 2026-05-18-oauth-hardening --task "加固 OAuth callback"
scale diagnose plan --task-id 2026-05-18-oauth-hardening --symptom "callback 在 state 过期时返回 500"
scale tdd slice --task-id 2026-05-18-oauth-hardening --behavior "拒绝过期 OAuth state" --public-interface "GET /oauth/callback" --failing-test "expired state returns 401" --test-file tests/oauth.test.ts --impl-files src/oauth.ts
```

任务完成后记录验证证据并沉淀候选经验：

```bash
scale runtime record --title "quick preflight" --kind command --status passed --command "scale preflight --preflight-profile quick" --exit-code 0 --summary "quick preflight passed"
scale runtime final-check --task-id 2026-05-18-oauth-hardening --session-id 2026-05-18-oauth-hardening --level M
scale memory pack --task-id 2026-05-18-oauth-hardening --session-id 2026-05-18-oauth-hardening --task "继续加固 OAuth callback" --level M --budget 4000
scale memory settle --task-id 2026-05-18-oauth-hardening --session-id 2026-05-18-oauth-hardening --task "继续加固 OAuth callback" --level M
```

`memory settle` 默认只生成学习候选，不会自动把一次会话判断提升成长线规则。存在失败证据时，候选会要求先解决失败，避免把未闭环问题沉淀成经验。

## 6. MOE/多仓工作区

多仓项目使用：

```bash
scale init --governance-pack moe-workspace
```

MOE 默认把子工程配置为兄弟仓库或绝对路径，不建议把独立 Git 子工程放在主工程根目录下。`.scale/workspace.json` 中的典型写法：

```json
{
  "topology": "moe",
  "repositories": [
    { "name": "root", "path": ".", "role": "root", "required": true },
    { "name": "api", "path": "../api", "role": "external", "required": true, "remote": "origin" }
  ]
}
```

这样可以避免子工程 Git 状态、分支、提交和主工程互相污染。

## 7. 安装烟测

仓库开发和发版前可以一键验证安装入口：

```bash
npm run smoke:setup
make setup-smoke
```

这个烟测只验证安装计划、双语输出、运行时依赖诊断、记忆供应商切换和 CodeGraph/Graphify 状态路径，不会执行真实第三方安装。

遇到跨系统命令兼容、PATH 或运行时依赖问题时，先导出环境诊断：

```bash
scale doctor env --json
```
