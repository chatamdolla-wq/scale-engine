<p align="center">
  <img src="https://img.shields.io/badge/version-0.34.0-orange?style=flat-square" alt="version" />
  <img src="https://img.shields.io/badge/platforms-22-blue?style=flat-square" alt="platforms" />
  <img src="https://img.shields.io/badge/agents-12-blue?style=flat-square" alt="agents" />
  <img src="https://img.shields.io/badge/workflows-10-green?style=flat-square" alt="workflows" />
  <img src="https://img.shields.io/badge/detectors-19-red?style=flat-square" alt="detectors" />
  <img src="https://img.shields.io/badge/tests-verified-brightgreen?style=flat-square" alt="tests" />
  <img src="https://img.shields.io/badge/npm-0.34.0-cb3837?style=flat-square&logo=npm" alt="npm" />
</p>

# SCALE Engine v0.34.0

SCALE Engine makes AI coding agents follow engineering rules through executable workflow gates, evidence files, and review constraints instead of relying on prompt discipline alone. It helps humans see what the agent explored, planned, verified, skipped, and why a task is or is not ready to ship.

Repository: https://github.com/hongmaple0820/scale-engine
Mirror: https://gitee.com/hongmaple/scale-engine
npm: https://www.npmjs.com/package/@hongmaple0820/scale-engine
Language: [English](README.en.md) | [Chinese](README.md)

## 0.31.0 ~ 0.33.0 gstack-Inspired: Declarative Skills + Cross-Session Learning + Ship Pipeline + Role Review + Security Audit

> Inspired by [gstack](https://github.com/garrytan/gstack), integrating role-based skills, cross-session learning, ship closure, diff-based test selection, and security audit into SCALE's governance architecture.

**v0.31.0 — Skill Frontmatter + Session Learnings + Preamble**

- **Skill Frontmatter**: YAML-based declarative skill definitions parsed from SKILL.md files with `name`, `description`, `triggers`, `allowed-tools` fields.
- **Session Learnings**: Cross-session knowledge persistence (`.scale/learnings/{slug}.jsonl`) with failure/pattern/preference/environment categories. Auto-extracts learnings from blocked runs.
- **Session Preamble**: Automatic environment context collection before workflow execution (git branch, active runs, learning count, verification profile).

**v0.32.0 — Ship Pipeline + Diff-Based Test Selection**

- **Ship Pipeline**: 8-step ship closure (sync-base → test → review-diff → bump-version → changelog → commit → push → create-pr) with `--dry-run` and `--skip` support.
- **Diff Test Selector**: Touchfile-based test selection by git diff — only run tests affected by changed files.

**v0.33.0 — Role Skills + Security Audit**

- **Role Skills**: 6 role-based review perspectives (eng-manager, security-reviewer, qa-lead, release-engineer, design-reviewer, ceo-reviewer), each with unique checklists and risk focus areas.
- **Security Audit**: OWASP Top 10 + STRIDE security audit engine with pattern-based detection for SQL injection, hardcoded credentials, XSS, weak crypto, path traversal, and more.

**v0.34.0 — Cross-Agent Execution Ledger + Workspace Policy + MCP Governance**

- **Execution Ledger**: Unified cross-agent execution timeline (`.scale/ledger/events.jsonl`), queryable by agent/session/task/type with summary aggregation.
- **Workspace Policy**: Runtime workspace policy engine with glob pattern matching, owner/allowedAgents access control, and advisory/warn/block enforcement levels.
- **MCP Governance**: MCP server lifecycle management — registration, health checks, security scanning (command injection, insecure transport, untrusted levels), and capability access control.

```bash
# Ship pipeline
scale ship --dry-run
scale ship --skip sync-base,changelog

# Security audit
scale security-audit --files src/auth/

# Role-based review
scale review --role security-reviewer --task-id TASK-123
```

## 0.27.0 AI OS Runtime

0.27.0 turns the AI Engineering OS direction into one executable entry point: `scale ai-os plan`. It creates a unified task plan with progressive governance mode, Context Compiler budget output, Memory Provider recall, Skill Routing execution steps, and Governance ROI. An agent can see which context to load, which capabilities to use, what evidence is required, and which risks escalate gates before it starts the task.

```bash
scale ai-os plan \
  --task-id TASK-123 \
  --task "Fix OAuth callback auth token handling and verify browser callback flow" \
  --level L \
  --files src/auth/oauth.ts,src/ui/callback.tsx \
  --budget 8000 \
  --json
```

This is not a claim that SCALE replaces human judgment. It is the first testable, explainable, and measurable runtime planning layer for the AI Engineering OS direction.

The near-term target is `0.28.0` as a usable closed-loop enhancement: connect `ai-os plan`, `ai-os run`, verification recommendations, failure learning, dashboard, benchmark, migration, and adoption into one verifiable loop. The long-range target is an AI Engineering OS beta in 8-12 weeks, a stable governance runtime in 3-6 months, and a cross-agent engineering operating layer in 6-12 months. See the full roadmap in [AI Engineering OS Strategic Positioning](docs/AI_ENGINEERING_OS_POSITIONING.md).

The first 0.30.0 governance-maturity slice adds Evaluator Intelligence and Tool Strategy Planner to the AI OS runtime. `scale ai-os plan` now detects reasoning-heavy architecture, root-cause, security, and release work, then adds critique, threat-model, release-readiness, and uncertainty decision-log gates to the adaptive workflow. It also turns skill/artifact/verification steps into a cost, retry, fallback, side-effect, and evidence graph. `scale ai-os status` surfaces evaluator gate count, uncertainty, tool-strategy cost, and fallback coverage so reviewers can see whether reasoning and tool risks were governed instead of hidden in prose.

The current 0.27.0 beta runtime now includes the controlled run entry point: `scale ai-os run --dry-run` reuses the unified plan, produces execution steps, evidence requirements, next actions, and writes the run report to `.scale/ai-os/runs/`. When real verification is required, use guarded mode with explicit `--verify` commands. Commands run through the safe runner by default and are recorded as runtime evidence; failed verification returns a `blocked` JSON report and a non-zero CLI exit code.

```bash
scale ai-os run \
  --task-id TASK-123 \
  --task "Fix OAuth callback auth token handling and verify browser callback flow" \
  --level L \
  --files src/auth/oauth.ts,src/ui/callback.tsx \
  --dry-run \
  --json
```

```bash
scale ai-os run \
  --task-id TASK-123 \
  --task "Fix OAuth callback auth token handling and verify browser callback flow" \
  --level L \
  --files src/auth/oauth.ts,src/ui/callback.tsx \
  --mode guarded \
  --verify "npm test -- tests/auth/oauth.test.ts" \
  --json
```

After multiple runs, use the dashboard to summarize ready/blocked runs, verification commands, pending evidence, and failure learning:

```bash
scale ai-os status --lang en
scale ai-os dashboard --json
```

`status` is the 0.28.0 closed-loop visibility entry point. It checks runtime directories, plan/run evidence, guarded verification, dashboard health, benchmark evidence, and the adoption report in one place.
For the 0.29.0 intelligence track, `status` also reports memory recall, memory quality, context savings, context compression risk, skill routing, and benchmark intelligence signals from persisted runs and benchmark evidence.
When guarded verification evidence is missing, it also recommends concrete commands from `.scale/verification.json` or `package.json` scripts so an agent can choose the next governed `--verify` step without guessing.

Before a release or milestone review, run the fixed benchmark scenarios to compare context, memory, skill, governance, and dashboard metrics:

```bash
scale ai-os benchmark --json
```

Before adopting the AI OS beta runtime in an existing project, create or verify the AI OS runtime state directories:

```bash
scale ai-os migrate --json
```

You can also use the one-command adoption path. It runs migrate, the first dry-run, benchmark, and doctor in order, then writes the adoption report to `.scale/ai-os/adoption.json`:

```bash
scale ai-os adopt \
  --task "Adopt AI OS runtime and generate the first governance evidence" \
  --files "README.md,src/runtime/AiOsRuntime.ts" \
  --json
```

For project-level readiness, run the AI OS doctor. It checks runtime directories, run history, dashboard health, benchmark freshness, and prints the next required action in English or Chinese:

```bash
scale ai-os doctor --lang en --json
scale ai-os doctor --lang zh
```

The standard upgrade path also surfaces this readiness. `scale upgrade check --json` now includes the AI OS doctor result, and `scale upgrade plan --json` adds explicit `ai-os adopt`, `ai-os migrate`, and `ai-os doctor` steps when a project has not yet adopted the runtime state. Human-facing `scale upgrade check/plan --lang en` prints localized next commands; keep `--json` for scripts, CI, and agent integrations.

## Community

SCALE Engine is an engineering workflow governance project for real AI-agent delivery. Contributions, issues, PRs, governance-pack ideas, and field reports are welcome through the source repositories. Chinese users can also follow the WeChat public account for updates, examples, and community entry points.

| Platform | Link | Purpose |
| --- | --- | --- |
| GitHub | [https://github.com/hongmaple0820/scale-engine](https://github.com/hongmaple0820/scale-engine) | Source, issues, and PRs |
| Gitee | [https://gitee.com/hongmaple/scale-engine](https://gitee.com/hongmaple/scale-engine) | China mirror and feedback |
| npm | [https://www.npmjs.com/package/@hongmaple0820/scale-engine](https://www.npmjs.com/package/@hongmaple0820/scale-engine) | CLI package |

<p align="center">
  <img src="image/wechat-public.jpg" alt="SCALE Engine WeChat public account" width="220" />
</p>

## Sponsorship

If SCALE Engine saves engineering governance time for your team, or helps move AI-agent work into a verifiable, reviewable, and releasable loop, voluntary sponsorship is welcome. Sponsorship supports maintenance, examples, documentation, test coverage, and community support. It is not a commercial support contract and does not change issue or PR priority.

<p align="center">
  <img src="image/wxPay.jpg" alt="Sponsor with WeChat Pay" width="220" />
  &nbsp;&nbsp;
  <img src="image/zfb.jpg" alt="Sponsor with Alipay" width="220" />
</p>

## What It Solves

AI coding becomes hard when agents must behave consistently across real teams and real repositories:

| Failure mode | SCALE mechanism |
| --- | --- |
| Agent says tests passed without running them | Verification profiles and evidence stores record actual commands and results |
| Agent skips discovery, design, TDD, or review | `scale context`, `scale diagnose`, `scale tdd`, and `scale status` produce required next actions |
| Agent stages unrelated files or edits the wrong repository | Review-gated shipping, MOE workspace rules, and child repository blockers control boundaries |
| Docs, screenshots, reports, scripts, and temporary files become unmaintainable | Resource governance classifies maintained assets, task evidence, temporary outputs, and forbidden commits |
| Noisy logs, secrets, ORM misuse, framework violations, or security risks slip through | Engineering standards and OWASP scans produce traceable findings |
| Long Markdown reports are not read | `scale artifact` renders traceable HTML reports from maintained Markdown sources |

## See It In 3 Minutes

```bash
npm install -g @hongmaple0820/scale-engine
mkdir scale-demo && cd scale-demo
scale init --governance-pack standard
scale preflight --preflight-profile quick
scale status
```

This generates governance files you can commit to a project:

- `.scale/verification.json`: service matrix and verification profiles
- `.scale/skills.json`: skill routing and evidence requirements
- `.scale/tools.json`: CLI/MCP/browser/desktop orchestration policy
- `docs/workflow/templates/`: Mini-PRD, plan, verification, review, and summary templates
- `docs/standards/`: engineering, Git collaboration, and resource governance rules

Continue with a full workflow loop:

```bash
scale context init --name "Scale Demo"
scale context grill --task-id 2026-05-18-oauth-hardening --task "Harden OAuth callback"
scale diagnose plan --task-id 2026-05-18-oauth-hardening --symptom "callback returns 500 when state expires"
scale tdd slice --task-id 2026-05-18-oauth-hardening --behavior "reject expired OAuth state" --public-interface "GET /oauth/callback" --failing-test "expired state returns 401" --test-file tests/oauth.test.ts --impl-files src/oauth.ts
scale artifact render --task-id 2026-05-18-oauth-hardening --artifact-dir .planning/tasks/2026-05-18-oauth-hardening
scale artifact doctor --artifact-dir .planning/tasks/2026-05-18-oauth-hardening
```

Read [Quickstart](docs/start/quickstart.md) and [Agent Governance Demo](docs/start/agent-governance-demo.md) for the complete walkthrough.

## Who It Is For

- Teams using Codex, Claude Code, Cursor, Gemini CLI, OpenCode, Aider, or similar agents on real projects.
- Teams with multi-service, multi-repository, MOE workspace, frontend/backend, or scaffold governance needs.
- Teams that want agents to actively use skills, MCPs, CLIs, browser automation, E2E checks, and HTML reports with safety boundaries.
- Project owners who feel AI code is fast but hard to review, verify, and maintain.

It is not optimized for toy projects that only want one minimal prompt file and do not need gates, collaboration rules, or long-term maintainability.

## Core Capabilities

- Workflow Engine: `define -> plan -> build -> verify -> review -> ship` with persisted state.
- GateSystem: build, lint, test, coverage, security, TDD, review, and tool evidence gates.
- Governance Packs: `standard`, `project-scaffold`, `moe-workspace`, `resource-governance`, `go-service-matrix`, `node-library`, and `frontend-app`.
- Resource Governance: docs, media, reports, test scripts, temporary scripts, HTML artifacts, and local config lifecycle rules.
- Skill and Tool Orchestration: UI/UX, web research, browser E2E, Chrome DevTools MCP, desktop automation, and external agent CLIs.
- Engineering Standards: noisy logs, sensitive data, injection risks, ORM/database usage, framework boundaries, test rigor, and deployment risk.
- HTML Artifacts: Markdown remains the maintained source; HTML becomes the review, comparison, status, and release handoff layer.

## Installation

```bash
npm install -g @hongmaple0820/scale-engine
scale --version
```

Node.js 20 or newer is required.

## Governance Packs

Use `scale init` to install a governed workflow into an existing project:

```bash
scale init --governance-pack standard
scale init --governance-pack project-scaffold
scale init --governance-pack moe-workspace
scale init --governance-pack resource-governance
scale init --governance-pack go-service-matrix
scale init --governance-pack node-library
scale init --governance-pack frontend-app
```

Supported packs:

| Pack | Best fit |
| --- | --- |
| `standard` | General project governance with task artifacts, verification, metrics, resources, standards, and skills policy |
| `project-scaffold` | Reproducible engineering workflow scaffold and demo governance project |
| `moe-workspace` | Parent workspace with independent child repositories or MOE-style multi-repo development |
| `resource-governance` | Asset/document lifecycle policy for docs, reports, screenshots, scripts, media, and generated outputs |
| `go-service-matrix` | Go backend services with service-aware build/lint/test/security verification |
| `node-library` | Node/TypeScript package workflow, release, and verification governance |
| `frontend-app` | UI/UX, browser evidence, responsive checks, E2E, and visual review governance |

If you are unsure, start with `standard`. Use a specialized pack when the project shape is clear:

See [Getting Started](docs/start/README.md) for runnable tutorials and demo paths.

## Workflow Upgrade

Do not rerun `scale init` as a blind upgrade command in existing projects. Use the guarded upgrade flow:

```bash
scale upgrade check --dir . --lang en
scale upgrade plan --dir . --html --lang en
scale upgrade apply --dir . --confirm --lang en
scale upgrade rollback --dir . --lang en
```

If the upgrade plan says the AI OS runtime has not been adopted yet, run:

```bash
scale ai-os adopt --dir . --task "Adopt AI OS runtime" --lang en
```

Chinese output is the default. Add `--lang en` for English prompts and English HTML plans.

Upgrade rules:

- Missing managed files can be restored automatically after plan review.
- Clean managed files whose content still matches `.scale/governance.lock.json` can be refreshed when a governance pack version changes.
- Locally edited managed files are marked `manual-review` and are not overwritten automatically.
- Third-party skills, MCP servers, desktop automation, browser tools, and external CLIs are check-only; SCALE reports source and trust policy but does not auto-install them.

See [Workflow Upgrade Guide](docs/start/workflow-upgrade.md) for the runnable path.

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

Git branch governance follows a GitLab Flow variant: short branches merge into `dev`, verified releases land on `master`, and production publishing is triggered by user-created `vX.Y.Z` tags on `master`. `scale ship` blocks direct governed commits on `dev`, `master`, `main`, or detached HEAD, and temporary worktree cleanup is blocked when the branch still has unpushed or unmerged commits. See [docs/GITLAB_FLOW.md](docs/GITLAB_FLOW.md).

G7 `SecurityGate` includes a lightweight built-in scan for hardcoded secrets, private keys, disabled TLS verification, `eval`/`Function`, raw HTML injection, dangerous shell commands, shell execution, and empty `catch` blocks. Compatibility mode blocks CRITICAL findings; strict mode also blocks HIGH findings.

## Skill and Tool Governance

Skill Radar recommends skills, MCP servers, browser automation, desktop automation, planning workflows, memory providers, and external CLIs by task intent. It returns confidence, safety level, evidence requirements, attribution metadata, and fallback behavior.

Third-party skills stay review-required until source, scripts, license, attribution, and pinned revision are checked. `OthmanAdi/planning-with-files` (MIT), `rohitg00/agentmemory` (Apache-2.0), and `garrytan/gbrain` (MIT) have explicit attribution records; other external skills, MCP servers, CLIs, adapters, and discovery candidates are tracked in the [External Reference Inventory](docs/EXTERNAL_REFERENCES.md) with unknown licenses kept `review-required`. SCALE records them as governed references, optional integrations, or adapted concepts; it does not vendor upstream source code.

Memory is provider-routed rather than expanded as a built-in Memory OS. Agents can use `scale memory provider status` and `scale memory provider recall` to select `agentmemory`, `gbrain`, or `scale-local` under policy; external providers are read-only by default and fall back to local evidence-backed memory.

See [Skill Radar](docs/SKILL_RADAR.md), [Third-Party Skills](docs/THIRD_PARTY_SKILLS.md), and [External Reference Inventory](docs/EXTERNAL_REFERENCES.md).

## Supported Platforms

SCALE Engine includes adapters for 22 agent platforms, including Claude Code, Codex CLI, OpenCode, Cursor, Gemini CLI, OpenClaw, Hermes, Trae, WorkBuddy, VS Code Copilot CLI, QCoder, Qoder, JCode, DeepSeek-TUI, Aider, Windsurf, Kiro, Cline, Kilo Code, Antigravity, Kimi, and Doubao.

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
tests/                         Vitest test suites
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

### v0.20.0

- Added Context Budget and Progressive Governance so low-risk S tasks stay lightweight while auth, data, security, deployment, and cross-module changes escalate automatically.
- Added Code Intelligence with adapter-first CodeGraph / Graphify support, explicit fallback, impact analysis, context recommendations, and exploration ROI.
- Added Workflow Eval, Failure Replay, and improvement candidates with pass@k, fix iterations, tool-call counts, token estimates, and human-correction metrics.
- Added Skill Radar for intent-based skills, MCP, browser, desktop automation, and external CLI recommendations with confidence, safety level, and evidence requirements.
- Added Memory Brain for evidence-backed long-term memory candidates, contradiction detection, dream maintenance, explicit promotion, and failure replay ingestion.
- Added Governance Dashboard to summarize runtime, eval, memory, resource, and HTML artifact evidence in a local HTML review surface.
- Fixed new `--dir` aware commands so relative `.scale` state resolves inside the target project instead of the caller workspace.

### v0.19.0

- Added product smoke gates, runtime evidence learning settlement, memory context packs, workspace conflict blockers, and release-readiness demo coverage.

### v0.18.0

- Governed HTML artifacts: `scale artifact render/doctor/settle/open`.
- Markdown remains the editable source of truth; generated HTML is traceable task evidence.
- Governance packs now include output policy and HTML artifact resource classification.
- Added tests for HTML artifact rendering, safety checks, settlement evidence, and generated template output.

### v0.17.0

- Added active workflow command gates: `scale context`, `scale diagnose`, `scale tdd`, and `scale status`.
- Added required next-action queues so agents cannot silently skip context, debugging, TDD, or verification work.

### v0.16.0

- Added governed skill repository, skill recommendation, install-safety checks, visual Vibe templates, and leadership presets.
- Strengthened tool orchestration and resource/engineering standards governance.

### v0.15.1

- Added UI/UX, web research, browser automation, desktop automation, and external Agent CLI routing contracts.
- Added resource governance and engineering standards governance for generated project packs.

### v0.11.1

- Phase Commands FSM blocking: `canTransition` + `process.exit(1)` for guard failures
- OWASP Top 10 Detector: 19 security detection patterns
- Browser QA Capability: Playwright MCP wrapper for E2E testing
- L6 Evolution: `Defect → Lesson → Rule → Hook` self-improve loop
- Evolution CLI: `scale evolution extract/improve/report/hooks`
- ReviewAnalyzer regex fix: avoid false positives on pattern definitions
- Vitest suite covered in release verification

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
