# Resource Governance

SCALE now treats project outputs as governed resources instead of undifferentiated files.

## Problem

Engineering agents generate many useful but noisy assets:

- maintained product and architecture docs
- task plans and verification notes
- E2E reports, screenshots, videos, logs, and coverage output
- temporary scripts and scratch files
- reusable automation scripts
- API contracts and ADRs

Without lifecycle rules these files drift, conflict with the real codebase, or get committed to Git when they should be local evidence only.

## Model

`scale assets scan` classifies resources into:

| Type | Default Git policy | Lifecycle |
| --- | --- | --- |
| canonical-doc | commit | maintained |
| decision-record | commit | immutable |
| contract | commit | maintained |
| reusable-script | commit | maintained |
| task-artifact | review | task-scoped |
| evidence-report | ignore | generated |
| generated-media | review/external | generated or review-required |
| temporary | ignore | temporary |

`.scale/resource-policy.json` owns defaults such as owners, module mapping, runtime directories, and maximum Git file size.

`.scale/assets.json` is the explicit catalog for long-lived project assets and source-of-truth declarations.
Declared source-of-truth assets are checked by `assets doctor`; if the file disappears, the doctor fails. Maintained assets can also declare `lastReviewedAt` and `reviewIntervalDays` so product, architecture, workflow, and standards documents are rechecked against the current implementation instead of drifting silently:

```json
{
  "assets": [
    {
      "path": "docs/modules/auth/architecture.md",
      "type": "canonical-doc",
      "owner": "auth-team",
      "module": "auth",
      "sourceOfTruth": true,
      "lifecycle": "maintained",
      "gitPolicy": "commit",
      "lastReviewedAt": "2026-05-15",
      "reviewIntervalDays": 90
    }
  ]
}
```

## Commands

```bash
scale assets scan --json
scale assets doctor --json
scale assets settle --task-id <task-id> --artifact-dir docs/worklog/tasks/<task>
scale init --governance-pack resource-governance
```

`assets doctor` fails when runtime evidence or external media is already tracked by Git, or when a declared source-of-truth asset is missing. It warns on large tracked files, expired temporary outputs, ownerless canonical documentation, missing non-source catalog entries, and stale maintained assets.

`assets settle` runs the same checks and appends a settlement section to `resource-impact.md` when a task artifact directory is provided.

## Finish Rule

Before finishing M/L/CRITICAL work:

1. Promote final product, API, or architecture truth into maintained docs.
2. Keep raw reports, logs, screenshots, videos, and scratch scripts out of Git unless deliberately promoted.
3. Run `scale assets scan --json`.
4. Run `scale assets doctor --json`.
5. Run `scale assets settle --task-id <task-id> --artifact-dir <task-dir>`.
6. Delete or archive temporary resources that are no longer needed.
