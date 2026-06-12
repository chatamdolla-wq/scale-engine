// SCALE Engine - P0+ Boundary & Constraint enforcement (advisory)
//
// Two soft checks layered on top of the P0 six-element Spec contract:
//
//  1. Boundary enforcement — compares the files a task actually changed against
//     the Spec's executional `boundaries` (allowed `files` globs + explicitly
//     `forbidden` globs). Touching a forbidden path, or editing a file outside
//     the declared allow-list, is reported as a violation.
//
//  2. Constraint coverage — checks each declared `constraint` (an invariant that
//     must not regress) against the Spec's `verificationSurface`. A constraint
//     with no surface guarding it is a silent-regression risk.
//
// Both are advisory in P0+: violations are surfaced as warnings and recorded as
// evidence, but never flip `passed` or block ship. A profile-gated hard block
// (like G23's E1 escalation) is deferred to a follow-up.

import type { SpecBoundaries } from '../artifact/types.js'

export type BoundaryViolationKind = 'forbidden-touched' | 'outside-allowed'

export interface BoundaryViolation {
  /** Repo-relative path of the offending changed file. */
  file: string
  kind: BoundaryViolationKind
  /** For `forbidden-touched`: the forbidden glob that matched. */
  matchedGlob?: string
}

export interface BoundaryEnforcementReport {
  declaredAllowed: number
  declaredForbidden: number
  changedFiles: number
  violations: BoundaryViolation[]
  /** Always true in P0+: this report never blocks. */
  advisory: boolean
}

export interface ConstraintCoverageReport {
  declared: number
  covered: number
  /** Constraints with no verificationSurface token overlap. */
  uncovered: string[]
  advisory: boolean
}

function norm(value: string): string {
  return value.replace(/\\/g, '/').trim().toLowerCase()
}

/**
 * Translate a minimatch-style glob to an anchored, full-path RegExp.
 * `**` matches across `/`, `*` matches within a segment, `?` matches one
 * non-`/` char. All other regex metacharacters are escaped.
 */
function globToRegExp(glob: string): RegExp {
  const body = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape specials, leaving * and ?
    .replace(/\*\*/g, '\u0000') // globstar placeholder
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*')
    .replace(/\?/g, '[^/]')
  return new RegExp(`^${body}$`)
}

/**
 * Does a (normalised) changed-file path match a boundary glob?
 * Supports exact paths, bare directory prefixes (`src` ⇒ `src/**`) and globs.
 */
export function pathMatchesGlob(file: string, glob: string): boolean {
  const f = norm(file)
  const g = norm(glob)
  if (!f || !g) return false
  if (f === g) return true
  // Bare directory (no wildcards) acts as a recursive prefix.
  if (!/[*?]/.test(g)) {
    const dir = g.endsWith('/') ? g : `${g}/`
    if (f.startsWith(dir)) return true
  }
  try {
    return globToRegExp(g).test(f)
  } catch {
    return false
  }
}

/**
 * Compare the changed-file set against a Spec's executional boundaries.
 * Returns `undefined` when there is nothing to enforce (no boundaries, or
 * neither `files` nor `forbidden` declared).
 */
export function evaluateBoundaries(
  changedFiles: Array<string | undefined | null> | undefined,
  boundaries: SpecBoundaries | undefined,
): BoundaryEnforcementReport | undefined {
  if (!boundaries) return undefined
  const allowed = (boundaries.files ?? []).map(norm).filter(Boolean)
  const forbidden = (boundaries.forbidden ?? []).map(norm).filter(Boolean)
  if (allowed.length === 0 && forbidden.length === 0) return undefined

  const files = [...new Set((changedFiles ?? []).map(f => norm(f ?? '')).filter(Boolean))]
  const violations: BoundaryViolation[] = []
  for (const file of files) {
    const hitForbidden = forbidden.find(glob => pathMatchesGlob(file, glob))
    if (hitForbidden) {
      violations.push({ file, kind: 'forbidden-touched', matchedGlob: hitForbidden })
      continue
    }
    if (allowed.length > 0 && !allowed.some(glob => pathMatchesGlob(file, glob))) {
      violations.push({ file, kind: 'outside-allowed' })
    }
  }

  return {
    declaredAllowed: allowed.length,
    declaredForbidden: forbidden.length,
    changedFiles: files.length,
    violations,
    advisory: true,
  }
}

function significantTokens(value: string): string[] {
  return [
    ...new Set(
      norm(value)
        .split(/[^a-z0-9]+/)
        .filter(token => token.length >= 4),
    ),
  ]
}

/**
 * A constraint is "covered" when at least one of its significant tokens appears
 * in some verificationSurface item — i.e. there is a declared check that could
 * catch a regression of that invariant.
 */
function constraintCovered(constraint: string, surfaces: string[]): boolean {
  const tokens = significantTokens(constraint)
  if (tokens.length === 0) return false
  return surfaces.some(surface => tokens.some(token => surface.includes(token)))
}

/**
 * Check that every declared constraint is guarded by some verificationSurface
 * item. Returns `undefined` when no constraints are declared.
 */
export function evaluateConstraints(
  constraints: string[] | undefined,
  verificationSurface: string[] | undefined,
): ConstraintCoverageReport | undefined {
  const declared = (constraints ?? []).map(c => c.trim()).filter(Boolean)
  if (declared.length === 0) return undefined
  const surfaces = (verificationSurface ?? []).map(norm).filter(Boolean)
  const uncovered = declared.filter(constraint => !constraintCovered(constraint, surfaces))
  return {
    declared: declared.length,
    covered: declared.length - uncovered.length,
    uncovered,
    advisory: true,
  }
}

/** Render boundary warning lines (empty when there is nothing to warn about). */
export function formatBoundaryWarnings(report: BoundaryEnforcementReport | undefined): string[] {
  if (!report || report.violations.length === 0) return []
  const lines = [
    `[WARN] boundary enforcement: ${report.violations.length} violation(s) (advisory, not blocking)`,
  ]
  for (const v of report.violations) {
    lines.push(
      v.kind === 'forbidden-touched'
        ? `   [FORBIDDEN] ${v.file} (matched ${v.matchedGlob})`
        : `   [OUTSIDE-ALLOWED] ${v.file}`,
    )
  }
  lines.push('   Keep edits inside the Spec boundaries (or widen them in the Spec).')
  return lines
}

/** Render constraint-coverage warning lines (empty when fully covered). */
export function formatConstraintWarnings(report: ConstraintCoverageReport | undefined): string[] {
  if (!report || report.uncovered.length === 0) return []
  const lines = [
    `[WARN] constraint coverage: ${report.covered}/${report.declared} guarded by verificationSurface (advisory, not blocking)`,
  ]
  for (const constraint of report.uncovered) {
    lines.push(`   [UNGUARDED] ${constraint}`)
  }
  lines.push('   Add a verificationSurface item that would catch a regression of each constraint.')
  return lines
}
