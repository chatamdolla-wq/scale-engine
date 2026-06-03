#!/usr/bin/env bash
set -euo pipefail

echo "[scale-engine] workflow: read AGENTS.md, use rtk for shell commands, run make preflight or scripts/preflight/all.ps1 before handoff."

# Dynamic cortex injection (instincts + specs + session history)
if command -v scale &> /dev/null; then
  injection=$(scale cortex inject --minimal 2>/dev/null || true)
  if [ -n "$injection" ]; then
    echo ""
    echo "$injection"
  fi
else
  # Fallback: inject scoped specs from .scale/specs/ directly
  SPECS_DIR=".scale/specs"
  if [ -d "$SPECS_DIR" ]; then
    spec_count=0
    for spec_file in "$SPECS_DIR"/*.md; do
      [ -f "$spec_file" ] || continue
      spec_count=$((spec_count + 1))
      if [ "$spec_count" -le 3 ]; then
        echo ""
        echo "## Active Spec: $(basename "$spec_file" .md)"
        head -20 "$spec_file"
        total_lines=$(wc -l < "$spec_file")
        if [ "$total_lines" -gt 20 ]; then
          echo "... ($((total_lines - 20)) more lines in $spec_file)"
        fi
      fi
    done
    if [ "$spec_count" -gt 3 ]; then
      echo "... and $((spec_count - 3)) more specs in $SPECS_DIR/"
    fi
  fi
fi