#!/bin/bash
# SCALE Engine Installation Script

set -e

PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$PLUGIN_DIR")"

echo "Installing SCALE Engine..."

# Copy skills
if [ -d "$PROJECT_ROOT/skills" ]; then
  cp -r "$PLUGIN_DIR/../skills" "$PROJECT_ROOT/skills"
  echo "✓ Skills installed"
fi

# Copy agents
if [ -d "$PROJECT_ROOT/src/agents" ]; then
  cp -r "$PLUGIN_DIR/../src/agents" "$PROJECT_ROOT/src/agents"
  echo "✓ Agents installed"
fi

# Update settings.json (if exists)
SETTINGS_FILE="$HOME/.claude/settings.json"
if [ -f "$SETTINGS_FILE" ]; then
  echo "✓ Settings.json exists, manual integration may be needed"
else
  echo "! No settings.json found, create one for full integration"
fi

echo "SCALE Engine installed successfully!"
echo "Agents: planner, researcher, implementer, reviewer, tester, security, debugger, doc-writer"
echo "Skills: tdd, debugging, code-review, security-audit, planning, refactoring, documentation, git-workflow, performance, api-design"
