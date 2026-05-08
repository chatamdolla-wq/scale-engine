<p align="center">
  <img src="https://img.shields.io/badge/version-0.8.0-orange?style=flat-square" alt="version" />
  <img src="https://img.shields.io/badge/agents-12-blue?style=flat-square" alt="agents" />
  <img src="https://img.shields.io/badge/workflows-10-green?style=flat-square" alt="workflows" />
  <img src="https://img.shields.io/badge/detectors-9-red?style=flat-square" alt="detectors" />
  <img src="https://img.shields.io/badge/tests-410-passing-brightgreen?style=flat-square" alt="tests" />
  <img src="https://img.shields.io/badge/npm-0.8.0-cb3837?style=flat-square&logo=npm" alt="npm" />
</p>

# SCALE Engine v0.8.0

> **S**caffold · **C**ontrol · **A**rtifact · **L**earn · **E**volve
>
> AI Engineering Scaffold Engine — Enforce engineering constraints physically, not via prompt "self-discipline"

---

## 📦 Repository

| Platform | URL |
|----------|-----|
| **GitHub** | https://github.com/hongmaple0820/scale-engine |
| **Gitee (Mirror)** | https://gitee.com/hongmaple/scale-engine |
| **npm** | https://www.npmjs.com/package/@hongmaple0820/scale-engine |

**Language:** [English](README.en.md) | [中文文档](README.md)

---

## 📖 Table of Contents

- [Introduction](#-introduction)
- [Architecture](#-architecture)
- [Features](#-features)
- [Quick Start](#-quick-start)
- [API Reference](#-api-reference)
- [CHANGELOG](#-changelog)
- [License](#-license)

---

## 🎯 Introduction

### What is SCALE Engine?

SCALE Engine is an **AI Engineering Scaffold** that provides physical constraint layers for AI Agents (Claude Code, Codex CLI, OpenCode, Cursor, Gemini CLI, etc.), ensuring engineering standards are enforced through mechanisms, not prompt instructions.

### Why Do You Need It?

The core contradiction of AI coding:

```
❌ Prompt says "run tests"           → AI can fake it
❌ Prompt says "don't hardcode keys" → AI can ignore rules
❌ Prompt says "don't brute retry"   → AI can retry indefinitely
❌ Prompt says "plan before code"    → AI can skip planning
```

**Root Problem**: Prompts are "suggestions" that AI can choose to ignore.

SCALE Engine's solution: **Physical Constraints**.

```
✅ Stop Hook checks "no tests run"  → AI physically cannot skip
✅ PreTool Hook blocks dangerous commands → AI physically cannot execute
✅ FSM controls workflow states      → AI physically cannot skip steps
✅ Role Gate limits tool permissions → AI physically cannot overstep
✅ Detectors catch abnormal behaviors → AI physically cannot hide
```

### How Does It Work?

SCALE Engine implements AI engineering through **Six Layers**:

| Layer | Responsibility | Core Mechanism |
|-------|----------------|----------------|
| **L1 Context** | Context Building | Token budget + Philosophy injection + Scenario awareness |
| **L2 Guardrails** | Safety Guardrails | 9 Detectors + Role Gate + Cascade escalation |
| **L3 Observability** | Observability | EventBus + BehaviorTracker + Pattern detection |
| **L4 Orchestration** | Task Orchestration | TaskEngine + Effects + 10 Workflows |
| **L5 Memory** | Knowledge Memory | KnowledgeBase + Decay algorithm + Skill discovery |
| **L6 Evolution** | Self-Evolution | Defect→Lesson→Rule→Hook closed loop |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        L6 Evolution                             │
│  Defect → Lesson → Rule → Hook (Self-improvement closed loop)  │
├─────────────────────────────────────────────────────────────────┤
│                        L5 Memory                                │
│  KnowledgeBase + Decay + TF-IDF Recall + Skill Discovery       │
├─────────────────────────────────────────────────────────────────┤
│                     L4 Orchestration                            │
│  TaskEngine + FSM + 10 Workflows + Multi-Agent Collaboration   │
├─────────────────────────────────────────────────────────────────┤
│                    L3 Observability                             │
│  EventBus + BehaviorTracker + 9 Detectors + Pattern Detection  │
├─────────────────────────────────────────────────────────────────┤
│                     L2 Guardrails                               │
│  Role Gate + PreTool/PostTool Hooks + Cascade Escalation       │
├─────────────────────────────────────────────────────────────────┤
│                      L1 Context                                 │
│  Token Budget + Philosophy Injection + Scenario Awareness      │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✨ Features

### v0.8.0 Highlights

**Multi-Agent Collaboration System (Phase 4-9)**
- 12 Professional Agent Profiles: frontend, backend, test, ui-design, ops, product, code-review, security, database, performance, docs, architect
- AgentPool: Instance lifecycle management
- AgentDispatcher: Automatic task distribution
- AgentChannel: Inter-agent messaging
- AgentCoordinator: Team task orchestration

**Workflow Enhancements (Phase 1-3)**
- SessionStart Hook: Automatic FSM state injection
- AutoDefectCreator: Automatic defect creation from detector events
- TF-IDF Memory Recall: Text similarity-based knowledge retrieval

**Karpathy Anti-Patterns**
- Brute Retry, Blame Shift, Tool Idle, Busy Illusion, Passive Wait countermeasures

---

## 🚀 Quick Start

### Installation

```bash
npm install @hongmaple0820/scale-engine
```

### CLI Usage

```bash
scale init --scenario standard
scale doctor
scale agent spawn --profile frontend
scale team create --profiles frontend,backend,test --task "Implement auth"
scale workflow list
```

### Programmatic Usage

```typescript
import { AgentPool, AgentDispatcher, KnowledgeBase } from '@hongmaple0820/scale-engine'

const pool = new AgentPool(eventBus, modelRouter)
const agent = pool.spawn('frontend-agent')
await dispatcher.dispatch(taskId, ['frontend-agent', 'backend-agent'])
```

---

## 📋 CHANGELOG

### v0.8.0 (2026-05-08)

- Multi-Agent Collaboration System (12 profiles, AgentPool, Dispatcher, Channel, Coordinator)
- TF-IDF Memory Recall
- SessionStart Hook, AutoDefectCreator, BehaviorTracker.autoEvolve
- Karpathy Anti-Patterns
- Tests: 410 passed (32 files)

### v0.7.1 (2026-05-06)

- SessionStart hook, AutoDefectCreator, ContextBuilder enhancements
- Tests: 323 passed

### v0.6.0 (2026-04-29)

- SQLiteKnowledgeBase, FSM concurrency locks, ScopeCreepDetector

### v0.5.0 (2026-04-22)

- 7 Agent adapters, 3 Scenario modes, 10 Workflows, Skill ecosystem

---

## 🌐 Community

### Links

| Platform | URL |
|----------|-----|
| **GitHub** | https://github.com/hongmaple0820/scale-engine |
| **Gitee (Mirror)** | https://gitee.com/hongmaple/scale-engine |
| **npm** | https://www.npmjs.com/package/@hongmaple0820/scale-engine |

### WeChat

- **Public Account**: Search "SCALE Engine"
- **Group Chat**: Add **mapleCx330** to join discussion group
- **Email**: 2496155694@qq.com

### Knowledge Planet (¥99/year)

- Exclusive skill packs and configuration templates
- Deep case study breakdowns
- 1v1 Q&A with community experts
- Early access to new features

> Join: https://t.zsxq.com/6T5Eq

---

### ❤️ Support Open Source

<p align="center">
  <img src="/image/wxPay.jpg" alt="WeChat Pay" width="150" />
  <img src="/image/zfb.jpg" alt="Alipay" width="150" />
</p>
