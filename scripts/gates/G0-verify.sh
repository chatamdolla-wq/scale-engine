#!/usr/bin/env bash
# G0: Build — structural integrity and build readiness
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "[G0] Build"
cd "$REPO_ROOT"

ERRORS=0

# Check 1: package.json structure
if [ ! -f package.json ]; then
  echo "  [BLOCK] package.json missing"
  ERRORS=$((ERRORS + 1))
else
  for field in name version type; do
    if ! node -e "const p=require('./package.json');process.exit(p['$field']?0:1)" 2>/dev/null; then
      echo "  [BLOCK] package.json missing '$field'"
      ERRORS=$((ERRORS + 1))
    fi
  done
  if node -e "const p=require('./package.json');process.exit(p.bin?0:1)" 2>/dev/null; then
    echo "  [OK] package.json has name/version/bin/type"
  else
    echo "  [WARN] package.json missing 'bin' field"
  fi
fi

# Check 2: tsconfig.json
if [ ! -f tsconfig.json ]; then
  echo "  [BLOCK] tsconfig.json missing"
  ERRORS=$((ERRORS + 1))
else
  if node -e "
    const fs = require('fs');
    const raw = fs.readFileSync('tsconfig.json', 'utf-8');
    const cleaned = raw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const t = JSON.parse(cleaned);
    process.exit(t.compilerOptions?.strict ? 0 : 1);
  " 2>/dev/null; then
    echo "  [OK] tsconfig.json has strict:true"
  else
    echo "  [BLOCK] tsconfig.json strict is not true"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 3: Key entry point
if [ ! -f src/api/cli.ts ]; then
  echo "  [BLOCK] src/api/cli.ts missing"
  ERRORS=$((ERRORS + 1))
else
  echo "  [OK] src/api/cli.ts exists"
fi

# Check 4: .scale/ directory (optional — skip if not present)
if [ -d .scale ]; then
  echo "  [OK] .scale/ directory exists"
else
  echo "  [INFO] .scale/ directory not present (acceptable for fresh checkout)"
fi

if [ "$ERRORS" -gt 0 ]; then
  echo "  [BLOCK] $ERRORS structural issue(s)"
  echo "  FAILED"
  exit 1
fi

echo "  PASSED"
