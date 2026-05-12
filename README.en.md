<p align="center">
  <img src="https://img.shields.io/badge/version-0.12.2-orange?style=flat-square" alt="version" />
  <img src="https://img.shields.io/badge/platforms-16-blue?style=flat-square" alt="platforms" />
  <img src="https://img.shields.io/badge/agents-12-blue?style=flat-square" alt="agents" />
  <img src="https://img.shields.io/badge/workflows-10-green?style=flat-square" alt="workflows" />
  <img src="https://img.shields.io/badge/detectors-19-red?style=flat-square" alt="detectors" />
  <img src="https://img.shields.io/badge/tests-560-passing-brightgreen?style=flat-square" alt="tests" />
  <img src="https://img.shields.io/badge/npm-0.12.2-cb3837?style=flat-square&logo=npm" alt="npm" />
</p>

# SCALE Engine v0.11.2

SCALE Engine is an AI engineering workflow runtime for agentic coding tools. It turns prompt-level engineering rules into stateful workflow gates, persisted evidence, review records, and release checks.

Repository: https://github.com/hongmaple0820/scale-engine
Mirror: https://gitee.com/hongmaple/scale-engine
npm: https://www.npmjs.com/package/@hongmaple0820/scale-engine
Language: [English](README.en.md) | [Chinese](README.md)

## Why It Exists

Prompt instructions are advisory. Production engineering needs mechanisms:

- A model can claim tests passed; SCALE stores verification evidence.
- A model can skip review; SCALE blocks `ship` without persisted review records.
- A model can stage unrelated files; SCALE now stages only reviewed files.
- A model can lose workflow state; SCALE stores artifacts and FSM transitions under `.scale`.

## Current Release

v0.11.1 introduces four priority improvements:

### Phase Commands FSM Blocking
- `canTransition` + `process.exit(1)` ensures FSM guard failures block execution, not continue
- define/plan/build/verify phases add clear blocking prompts

### OWASP Top 10 Detector
- New `OWASPDetector` covers SQL injection, XSS, path traversal, SSRF, Auth Bypass, weak crypto, CORS misconfiguration, CSRF, file upload, sensitive data exposure
- 19 security detection patterns, auto-recognizes regex definitions to avoid false positives

### Browser QA Capability
- `BrowserQACapability` wraps Playwright MCP tools
- Supports navigation, click, screenshot, console check, E2E test flows

### L6 Evolution Self-Improve Loop
- `LessonExtractor` extracts reusable lessons from session Defect events
- `SelfImproveEngine` implements `Defect → Lesson → Rule → Hook` promotion pipeline
- New CLI commands: `scale evolution extract/improve/report/hooks`

---

**Complete phase-aligned delivery workflow**:

- `define -> plan -> build -> verify -> review -> ship`
- FSM-backed artifacts with blocking on guard failures
- Persisted gate evidence and review records
- Deterministic review scanner blocks empty `catch`, `@ts-ignore`, focused tests, dangerous shell/Git commands, and security-sensitive changes without G7 evidence
- OWASP Top 10 security detector extends coverage
- Built-in G7 security scanning records explainable file/line evidence, blocks CRITICAL by default, can block HIGH in strict mode
- Optional strict TDD evidence gate with `--tdd-evidence` and `--tdd-strict`
- `ship --no-commit` delivery reports
- Review-gated release commits
- 16 platform adapters, 12 professional agent profiles
- Browser QA Capability (Playwright MCP)
- Evolution self-improve loop
- 499 Vitest tests passing

## Installation

```bash
npm install -g @hongmaple0820/scale-engine
scale --version
```

Node.js 20 or newer is required.

## Phase Workflow

```bash
scale define "Scoped release workflow" \
  --description "Implement a TypeScript CLI workflow with verification evidence, review records, rollback constraints, and release safety checks." \
  --success-criteria "verify evidence is persisted,review evidence is persisted,ship blocks unreviewed files"

scale plan <spec-id> --rollback "Revert the release commit and remove generated artifacts"
scale build <plan-id> --description "Implement scoped release workflow"
scale verify <task-id>
scale review <task-id>
scale ship <task-id> --message "feat(workflow): add scoped release workflow"
```

Use `scale ship <task-id> --no-commit` to generate the delivery report without creating a Git commit.

Strict TDD evidence can be enforced when needed:

```bash
scale verify <task-id> --tdd-strict --tdd-evidence .scale/tdd/<task-id>.json
```

The TDD evidence JSON must include `red`, `green`, `refactor`, and `testFirst` set to `true`.

## Evolution Self-Improve Loop

Extract lessons from session defects and promote to rules and hooks:

```bash
# Extract Lessons from session
scale evolution extract <session-id>

# Run self-improve loop: Defect → Lesson → Rule → Hook
scale evolution improve <session-id>

# Show self-improve report
scale evolution report <session-id>

# View generated Hooks config
scale evolution hooks <session-id> --json
```

Thresholds:
- Lesson → Rule: requires 3 verifications
- Rule → Active: requires 10 hits
- Rule → Hook: requires 20 hits

## Safety Model

SCALE Engine uses multiple enforcement layers:

| Layer | Purpose |
| --- | --- |
| FSM | Prevents invalid artifact lifecycle transitions |
| GateSystem | Runs build, lint, test, coverage, and security gates |
| EvidenceStore | Persists verification evidence for audit and release gating |
| ReviewStore | Persists deterministic review records |
| ReviewAnalyzer | Scans diffs for high-risk code, process debt, and missing security evidence |
| Detectors | Detects brute retry, premature completion, blame shifting, busy loops, and related failure modes |
| Ship gate | Requires passing verification and review evidence before release |

The `ship` command no longer stages the whole workspace. It stages only files covered by passing review records and blocks if new reviewable files appear after review.

G7 `SecurityGate` includes a lightweight built-in scan for hardcoded secrets, private keys, disabled TLS verification, `eval`/`Function`, raw HTML injection, dangerous shell commands, shell execution, and empty `catch` blocks. Compatibility mode blocks CRITICAL findings; strict mode also blocks HIGH findings.

## Supported Platforms

SCALE Engine includes adapters for 16 agent platforms, including Claude Code, Codex CLI, OpenCode, Cursor, Gemini CLI, OpenClaw, Hermes, Trae, WorkBuddy, VS Code Copilot CLI, QCoder, DeepSeek-TUI, Aider, Windsurf, Kimi, and Doubao.

It also includes 12 professional agent profiles:

- frontend
- backend
- testing
- UI design
- operations
- product
- code review
- security
- database
- performance
- documentation
- architecture

## Project Layout

```text
src/api/cli.ts                 CLI entrypoint
src/cli/phaseCommands.ts       DEFINE/PLAN/BUILD/VERIFY/REVIEW/SHIP
src/cli/evolutionCommands.ts   L6 Evolution CLI commands
src/workflow/gates/            Quality gates and persisted evidence
src/workflow/ReviewAnalyzer.ts Deterministic review analysis
src/workflow/ReviewStore.ts    Review record persistence
src/workflow/EvidenceStore.ts  Gate evidence persistence
src/workflow/evolution/        LessonExtractor + SelfImproveEngine
src/workflow/qa/               BrowserQA + E2ETestRunner
src/artifact/                  Artifact store and FSM definitions
src/guardrails/                Detector and gateway logic
src/guardrails/OWASPDetector.ts OWASP Top 10 security detection
src/capabilities/BrowserQACapability.ts Playwright MCP wrapper
src/evolution/                 Defect/Lesson/Rule/Hook evolution layer
tests/                         Vitest test suites (499 tests)
```

## Development

```bash
npm install
npm run build
npx vitest run
npm pack --dry-run
```

Targeted workflow tests:

```bash
npx vitest run tests/workflow/phaseCli.test.ts
npx vitest run tests/workflow/reviewAnalyzer.test.ts tests/workflow/reviewStore.test.ts tests/workflow/gateSystem.test.ts
```

## Release Notes

### v0.11.1

- Phase Commands FSM blocking: `canTransition` + `process.exit(1)` for guard failures
- OWASP Top 10 Detector: 19 security detection patterns
- Browser QA Capability: Playwright MCP wrapper for E2E testing
- L6 Evolution: `Defect → Lesson → Rule → Hook` self-improve loop
- Evolution CLI: `scale evolution extract/improve/report/hooks`
- ReviewAnalyzer regex fix: avoid false positives on pattern definitions
- 499 tests passing

### v0.10.1

- Hardened `ship` so release commits stage only files covered by passing review records.
- Added `ship --no-commit` delivery reports for reviewable output without creating a Git commit.
- Added optional strict TDD evidence verification with `--tdd-evidence` and `--tdd-strict`.
- Added richer command evidence metadata: working directory, timestamps, stdout/stderr tails, and output hashes.
- Hardened deterministic review scanning for empty `catch`, `@ts-ignore`, focused tests, dangerous shell/Git commands, and security-sensitive changes without G7 evidence.
- Hardened built-in G7 security scanning with explainable file/line evidence and compatibility vs strict blocking modes.
- Added CLI/unit regression tests for `review -> ship`, unreviewed-file blocking, and security-scanner false-positive boundaries.
- Verified `npm run build`, full Vitest suite, and `npm pack --dry-run` before release.

### v0.10.0

- Added phase-aligned workflow commands with FSM integration.
- Added persisted verification evidence and review records.
- Published `@hongmaple0820/scale-engine@0.10.0`.
- Verified `npm run build`, full Vitest suite, and `npm pack --dry-run` before release.

## License

MIT
