# Dependency Audit

Dependency Audit is the G7 dependency sub-gate for SCALE Engine.
It adds supply-chain checks without introducing a separate gate number such as `G6.8`.

## Scope

The auditor is intentionally bounded:

- reads `package-lock.json`
- audits direct dependencies by default
- supports `--changed-packages` for lockfile-diff workflows
- scans only selected package roots under `node_modules`
- caps package count and files per package
- does not contact the registry by default
- does not run install scripts

This keeps local verification usable while still catching high-risk dependency behavior.

## Commands

```bash
scale dependency audit
scale dependency audit --json
scale dependency audit --mode strict
scale dependency audit --changed-packages left-pad,@scope/tool --json
```

The command exits non-zero when the active mode has blocking findings.

## G7 Integration

`SecurityGate` now emits two first-class evidence sources:

- `built-in-security-scan`: source code security scan
- `dependency-audit`: dependency supply-chain scan

Both remain under `G7 Security`.

## Policy

Policy lives at `.scale/security/dependency-policy.json`:

```json
{
  "version": 1,
  "mode": "compatibility",
  "maxPackages": 50,
  "maxPackageFiles": 25,
  "allowPackages": [],
  "baselineFindings": []
}
```

Modes:

- `compatibility`: blocks `CRITICAL`
- `strict`: blocks `CRITICAL` and `HIGH`
- `offline`: keeps local-only behavior; current offline findings follow compatibility blocking

Use `baselineFindings` for accepted legacy dependency risk:

```json
{
  "baselineFindings": [
    {
      "packageName": "legacy-tool",
      "version": "1.2.3",
      "ruleId": "dependency.install-script",
      "reason": "Pinned and reviewed during migration window."
    }
  ]
}
```

Prefer a baseline over `allowPackages` when only one finding is accepted. `allowPackages` suppresses all findings for that package.

## Current Findings

The first implementation detects:

- install lifecycle scripts
- executable bin scripts
- deprecated packages from lockfile metadata
- dynamic code execution: `eval`, `new Function`
- shell execution patterns
- suspicious network access patterns

Future network-backed checks can add npm registry metadata and `npm audit --json` ingestion, but they should stay optional and evidence-backed.
