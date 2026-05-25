# SCALE Engine 快速开始

## 30 秒安装

```bash
npm install -g @hongmaple0820/scale-engine
scale quickstart
```

## 环境要求

- Node.js >= 20
- Git（可选，用于代码变更追踪）

## 支持的操作系统

- Windows 10/11
- macOS 12+
- Linux (Ubuntu 20.04+, Debian 11+, CentOS 8+)

## 支持的 Agent 平台

SCALE Engine 作为治理层与以下 AI 编程工具协同工作：

| 平台 | 检测方式 |
|------|---------|
| Claude Code | `.claude/settings.json` |
| Codex | `.codex/config.toml` |
| Cursor | `.cursorrules` |
| DeepSeek TUI | `.deepseek/instructions.md` |
| Kimi | `.kimi/settings.json` |
| 豆包 | `.doubao/settings.json` |
| Trae | `.trae/config.json` |
| Windsurf | `.windsurf/settings.json` |

## 本地模型支持

SCALE 支持通过 OpenAI 兼容接口接入本地模型：

```bash
export SCALE_LOCAL_MODEL=qwen-2.5-72b
export SCALE_LOCAL_BASE_URL=http://localhost:11434/v1
export SCALE_LOCAL_API_KEY=ollama
scale preflight --profile china-local
```

### 支持的本地模型

| 模型 | 提供商 | 最低配置 |
|------|--------|---------|
| Qwen 2.5 7B | Alibaba Cloud / Ollama | 8GB VRAM |
| Qwen 2.5 72B | Alibaba Cloud / vLLM | 4x24GB VRAM |
| GLM-4 Plus | Zhipu AI / vLLM | 2x24GB VRAM |
| DeepSeek V3 | DeepSeek / SGLang | 8x24GB VRAM |

## 治理包选择

| 包 | 适用场景 |
|----|---------|
| `solo-dev` | 个人开发者，轻量治理 |
| `standard` | 通用项目 |
| `node-library` | Node.js/npm 库 |
| `frontend-app` | 前端应用（React/Vue/Next） |
| `go-service-matrix` | Go 多服务 |
| `moe-workspace` | 多仓库工作空间 |

## 下一步

```bash
scale preflight --json     # 运行门禁检查
scale tui                  # 打开终端仪表盘
scale cost-report          # 查看 Token 成本
```
