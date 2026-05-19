# Code Intelligence

SCALE uses an adapter-first code intelligence layer. It can consume external code graph tools when they exist, read graph artifacts such as Graphify outputs, and fall back to a scoped internal source scan when no provider is available.

The goal is not to replace IDE indexing. The goal is to make exploration measurable:

- which provider answered the query
- whether fallback was used
- which files are likely relevant
- how many file reads were avoided
- what confidence the result has

## Quick Start

Create the optional provider configuration:

```bash
scale codegraph init
```

Inspect provider availability:

```bash
scale codegraph status
scale codegraph status --json
```

Query code intelligence:

```bash
scale codegraph query "UserService.create"
scale codegraph impact --symbol UserService.create
scale codegraph context --symbol UserService.create --budget 2000
scale codegraph roi --symbol UserService.create
```

## Configuration

The configuration file lives at:

```text
.scale/code-intelligence.json
```

Default shape:

```json
{
  "version": "1.0",
  "providers": [
    {
      "id": "codegraph",
      "type": "external-cli",
      "enabled": true,
      "command": "codegraph",
      "capabilities": ["symbols", "callers", "callees", "impact", "context"]
    },
    {
      "id": "graphify",
      "type": "artifact",
      "enabled": true,
      "manifest": "graphify-out/GRAPH_REPORT.md",
      "capabilities": ["summary", "module-map", "context"]
    }
  ],
  "fallback": {
    "enabled": true,
    "tools": ["internal-scan", "rg", "read"]
  }
}
```

## Provider Types

| Type | Use |
| --- | --- |
| `external-cli` | Detects an installed external code graph command. SCALE does not auto-install it. The first version treats this as availability evidence until a stable command contract is configured. |
| `artifact` | Reads a local graph manifest or report file. JSON manifests can provide symbol impact data. |
| fallback | Uses a bounded internal source scan when providers are unavailable or return no hits. |

## JSON Artifact Provider

Artifact providers can point at a JSON manifest:

```json
{
  "symbols": [
    {
      "name": "UserService.create",
      "file": "src/user.ts",
      "callers": ["src/api.ts"],
      "callees": ["src/db.ts"]
    }
  ],
  "files": [
    {
      "path": "src/user.ts",
      "symbols": ["UserService.create"]
    }
  ]
}
```

This allows SCALE to answer impact queries without reading the whole repository.

## ROI Metrics

Code intelligence reports include:

| Metric | Meaning |
| --- | --- |
| `graphHits` | Number of hits from graph providers. |
| `fallbackCount` | Whether fallback was needed. |
| `baselineFileReads` | Estimated broad exploration file reads. |
| `recommendedFileReads` | Scoped file reads recommended by the query result. |
| `fileReadsSaved` | Estimated avoided reads. |
| `toolCallsSaved` | Estimated avoided exploration tool calls. |

These numbers are deliberately conservative. They are a local signal for whether graph-assisted exploration is worth keeping default for a task class.

## Governance ROI

`scale governance roi` can include code intelligence:

```bash
scale governance roi --symbol UserService.create
scale governance roi --code-query createUser
```

When a graph provider answers, the module is reported as measured evidence. When fallback is used, the module is reported as estimated and needs more evidence before becoming a stronger default.

## Policy

- SCALE must run when no code graph provider is installed.
- Missing providers must produce explicit fallback, not silent success.
- External tools are detected but not installed automatically.
- Source files are read only through a bounded fallback scan.
- Large generated graph outputs should stay outside default prompt context; use summaries and file paths.
