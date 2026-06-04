#!/usr/bin/env bash
# G13: Multi-Agent Coordination — verify coordination evidence for multi-agent projects
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "[G13] Multi-Agent Coordination"

cd "$REPO_ROOT"

SCALE_DIR="${SCALE_DIR:-.scale}"

# Check 1: Agent config existence
if [ ! -d "$SCALE_DIR/agents" ]; then
  echo "  [OK] Single-agent mode, skip coordination check"
  echo "  PASSED"
  exit 0
fi

echo "  [INFO] Multi-agent mode detected"

WARNINGS=0

# Check 2: Coordinator state
if [ -f "$SCALE_DIR/coordinator/state.json" ]; then
  if command -v node &>/dev/null; then
    node -e "
      const s = JSON.parse(require('fs').readFileSync('$SCALE_DIR/coordinator/state.json','utf-8'));
      const sessions = s.activeSessions?.length ?? 0;
      const overlaps = s.overlaps?.length ?? 0;
      const conflicts = s.conflicts?.filter(c => c.status === 'open').length ?? 0;
      console.log('  [INFO] Active sessions: ' + sessions + ', Overlaps: ' + overlaps + ', Open conflicts: ' + conflicts);
      if (conflicts > 0) process.exit(2);
    " 2>/dev/null
    EXIT_CODE=$?
    if [ "$EXIT_CODE" -eq 2 ]; then
      echo "  [BLOCK] Open conflicts detected in coordinator"
      WARNINGS=$((WARNINGS + 1))
    fi
  fi
else
  echo "  [WARN] No coordinator state — multi-agent without coordination evidence"
  WARNINGS=$((WARNINGS + 1))
fi

# Check 3: Agent communication events
EVENTS_DIR="$SCALE_DIR/events"
AGENT_EVENTS=0
if [ -d "$EVENTS_DIR" ] && command -v node &>/dev/null; then
  AGENT_EVENTS=$(node -e "
    const fs = require('fs');
    const dir = '$EVENTS_DIR';
    let count = 0;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'))) {
      try {
        const lines = fs.readFileSync(dir + '/' + f, 'utf-8').split('\n').filter(l => l.trim());
        for (const line of lines) {
          const ev = JSON.parse(line);
          if (ev.type?.includes('agent') || ev.payload?.agent) count++;
        }
      } catch {}
    }
    console.log(count);
  " 2>/dev/null || echo 0)
fi

if [ "$AGENT_EVENTS" -gt 0 ]; then
  echo "  [OK] $AGENT_EVENTS agent interaction event(s)"
else
  echo "  [WARN] No agent interaction events recorded"
  WARNINGS=$((WARNINGS + 1))
fi

if [ "$WARNINGS" -gt 0 ]; then
  echo "  [BLOCK] $WARNINGS coordination issue(s)"
  echo "  FAILED"
  exit 1
fi

echo "  PASSED"
