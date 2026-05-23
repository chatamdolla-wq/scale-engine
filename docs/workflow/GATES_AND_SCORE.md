# Gates and Task Score

This document records the first deterministic optimization layer for gate visibility, architecture conformance, and task scoring.

## Gate Status

Use `scale gates status` to inspect the active gate catalog.

```bash
scale gates status --json
```

The report separates three concepts that were previously easy to confuse:

- Core gates: `G0-G8`, used by workflow verification, preflight, and product smoke profiles.
- Meta-governance gates: `G9-G15`, used by `scale meta-governance`.
- Extension gates: policy-backed checks such as engineering standards, product smoke policy, and tool evidence.

`scale gates status` is intentionally read-only. It does not execute checks; it explains which checks exist and which policies are blocking.

## Architecture Standards Gate

Architecture and engineering standards are driven by project configuration:

- `.scale/verification.json` controls whether `engineeringStandardsGate` is `off`, `warn`, or `block`.
- `.scale/engineering-standards.json` controls standards rules and baselines.
- `.scale/frameworks.json` records project-specific framework and architecture conventions.

Preflight now uses changed-file standards scope when the target is inside a Git worktree. Non-Git projects keep the old full-scan behavior so bootstrap and fixture projects still get complete feedback.

## Task Score

Use `scale score task` to produce an algorithmic completion score.

```bash
scale score task --changed --json
scale score task --task-id TASK-123 --level L --changed-files src/api/foo.ts,src/workflow/bar.ts
```

The score is computed from evidence, not from a model:

- Verification: recent gate pass rate.
- Architecture standards: deterministic standards doctor result.
- Evidence completeness: persisted gate evidence records.
- Context and memory: CodeGraph/code intelligence readiness and memory provider readiness.
- Cost efficiency: governance ROI and cache/context savings.
- Risk control: task level, blocking standards, and blocking extension gates.

Default thresholds:

- `S`: 65
- `M`: 75
- `L`: 85
- `CRITICAL`: 90

Use `--warn-only` when the score should be reported without failing the command.
