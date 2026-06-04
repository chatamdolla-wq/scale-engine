#!/usr/bin/env bash
# G21: Context Budget — advisory check on context token usage
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "[G21] Context Budget"
echo "  Checking context budget..."

cd "$REPO_ROOT"

SCALE_DIR="${SCALE_DIR:-.scale}"

if [ -f "$SCALE_DIR/context-budget.json" ]; then
  echo "  [OK] Context budget configured"
else
  echo "  [INFO] No context budget configuration (advisory)"
fi

OVER_BUDGET=false
if [ -f "$SCALE_DIR/context-budget-report.json" ]; then
  if command -v node &>/dev/null; then
    node -e "
      const r = JSON.parse(require('fs').readFileSync('$SCALE_DIR/context-budget-report.json','utf-8'));
      const total = r.summary?.totalTokens ?? 0;
      const max = r.thresholds?.maxAlwaysTokens ?? 10000;
      const ratio = max > 0 ? Math.round(total / max * 100) : 0;
      const over = total > max;
      console.log('  [' + (over ? 'BLOCK' : 'OK') + '] ' + total + ' tokens / ' + max + ' max (' + ratio + '%)');
      if (over) process.exit(2);
    " 2>/dev/null
    EXIT_CODE=$?
    if [ "$EXIT_CODE" -eq 2 ]; then
      OVER_BUDGET=true
    fi
  fi
else
  echo "  [INFO] No budget report"
fi

if [ "$OVER_BUDGET" = true ]; then
  echo "  FAILED"
  exit 1
fi

echo "  PASSED"
