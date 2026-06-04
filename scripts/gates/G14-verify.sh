#!/usr/bin/env bash
# G14: Skill Utilization — verify skill routing config and execution
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "[G14] Skill Utilization"

cd "$REPO_ROOT"

SCALE_DIR="${SCALE_DIR:-.scale}"

# Check 1: Skill routing config
if [ ! -f "$SCALE_DIR/skills.json" ]; then
  echo "  [WARN] No skills.json — skill routing not configured"
  echo "  PASSED"
  exit 0
fi

echo "  [OK] Skill routing configured"

# Check 2: Skill execution events
EVENTS_DIR="$SCALE_DIR/events"
SKILL_EVENTS=0
if [ -d "$EVENTS_DIR" ] && command -v node &>/dev/null; then
  SKILL_EVENTS=$(node -e "
    const fs = require('fs');
    const dir = '$EVENTS_DIR';
    let count = 0;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'))) {
      try {
        const lines = fs.readFileSync(dir + '/' + f, 'utf-8').split('\n').filter(l => l.trim());
        for (const line of lines) {
          const ev = JSON.parse(line);
          if (ev.type?.includes('skill') || ev.payload?.skill) count++;
        }
      } catch {}
    }
    console.log(count);
  " 2>/dev/null || echo 0)
fi

if [ "$SKILL_EVENTS" -gt 0 ]; then
  echo "  [OK] $SKILL_EVENTS skill execution event(s)"
else
  echo "  [INFO] No skill execution events recorded (advisory)"
fi

echo "  PASSED"
