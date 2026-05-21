## 0.29.0 - 2026-05-21

### AI OS intelligence readiness

- Added `scale ai-os status` intelligence signals for memory recall, context savings, skill routing, and benchmark readiness.
- Added memory recall quality scoring based on confidence, relevance, evidence-backed items, missing evidence, and low-confidence recall.
- Added context compression quality reporting with omitted sections, omitted token totals, compression risk, and evidence-loss warnings.
- Downgraded context intelligence to warning when budgeted context compilation omits evidence-bearing runtime sections.
- Added CLI human output for AI OS intelligence and context risk so release reviewers do not need to inspect JSON manually.
- Added `npm run release:check` as the single reusable release readiness gate for typecheck, lint, full tests, build, production audit, and package dry-run.

### Verification

- Verified the release candidate with `npm run release:check`, including full Vitest suite, typecheck, lint, build, production dependency audit, and `npm pack --dry-run`.

---

## 0.28.0 - 2026-05-21

### AI OS closed-loop runtime

- Added `scale ai-os adopt` to run migration, first dry-run, benchmark, and doctor checks as one project adoption path.
- Added `scale ai-os status` to report closed-loop readiness across runtime directories, plan/run evidence, guarded verification, dashboard health, benchmark freshness, and adoption evidence.
- Added concrete verification recommendations from `.scale/verification.json` or `package.json` scripts so agents can choose the next governed `--verify` command without guessing.
- Extended `scale ai-os run --mode guarded --verify "<command>"` coverage with runtime evidence, failure-learning candidates, dashboard summaries, and non-zero exits for blocked runs.
- Wired AI OS adoption guidance into upgrade workflows, governance Makefile targets, quickstart docs, workflow docs, and the strategic AI Engineering OS roadmap.
- Improved Chinese and English documentation for AI OS adoption, status checks, upgrade guidance, and closed-loop runtime usage.

### Verification

- Verified the release candidate with full Vitest suite, typecheck, lint, build, production dependency audit, `git diff --check`, dist CLI smoke checks, and `npm pack --dry-run`.

---

## 0.27.1 - 2026-05-21

### AI OS adoption checks

- Added `scale ai-os doctor` to check AI OS runtime readiness, dashboard health, benchmark freshness, and migration state.
- Wired AI OS runtime readiness into `scale upgrade check` and `scale upgrade plan`, including migration and doctor steps when a project has not adopted the AI OS runtime directories yet.
- Updated Chinese and English documentation for AI OS runtime adoption, upgrade checks, and strategic positioning.
- Added CLI and runtime regression coverage for AI OS doctor, migration, dashboard, benchmark, and upgrade readiness reports.

### Verification

- Verified the release candidate with typecheck, lint, build, targeted AI OS/upgrade tests, full Vitest suite, `git diff --check`, dist CLI smoke checks, and `npm pack --dry-run`.

---

## 0.24.0 - 2026-05-20

### SCALE Engine V2 workflow hardening

- Added provider-aware prompt cache policy reporting and model-usage ledger support so static governance context can be measured and optimized instead of repeatedly paid for blindly.
- Added governance dashboard aggregation for recent token usage, gate failures, replay hotspots, and evolution metrics.
- Added readonly `BackgroundHunter` scanning that can surface engineering-standards findings and diagnostic inputs without mutating code automatically.
- Added dependency audit governance for supply-chain risk, including dependency metadata, vulnerability, dangerous API, and install-script checks.
- Added active security and visual gates for HTTP-surface red-team checks and UI screenshot/spec validation.
- Added evolution shadow mode: gate failures can create Defects after repeated failures, lessons propose shadow rules first, and blocking hooks require maturity evidence plus approval.
- Added V2 architecture and operational docs for context budget, hunter, dependency audit, active gates, dashboard, and evolution shadow mode.

### Verification

- Verified the release candidate with typecheck, lint, build, full Vitest suite, `git diff --check`, and `npm pack --dry-run`.

---

## 0.23.0 - 2026-05-20

### Memory and context hardening

- Added `scale context anatomy` to generate `.scale/anatomy.md` from a bounded project scan.
- Added `scale memory cerebrum` to maintain `.scale/cerebrum.md` do-not-repeat rules and preferences from the local knowledge base.
- Added executable hook smoke coverage for anatomy lookup, cerebrum checks, bug capture, and bug recall.
- Switched generated workflow hooks to `.cjs` so CommonJS hook templates run correctly under Node.js package `type: module`.
- Fixed `BugPatternDetector` TypeScript inference so `npm run typecheck` passes.
- Fixed anatomy/cerebrum markdown parsing to use ASCII separators and improved cerebrum tokenization for non-English text.
- Excluded lockfiles and nested `.claude/worktrees` from default context budget scans to reduce prompt inventory noise.
- Split `scale context doctor` into a real lazy task-pack budget check plus separate inventory-pressure warning, with compact task-pack JSON output.
- Cleared current standards-doctor blocking empty-catch findings and suppressed console false positives inside generated-script strings and regex literals.
- Replaced the remaining non-CLI `console.warn` in skill discovery with the project logger.

### Auto task level detection

- Added `TaskLevelDetector` that infers task level (S/M/L/CRITICAL) from git diff signals: file count, line delta, cross-module changes, and critical file hits.
- Integrated auto-detection into `scale build` — when `--level` is omitted, the level is inferred automatically instead of defaulting to M.
- Added keyword-based level escalation for high-risk terms (migration, auth, payment, refactor, security).

### One-click end-to-end workflow

- Added `scale run` command that chains define → plan → build → verify → review → ship in a single invocation.
- Added `WorkflowOrchestrator` that manages artifact ID passing between phases, phase timing, and failure handling.
- Supports `--skip-phases`, `--no-stop` (continue on failure), `--no-commit`, and `--json` output.
- Ambiguity analysis runs as a warning (not a hard block) so the orchestrator can proceed with caution.

### Local TF-IDF vector search

- Added `TfidfIndex` — a zero-dependency local vector search engine using TF-IDF + cosine similarity.
- Replaced placeholder `recallByVector` in `SQLiteKnowledgeBase` with real TF-IDF search.
- Supports CJK character-level tokenization and English stop-word filtering.
- Index updates automatically on knowledge entry insertion.

### Meta-governance gates

- Added 7 meta-governance gates (G9–G15): artifact completeness, evidence quality, plan coherence, FSM consistency, hook coverage, security baseline, and governance lock integrity.
- Registered meta-gates in `GateSystem` with `executeMetaGovernance()` method.

### Command output compression and run ledger

- Added native command output compression for verbose test, typecheck, lint, git diff/status, and generic failure outputs.
- Added `.scale/evidence/command-runs/<taskId>/` records with raw output hashes, bounded raw tails, compressed summaries, and estimated token savings.
- Wired command compression into `runShellCommand` while preserving full stdout/stderr for existing coverage and smoke-report parsers.
- Recorded command-run evidence from build, lint, test, coverage, and product-smoke gates when runtime evidence is configured.

### Doctor health checks and dashboard write APIs

- Extended `scale doctor` with governance lock, FSM state, and gate registration checks.
- Added dashboard write API endpoints for artifact mutation from the web UI.
- Enhanced dashboard HTML with interactive controls.

### Configuration profiles

- Added `src/config/` module for named configuration profiles (sandbox, standard, critical).

### Documentation and CI

- Added `CONTRIBUTING.md` with development setup, commit conventions, and PR guidelines.
- Added `docs/DOCUMENT_STANDARDS.md` and `docs/start/artifact-lifecycle.md`.
- Added `.github/` CI/CD workflow templates.
- Added `scripts/validate-docs.sh` for documentation structure validation.
- Stabilized full-suite `npm test -- --run` on Windows by using Vitest's fork pool with one worker.

---

## 0.21.2 - 2026-05-19

### Git workflow governance

- Added GitLab Flow branch policy defaults for `dev` integration, `master` production, short work branches, `release/*`, and `hotfix/*`.
- Made workspace lifecycle reports classify the current branch and block temporary worktree cleanup when local branch commits are neither pushed nor merged into `dev`/`master`.
- Made `scale ship` block direct governed commits on `dev`, `master`, `main`, and detached HEAD while preserving reviewed-file-only staging.
- Added GitLab Flow branch/worktree documentation and package inclusion for `docs/GITLAB_FLOW.md`.

---

## 0.21.1 - 2026-05-19

### Workflow governance

- Changed new task artifact scaffolding to use `.planning/tasks/<task>` by default instead of `docs/worklog/tasks/<task>`, while retaining legacy recognition for existing worklog artifacts.
- Added first-class `runtime.md`, `reality-check.md`, and `resource-cleanup.md` task artifacts so runtime truth, unverified claims, credential-gated paths, and cleanup decisions are explicit.
- Hardened task artifact completeness checks so L/CRITICAL plans must record human confirmation and reality checks must contain the required evidence sections.
- Updated generated workflow/resource guidance and tests for the new task artifact boundary.

---

## 0.21.0 - 2026-05-19

### Upgrade management

- Added guarded `scale upgrade check` and `scale upgrade plan` flows that read `.scale/governance.lock.json`, detect missing generated files, local template edits, SCALE version drift, and governance pack status.
- Added `scale upgrade apply --confirm` for the safe subset of upgrades: restore missing generated governance files, refresh the governance lock, and write `.scale/backups/upgrade-*` rollback evidence before changing files.
- Added `scale upgrade rollback` to restore the latest SCALE-managed safe apply without guessing Git history or touching unrelated manual changes.
- Added HTML upgrade plan output so teams can review update impact before applying changes.

### Tool and skill update governance

- Added `scale tools outdated` and `scale skill outdated` as check-only update surfaces for skills, MCP servers, browser tooling, desktop automation, and external CLI dependencies.
- Kept third-party updates explicit and non-installing by default, with trust level, source, update policy, and safety notes surfaced for review.

### Documentation and generated templates

- Added upgrade-management documentation and wired the guarded update flow into generated workflow guidance.
- Updated README quickstart guidance so users can check, plan, safely apply, and roll back workflow template updates.

### Verification

- Added unit and CLI coverage for upgrade check, plan, safe apply, rollback, and third-party outdated surfaces.
- Verified the release candidate with build, full Vitest suite, npm pack dry-run, and Git diff checks.

---

## 0.20.0 - 2026-05-19

### Agent Engineering OS governance

- Added Context Budget and Progressive Governance commands so agents can keep S-level work lightweight while escalating risky auth, data, security, deployment, and cross-module tasks.
- Added Code Intelligence with adapter-first CodeGraph/Graphify support, explicit source-scan fallback, impact/context queries, and exploration ROI metrics.
- Added Workflow Eval with baseline suites, pass@k metrics, token/tool-call counters, Failure Replay records, comparison reports, and improvement candidates.
- Added Skill Radar with capability confidence, safety level, evidence requirements, supply-chain checks, and guarded recommendations for UI/UX, browser, desktop, MCP, and external CLI work.
- Added Memory Brain for evidence-backed long-term memory, contradiction detection, dream maintenance, promotion review, export/import, and Failure Replay incident ingestion.
- Added Governance Dashboard to render runtime evidence, eval failures, memory health, resource findings, and HTML artifacts into a local review HTML report.

### Cross-project correctness

- Fixed new `--dir` aware commands so relative `.scale` state resolves inside the target project when `SCALE_DIR` is not set.
- Restored the docs index as readable UTF-8 Chinese and added entries for the new governance modules.
- Included new governance reference docs in the npm package manifest.

### Verification

- Added CLI coverage for context budget, progressive governance, code intelligence, workflow eval, skill radar, memory brain, and governance dashboard.
- Verified the final local release candidate with build, lint, full Vitest suite, `npm pack --dry-run`, and `git diff --check`.

---

## 0.19.0 - 2026-05-19

### Runtime evidence and product smoke gates

- Added product smoke governance gates that can auto-record passed runtime evidence for real product-path checks.
- Blocked final M/L delivery claims when `productSmokeGate=block` and no passed product smoke evidence exists.
- Rejected skipped product smoke reports so placeholder smoke scripts cannot be treated as passing verification.
- Added setup guidance to generated `.scale/product-smoke.json` and init next steps so projects are prompted to replace skipped probes with real user-path checks.

### Memory and learning loop

- Added runtime-evidence-backed memory learning settlement so completed tasks can produce reviewable learning candidates without promoting unverified claims.
- Added compact memory context pack support that combines task scope, runtime evidence, knowledge, and graph status within a token budget.

### Workspace safety

- Added a shared Git workspace safety check for unresolved merge conflicts.
- Made `scale preflight` block early when the root workspace has unresolved conflicts, skipping service targets and engineering standards scans.
- Made `scale doctor` surface unresolved Git conflicts as a core failure and skip noisy standards scans until the workspace is resolved.

### Release readiness and demos

- Added release-readiness demo smoke coverage and an official governance demo path through runtime evidence, memory settlement, and HTML artifact checks.
- Fixed scaffold/project preflight directory handling so generated demo projects run checks against the intended project root.

### Verification

- Added tests for product smoke evidence recording, skipped smoke rejection, runtime final checks, memory learning settlement, workspace conflict blocking, and release-readiness demo flows.

---

## 0.18.0 - 2026-05-18

### Governed HTML artifacts

- Added `scale artifact render`, `scale artifact doctor`, `scale artifact settle`, and `scale artifact open` for traceable HTML task outputs.
- Added a Markdown-source-to-HTML artifact layer for plan comparison, implementation plans, code reviews, status reports, incident reports, and release reports.
- Added `.scale/output-policy.json` to generated governance templates so projects can control HTML artifact sources, safety policy, theme, and Git retention behavior.
- Added HTML artifact manifests and index pages under task worklogs so generated reports stay tied to source Markdown, missing-source evidence, and generation metadata.

### Resource governance integration

- Classified task-scoped HTML artifacts and `artifact-manifest.json` as review-required task evidence instead of unmanaged generated files.
- Documented HTML artifacts in generated workflow guidance while keeping Markdown as the editable source of truth.

### Verification

- Added unit and CLI tests for HTML artifact rendering, safety checks, settlement evidence, governance template generation, and resource classification.

---

## 0.17.0 - 2026-05-18

### Cognitive workflow command gates

- Added `scale context init` and `scale context grill` to create project context templates, inspect current context docs, generate task-specific grill questions, and append evidence into task `explore.md`.
- Added `scale diagnose plan` to require reproducible failure evidence, hypotheses, verification commands, and blockers before bug-fix work proceeds.
- Added `scale tdd slice` to record RED/GREEN/REFACTOR command evidence and persist TDD state for behavior-changing work.

### Active workflow guidance

- Added workflow guidance generation during `scale build`, including required next commands for M/L/CRITICAL tasks.
- Persisted required command queues in `.scale/state/current.json.openTasks` so `scale status` can guide the next concrete action instead of returning generic advice.
- Blocked `scale verify` while required workflow open tasks remain, and cleared the verification open task after successful completion so status advances to review.

### Tool execution evidence

- Added safe default CLI version checks in the tool orchestrator so CLI capabilities can produce passed/failed evidence instead of only skipped placeholders.
- Added tests for CLI evidence execution, context governance, diagnostic loops, TDD slices, workflow guidance, open-task queue behavior, and the full CLI workflow path.

---

## 0.16.0 - 2026-05-17

### Governed skill orchestration

- Added a progressive skill repository with governed UI/UX, web access, browser automation, Chrome DevTools MCP, desktop automation, and external Agent CLI capabilities.
- Added skill recommendation and install-safety scanning for HTTPS source checks, dangerous shell patterns, script-review requirements, npm audit-signature guidance, and pinned-source verification.
- Added CLI flows for `scale skill repo`, `scale skill recommend`, and `scale skill safety`.

### Visual prompt and leadership workflows

- Added visual Vibe Coding prompt templates for product discovery, UI/UX direction, technical architecture, implementation slicing, and release verification.
- Added CLI flows for browsing, selecting, and rendering copyable prompt templates.
- Added CEO, CTO, product, UX, QA, security, and delivery leadership presets so generated governance can make role ownership explicit.

### Tool and resource governance

- Added tool capability orchestration, evidence capture, and policy gates for MCP, skills, browser automation, CLI tools, desktop automation, and external agent calls.
- Strengthened resource governance for maintained documents, durable specifications, task evidence, temporary outputs, generated reports, and repository hygiene.
- Extended engineering standards checks for noisy logs, sensitive-data handling, ORM/database conventions, framework boundaries, architecture consistency, UI/UX expectations, testing rigor, deployment readiness, and security controls.

### Verification

- Added tests covering skill repository safety, leadership presets, Vibe prompt templates, tool orchestration, resource governance, standards scanning, and CLI behavior.

---

## 0.15.1 - 2026-05-15

### Tool orchestration governance

- Added routing contracts for UI/UX, web research, browser automation, desktop automation, and external Agent CLI work.
- Registered `awesome-design-md`, `ui-ux-pro-max`, `web-access`, `agent-browser`, Chrome DevTools MCP, CUA, Codex CLI, Gemini CLI, and OpenCode CLI as governed capabilities.
- Extended generated skill-plan and skill-evidence templates so agents must explain tool selection, browser evidence, desktop automation evidence, and external CLI evidence.
- Verified `scale init --governance-pack project-scaffold` generates the new tool orchestration domains and evidence templates.

### Resource and engineering standards governance

- Added resource asset governance for maintained documents, versioned outputs, task evidence, temporary files, and generated reports.
- Added engineering standards governance for noisy logs, sensitive data redaction, secure input handling, ORM/database use, framework conventions, architecture boundaries, and test rigor.
- Added CLI and doctor coverage for resource scans, standards scans, generated policy drift, and verification gating.

### Runtime and release quality

- Silenced default test-environment logs while preserving explicit `SCALE_LOG_LEVEL` overrides.
- Added default logger redaction for password, token, authorization, cookie, secret, API key, and private key fields.
- Unified CLI, MCP, and HTML renderer version reporting through `package.json` to prevent release banner drift.
- Updated README release metadata and validation counts.

---

## 0.15.0 - 2026-05-15

### MOE workspace governance

- Added `.scale/workspace.json` as an explicit topology contract for single-repo, monorepo, polyrepo, submodule-workspace, and MOE projects.
- Added `scale workspace map` to inspect or generate starter workspace topology configuration.
- Added `moe-workspace` governance pack output with MOE collaboration guidance and workspace topology defaults.
- Extended workspace lifecycle checks so configured MOE child repositories are discovered even when they are too deep for generic nested-repo scanning.
- Added MOE finish-policy warnings for root pointer or integration metadata review after child repository changes.

---

## 0.14.0 - 2026-05-15

### Active skill routing and workflow gates

- Added workflow skill routing for UI, API, database, security, docs, review, release, skill-discovery, and full-stack prototype work.
- Added `scale skill doctor` to check whether required workflow skills are physically installed.
- Added `scale skill check --require-installed` and `scale verify --require-installed-skills` for optional required-skill installation gates.
- Added stricter skill evidence validation so required skills must be named with concrete executed, skipped, fallback, or verified status instead of template placeholders.
- Added generated skill-plan, skill-evidence, Mini-PRD, UI spec, visual review, API contract, security, database, docs, and E2E artifact templates.

### Service-aware verification

- Added `scale preflight --preflight-profile quick|full|ci` with a quick default that skips coverage and security gates for fast local checks.
- Added CI/full profiles that run build, lint, test, coverage, and security gates through the shared service matrix.
- Added service-aware verification template generation for Node, frontend, Go service-matrix, and project-scaffold governance packs.
- Fixed coverage command detection so missing coverage scripts are reported explicitly instead of falling back to an invalid test command.
- Added machine-readable JSON output for init, workflow list, skill scan, skill doctor, preflight, and related governance checks.

### Governance template packs

- Added versioned governance template packs for generated workflow scaffolds.
- Added `.scale/governance.lock.json` and `scale governance diff` for generated governance drift detection.
- Added `scale init --governance-pack <pack>` with `project-scaffold` and `go-service-matrix` support.
- Added optional `scale doctor` governance drift warnings.
- Added Go service-matrix defaults for `netdisk`, `auth`, and `gateway`, excluding reference modules from default gates.

### Review and release safety

- Derived Karpathy review context from task payload, verification evidence, and actual changed files instead of hardcoded pass values.
- Added JSON review output for Karpathy context, checks, advisory pass state, and violations.
- Added scoped ship protections so only files covered by passing review records are staged.
- Strengthened task metrics and artifact-gate recording for M/L/CRITICAL work.

### Workspace lifecycle

- Added `scale workspace status` and `scale workspace finish` to inspect root worktree state plus child repositories.
- Added `scale workspace cleanup` with dry-run by default, confirmation-token guarded apply, and registered linked-worktree safety checks.
- Added cleanup safety decisions so temporary worktrees are blocked when submodules or nested repositories still have uncommitted or unpushed work.
- Added linked-worktree detection that distinguishes real worktrees from submodules.

### Agent and external skill integration

- Added proactive skill discovery and external workflow skill catalog integration.
- Added multi-agent command and profile support for planner, implementer, reviewer, tester, debugger, security, and documentation roles.
- Added broader adapter compatibility for agent platforms and command generation.

---

## 0.13.0 - 2026-05-14

### Artifact-based Gate verification + Autonomous dev loop

**Workflow optimization — content + execution + checking triangle:**

- **WorkflowArtifactWriter** — structured JSON artifacts in `.scale/state/`
  - `explore.json`: file count, contradiction, ambiguity score, Socratic status
  - `plan-{id}.json`: boundary analysis, exception handling, rollback strategy
  - `tdd-{taskId}.json`: red/green/refactor/testFirst evidence
  - `checkpoint.json`: phase checkpoint data

- **GateSystem enhancement** — G1/G2/G3 prioritize structured artifacts, fallback to legacy proxy checks
  - G1 ExplorationGate: checks `explore.json` fileCount ≥ 3 and non-empty contradiction
  - G2 PlanningGate: checks `plan-*.json` boundary + exception + rollback flags
  - G3 TDDGate: checks `tdd-*.json` red/green/refactor/testFirst completion

- **CLI auto-artifact writing** — `scale define` writes `explore.json`, `scale plan` writes `plan-*.json`

- **Hook noise reduction** — `tmpl-explore-check` uses `exit 0` (warning) not `exit 2` (blocking)
- **Next step reminder** — `tmpl-next-step-reminder` Stop hook shows remaining SCALE phases

- **WorkflowEngine integration** — `explore()` and `plan()` methods auto-write artifacts via injected `WorkflowArtifactWriter`

**Autonomous development loop (cron-driven):**

- **WorklogManager** — parse/update markdown worklog with Pending/Done/In Progress/Blocked sections, priority P0-P2
- **AutonomousDevLoop** — 6-step cycle: readWorklog → runQA → fixDefects → developFeatures → updateWorklog → writeBaton
- **Baton System integration** — cross-session persistence via `.scale/baton/next-prompt.md`
- **EventBus events** — `autonomous.loop.start/end/defect/fix` lifecycle events

**Platform adapter:**

- **KiroAdapter** — Amazon Kiro platform (17th adapter)

**Quality improvements:**

- Doctor: mark optional checks (Python, Graphify) so core checks stay strict
- Interactive `scale init` mode with agent platform selection and scenario config
- New guardrail detectors for enhanced coverage
- `.gitignore`: add `.scale/state/` for runtime artifacts
- 59 new tests: artifactWriter (19), worklogManager (21), autonomousDevLoop (19)
- Fixed pre-existing `phaseCli` test failure caused by untracked files in working tree

**Verified:**

- `npx vitest run` — 649 tests passed (49 files), zero failures

---

## 0.12.1 - 2026-05-12

### ContextBuilder glossary injection

**Added:**

- ContextBuilder P1.9 layer: auto-injects `.scale/GLOSSARY.md` domain terms into every session context
- Agent sees "Use these domain terms exactly. Do not substitute synonyms." constraint
- 12 core terms (Artifact, FSM, Gate, Evidence, Detector, Hook, etc.) surfaced automatically

**Verified:**

- `npm run build` — tsc zero errors
- `npx vitest run tests/context/contextBuilder.test.ts` — 13 tests passed

---

## 0.12.0 - 2026-05-12

### DeepSeek TUI adapter + mattpocock/skills integration

**New platform adapter:**

- **DeepSeek TUI adapter** (13th platform) — `scale init --agent deepseek-tui`
  - Per-project config.toml overlay (#485) with sandbox_mode, approval_policy, allow_shell
  - `.deepseek/instructions.md` injection with SCALE phase workflow guide
  - Hook configuration guidance (global-only per deepseek-tui design)
  - Platform detection via `.deepseek/instructions.md`
  - `DeepSeekTuiAdapter` implements `IAgentAdapter` interface

**New features (inspired by mattpocock/skills):**

- **Out-of-Scope knowledge base** — Persistent rejected concept records (`.scale/out-of-scope/`)
  - `scale out-of-scope add|check|list|remove` CLI commands
  - Fuzzy concept matching by description keywords
  - Markdown format with title, reason, technical context, prior requests

- **Agent Brief structure** — Standardized agent-executable work specification
  - `AgentBrief` type: category, current/desired behavior, key interfaces, acceptance criteria, out-of-scope
  - Auto-generated during `scale build` phase
  - No file paths or line numbers (durability over precision)

- **Dual-axis Review — Spec dimension** — Check diff against original Spec/PRD requirements
  - `analyzeSpecConformance()`: keyword extraction, coverage scoring, missing/extra/mismatched detection
  - Integrated into `scale review` phase alongside existing Standards analysis
  - Stop word filtering, PascalCase + quoted term extraction

- **Project glossary** — Domain language system (mirrors CONTEXT.md)
  - `.scale/GLOSSARY.md` with 17 terms + 7 relationships + 3 flagged ambiguities
  - `scale context glossary` command (human + JSON output)

**Quality improvements:**

- 4 empty catch blocks fixed (AgentSourceLoader, phaseCommands, dashboard, SkillDiscovery)
- 63 new tests: phaseValidation (21), deepseek-adapter (18), outOfScopeStore (14), specConformance (9), shouldSkipCommit (1)
- deepseek-adapter Windows EBUSY file lock fix with retry mechanism

**Changes:**

- `AgentPlatform` type extended with `'deepseek-tui'`
- `TaskPayload` extended with `agentBrief?: AgentBrief`
- `ReviewRecord` extended with `specFindings?: string[]` and `specCoverage?: number`
- `SUPPORTED_AGENTS` now includes `'deepseek-tui'` (13 total)
- `SkillDiscovery` and `quickstart` updated for deepseek-tui detection

**Verified:**

- `npm run build` — tsc zero errors
- `npx vitest run` — 562 tests passed
- `scale context glossary` smoke test

---

# @hongmaple0820/scale-engine CHANGELOG

## 0.10.1 - 2026-05-10

### Phase workflow hardening

**Added:**

- `ship --no-commit` delivery reports without creating a Git commit.
- Optional strict TDD evidence gate with `--tdd-evidence` and `--tdd-strict`.
- Review analyzer regression coverage for empty `catch`, `@ts-ignore`, focused tests, dangerous shell/Git commands, G7 security evidence, scanner regex definitions, and risky test fixtures.
- Built-in G7 security scan with explainable file/line evidence for secrets, private keys, disabled TLS verification, unsafe runtime execution, raw HTML injection, dangerous shell commands, shell execution, and empty `catch` blocks.

**Changed:**

- `ship` now requires both passing verification evidence and passing review evidence.
- `ship` stages only files covered by passing review records instead of staging the whole workspace.
- `ship` blocks when new reviewable files appear after review.
- Gate command evidence now records cwd, timestamps, stdout/stderr tails, and output hashes.
- Deterministic review scanning now blocks high-risk source and process patterns before `ship`.
- G7 security scan blocks CRITICAL findings by default and can block HIGH findings in strict mode.
- README Chinese and English release docs now describe the hardened workflow and current test count.

**Verified:**

- `npm run build`
- `npx vitest run` - 461 tests passed
- `git diff --check`
- `npm pack --dry-run`

## 0.10.0 - 2026-05-10

### Phase workflow gates and scoped release safety

**Added:**

- Phase-aligned CLI workflow: `define -> plan -> build -> verify -> review -> ship`.
- FSM-backed Spec, Plan, and Task artifacts for the phase workflow.
- Persisted verification evidence under `.scale/evidence`.
- Persisted deterministic review records under `.scale/reviews`.
- npm package metadata normalized for the `scale` binary.

**Verified:**

- `npm run build`
- `npx vitest run`
- `npm pack --dry-run`

## 0.7.1 - 2026-05-06

### 工作流优化：SessionStart Hook 增强 + 自进化闭环自动化 + 记忆利用率提升

**新增功能：**

- **SessionStart Hook 增强**：Agent 主动感知 FSM 状态
  - 新增 `scale context inject --session-id <id>` CLI 命令
  - SessionStart hook 调用 FSMAgentBridge.getSessionContext()
  - 获取活跃 Artifact FSM 状态 + 相关 Lessons
  - 输出格式化上下文供 Agent 读取
  - `src/api/cli.ts` 新增 contextInject 命令
  - `src/fsm/FSMAgentBridge.ts` 新增 getSessionContext 方法
  - `src/adapters/ClaudeCodeAdapter.ts` 修改 SessionStart hook

- **AutoDefectCreator**：自进化闭环自动化
  - 监听 behavior.hallucination、behavior.ai_slop 等事件
  - 自动创建 Defect artifact（包含 rootCauseCategory、evidence、detector）
  - 5 种事件类型处理：hallucination、ai_slop、duplicate_edit、brute_retry、blame_shift
  - 发射 defect.auto_created 事件
  - `src/evolution/AutoDefectCreator.ts`

- **BehaviorTracker 增强**：自动触发进化周期
  - 新增 setAutoEvolve() 配置方法
  - bruteRetryCount >= threshold 时自动调用 EvolutionEngine.runCycle()
  - `src/evolution/BehaviorTracker.ts`

- **ContextBuilder 增强**：记忆利用率提升
  - 自动召回 lessons（基于 artifact.tags + role context）
  - 新增 recallRelevantLessons() 私有方法
  - Tag 匹配评分 + 过滤
  - 无 artifact 时也召回通用 lessons
  - `src/context/ContextBuilder.ts`

**改进：**

- `src/artifact/types.ts` 新增事件类型：`defect.auto_created`
- `src/index.ts` 导出新模块：AutoDefectCreator、IBehaviorTracker、AutoEvolveConfig、DefectPayload

## 0.7.0 - 2026-05-06

### 自进化循环增强：FSM 上下文桥接 + Hook 增强 + 检测器统计 + Lesson 验证 + Evolution 评估

**新增功能：**

- **FSMAgentBridge**：Agent FSM 上下文感知桥接
  - 提供 `getSnapshot()` 获取 Artifact FSM 状态快照
  - 提供 `getAllowedActions()` 获取当前状态允许的操作
  - 提供 `suggestNext()` 建议下一步操作
  - 提供 `formatForPrompt()` 格式化为 Agent 可读的上下文
  - `src/fsm/FSMAgentBridge.ts`

- **HookGeneratorEnhanced**：增强 Hook 生成器
  - 支持模板化 Hook 生成（变量替换）
  - 4 个内置模板：detector-trigger、lesson-learned、rule-enforcement、verification-gate
  - Detector 集成支持（从 DetectorStatistics 生成 Hook）
  - `src/hooks/HookGeneratorEnhanced.ts`

- **HookDeployer**：Hook 部署管理器
  - `deploy()` 部署 Hook 到 settings.json（备份原文件）
  - `rollback()` 回滚到备份版本
  - `validateForDeployment()` 验证 Hook 合规性
  - `src/hooks/HookDeployer.ts`

- **DetectorEnhanced**：增强检测器系统
  - `DetectorStatisticsTracker`：跟踪检测器触发统计
  - `DetectorRegistry`：检测器注册和配置管理
  - `AISlopDetector`：AI 生成代码痕迹检测（渐变滥用、emoji、模板布局）
  - `HallucinationDetector`：未验证成功声明检测（"测试通过"、"构建成功"等）
  - `DuplicateEditDetector`：重复编辑检测（同一内容编辑多次）
  - `EnhancedGatewayContext`：增强 Gateway 上下文（集成统计）
  - `src/guardrails/DetectorEnhanced.ts`

- **LessonValidator**：Lesson 提取验证系统
  - 4-Gate 验证：Trigger、Googleability、Context-Specific、Deduplication
  - 确保提取的 Lesson 不易搜索、上下文特定、无重复
  - 事件发射：`lesson.validated`
  - `src/evolution/LessonValidator.ts`

- **EvolutionEvaluator**：进化效果评估器
  - 收集 Lessons、Rules、Hooks、Detector 指标
  - 计算 Lesson 质量、Rule 效果、Detector 效果分数
  - 提供 `compareWithBaseline()` 对比基线
  - 提供 `getRecommendations()` 生成改进建议
  - Trend 分析：improving / stable / declining
  - `src/evolution/EvolutionEvaluator.ts`

- **DashboardServer**：Web Dashboard 可视化状态监控
  - Hono-based web server 提供实时状态监控
  - API routes: `/api/state`, `/api/artifacts`, `/api/evolution`, `/api/detectors`, `/api/events`
  - Artifact 状态树可视化（parent-child 关系）
  - Evolution metrics 实时展示（Lessons/Rules/Detectors 统计）
  - Detector statistics 展示（触发次数、severity 分布）
  - Recent events 流展示
  - 每 5 秒自动刷新
  - `src/dashboard/DashboardServer.ts`

**改进：**

- `src/artifact/types.ts` 新增事件类型：`hook.deployed`、`hook.rollback`、`behavior.ai_slop`、`behavior.hallucination`、`behavior.duplicate_edit`、`lesson.validated`、`evolution.evaluated`
- `src/index.ts` 导出所有新模块（FSMAgentBridge、HookGeneratorEnhanced、HookDeployer、DetectorEnhanced 组件、LessonValidator、EvolutionEvaluator、DashboardServer）
- SQLite tests 修复：`describe.skip` 在 Bun 环境中跳过 better-sqlite3 测试（Bun 不支持 better-sqlite3）

**测试：**

- 新增 FSMAgentBridge 测试（5 个）
- 新增 HookGeneratorEnhanced 测试（5 个）
- 新增 HookDeployer 测试（5 个）
- 新增 DetectorEnhanced 测试（15 个）
- 新增 LessonValidator 测试（10 个）
- 新增 EvolutionEvaluator 测试（10 个）
- 测试总数：323 passed（21 test files）

## 0.6.0 - 2026-04-29

### SQLite 持久化 KnowledgeBase + FSM 并发锁 + 第 9 检测器

**新增功能：**

- **SQLiteKnowledgeBase**：基于 better-sqlite3 的持久化知识库
  - WAL 模式 + busy_timeout 保证并发安全
  - 完整实现 `IKnowledgeBase` 接口：add / recall / recallByVector / markHelpful / markUseless / verify / decay / stats / close
  - 支持多类型过滤、标签过滤、最小相关度过滤、已验证过滤
  - 数据在 close + reopen 后完整保留
  - `src/knowledge/SQLiteKnowledgeBase.ts`
- **FSM 并发锁**：per-artifact Promise 链式锁
  - 防止同一 Artifact 的并发状态迁移产生竞态条件
  - 不同 Artifact 间可并行迁移
  - `pendingLocks` getter 用于监控
  - `src/artifact/fsm.ts`
- **ScopeCreep 检测器**（第 9 个）：范围蔓延检测
  - 跟踪单会话内编辑的不同文件数量
  - 超过阈值（默认 15 个文件 / 10 分钟窗口）时发出警告
  - 支持自定义 `maxFiles` 和 `windowMs` 参数
  - `src/guardrails/advancedDetectors.ts`

**改进：**

- CLI 默认使用 SQLiteKnowledgeBase（替代内存版 KnowledgeBase）
- CLI 注册 ScopeCreepDetector 为 preTool 检测器
- 公共 API 新增导出：`SQLiteKnowledgeBase`, `IKnowledgeBase`, `DangerousCommandDetector`, `SecretLeakDetector`, `RoleGateDetector`, `ScopeCreepDetector`, `BUILT_IN_ROLES`

**测试：**

- 新增 SQLiteKnowledgeBase 测试（19 个）：CRUD、过滤、持久化、事件发射
- 新增 FSM 并发锁测试（4 个）：序列化、跨 Artifact 并行、历史完整性
- 新增 ScopeCreep 检测器测试（5 个）：阈值、文件去重、Write 跟踪

## 0.5.0 - 2026-04-22

### 重大更新：7 Agent 适配器 + 场景模式 + 工作流预设 + 技能生态

**新增功能：**

- **7 种 Agent 适配器**：新增 OpenCode, Cursor, Gemini, OpenClaw, Hermes 适配器
  - 统一 `createAdapter()` 工厂函数
  - `SUPPORTED_AGENTS` 常量导出
  - `src/adapters/index.ts` 统一入口
- **3 种场景模式**：Sandbox / Standard / Critical
  - 不同检测器敏感度 (low/medium/high)
  - 不同验证要求、人工确认要求、最大重试次数
  - `ScenarioModeConfig` 类型 + `SCENARIO_MODE_CONFIGS` 预设
- **10 种工作流预设**：`src/workflows/presets.ts`
  - 基础开发流、TDD功能开发、Bug修复、SDD、代码审查
  - 安全审计、Ralph自主循环、快速原型、大规模重构、并行执行
  - `scale workflow list` CLI 命令
- **技能生态系统**：`src/skills/SkillDiscovery.ts`
  - 自动检测 Agent 平台
  - 扫描技能目录
  - 生成 skills.md
  - `scale skill scan` CLI 命令
- **SCALE v10.0 哲学**：ContextBuilder P1 系统规则层
  - v5.0 × v8.0 × v9.1 核心认知框架
  - 物理约束 (不可绕过)
  - 场景模式上下文注入
- **CLI 增强**：
  - `scale init --scenario <mode>` 场景模式选择
  - `scale workflow list [--scenario <mode>]` 工作流列表
  - `scale skill scan` 技能发现
  - 版本号 0.5.0
- **类型系统扩展**：
  - `AgentPlatform` 类型 (7 种)
  - `ScenarioMode` + `ScenarioModeConfig`
  - `SkillRef` + `SkillScanResult`
  - `WorkflowPreset` + `WorkflowStep`

### 改进

- ContextBuilder 导入修复：移除无效的 `ScenarioModeConfig` 类型导入
- 统一适配器导出：从 `ClaudeCodeAdapter` 改为 `adapters/index.ts`
- 完善公共 API 导出

## 0.4.0 - 2026-04-22

## 0.3.0 - 2026-04-21

### 新功能

- 新增 `scale context status --session-id <id>` 命令，显示 session-level 约束
  - 显示当前 role 允许/禁止的工具
  - 显示 active artifacts 列表
  - 显示关键 constraints（Spec 未 FROZEN、Plan 未 approve 等）
- 新增 `scale create-prd <title>` 命令，自动创建 Spec → Plan → Tasks 层级
  - 自动生成 artifact ID 层级树
  - 批量创建 Tasks（逗号分隔）
  - 输出下一步操作提示
- 在 maple-cart-mall 项目配置 hooks 集成（SessionStart/PreToolUse/PostToolUse/Stop）
  - PreToolUse 调用 `scale gate pre-tool` 拦截违规操作
  - PostToolUse 记录工具调用输出
  - Stop 调用 `scale gate before-stop` 防止 premature done

### Documentation

- 创建 docs/OPTIMIZATION_PLAN.md 优化方案文档

## 0.2.0 - 2026-04-21

### 新功能

- 新增 `scale suggest <id>` 命令，显示 Artifact 当前状态可执行的操作列表
  - 显示每个 action 的执行状态（✅ 可执行 / ❌ 被 Guard 拦截）
  - 显示 Guard 条件和拦截原因，降低用户认知负担
  - 支持 `--json` 输出用于脚本集成

## 0.1.0 - 2026-04-21

### Features

**六层架构完整实现：**

- **L1 Context** — Token 预算 + 上下文组装策略
- **L2 Guardrails** — 8 检测器 + Role 网关 + 模糊度阈值拦截
- **L3 Observability** — EventBus + BehaviorTracker 全链路追踪
- **L4 Orchestration** — TaskEngine + Effects 系统 + ModelRouter
- **L5 Memory** — KnowledgeBase + 衰减算法 + SQLite 持久化
- **L6 Evolution** — Defect→Lesson→Rule→Hook 四级自进化闭环

**核心模块：**

- **Artifact FSM** — 11 种 Artifact 类型，状态机驱动生命周期管理
- **Gateway** — 角色切换、权限控制、ambiguity 阈值物理拦截
- **TaskEngine** — 步骤执行、Checkpoint、失败恢复
- **EvolutionEngine** — 行为追踪、缺陷诊断、知识提取、Hook 生成
- **ModelRouter** — 多模型路由策略（Haiku/Sonnet/Opus）
- **Adapters** — Claude Code / Codex CLI 平台适配

**CLI 命令 (13 个)：**

- `scale init` — 初始化项目
- `scale doctor` — 环境诊断
- `scale create` — 创建 Artifact
- `scale list/show` — 查询
- `scale transition` — 状态迁移（含 guard）
- `scale role` — 角色切换
- `scale context` — 上下文组装
- `scale evolve` — 进化周期
- `scale stats/session/gate` — 统计与会话管理

**测试覆盖：**

- 148+ 单元测试通过
- 集成测试覆盖 Adapters、W11 完整流程

### Documentation

- 完整架构文档 (`docs/01-ARCHITECTURE.md`)
- 数据模型定义 (`docs/02-DATA-MODEL.md`)
- 核心模块详解 (`docs/03-CORE-MODULES.md`)
- 集成指南 (`docs/04-INTEGRATION.md`)
- Roadmap (`docs/05-ROADMAP.md`)
- 技术决策记录 (`docs/06-DECISIONS.md`)

---

*Initial release - AI engineering scaffold engine for constrained agent workflows*
