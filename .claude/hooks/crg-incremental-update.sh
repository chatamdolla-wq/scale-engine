#!/usr/bin/env bash
set -euo pipefail

# PostToolUse hook: Trigger code-review-graph incremental rebuild on file save
# Only runs when Write or Edit tools modify source files

TOOL_NAME="${CLAUDE_TOOL_NAME:-}"
FILE_PATH="${CLAUDE_FILE_PATH:-}"

# Only trigger on Write or Edit tools
if [[ "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "Edit" ]]; then
  exit 0
fi

# Only trigger on source files
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

case "$FILE_PATH" in
  *.ts|*.js|*.py|*.go|*.rs|*.java|*.cpp|*.c|*.h) ;;
  *) exit 0 ;;
esac

# Check if code-review-graph is available
if ! command -v code-review-graph &> /dev/null; then
  exit 0
fi

# Check if CRG is initialized (has a graph database)
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
if [ ! -f "$ROOT/.codegraph/codegraph.db" ] && [ ! -f "$ROOT/.crg/graph.db" ]; then
  exit 0
fi

# Run incremental build in background (non-blocking)
code-review-graph build --incremental 2>/dev/null &
disown

exit 0
