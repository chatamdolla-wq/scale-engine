// SCALE Engine - Verification Surface Coverage (P0, Decision C1: soft tell)
//
// Maps a Spec's `verificationSurface` declarations against the evidence signals
// gathered during verify/ship. Unmapped surface items are reported as warnings
// (not blockers) in P0; a hard block is deferred to P1.

export interface SurfaceCoverageItem {
  surface: string
  mapped: boolean
  matchedBy?: string
}

export interface SurfaceCoverageReport {
  declared: number
  mapped: number
  unmapped: string[]
  items: SurfaceCoverageItem[]
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

// A surface item is considered "mapped" when it shares a meaningful substring
// with any evidence signal (a command that ran, an artifact/file path, or an
// explicit `verificationSurfaceRef`). Glob `*` segments are reduced to their
// literal prefix so patterns like `src/auth/**` still match `src/auth/oauth.ts`.
function surfaceMatchesSignal(surface: string, signal: string): boolean {
  const s = normalize(surface)
  const sig = normalize(signal)
  if (!s || !sig) return false

  const literal = s.split('*')[0].trim()
  const probe = literal.length >= 3 ? literal : s
  if (probe.length < 3) return false

  return sig.includes(probe) || s.includes(sig)
}

/**
 * Compute soft coverage of a Spec's verificationSurface against evidence signals.
 * Signals are free-form strings: executed commands, evidence artifact paths,
 * changed files, and explicit verificationSurfaceRef values.
 */
export function computeSurfaceCoverage(
  verificationSurface: string[] | undefined,
  signals: Array<string | undefined | null>,
): SurfaceCoverageReport {
  const surfaces = (verificationSurface ?? []).map(s => s.trim()).filter(Boolean)
  const cleanSignals = signals.filter((s): s is string => Boolean(s && s.trim()))

  const items: SurfaceCoverageItem[] = surfaces.map(surface => {
    const matchedBy = cleanSignals.find(signal => surfaceMatchesSignal(surface, signal))
    return matchedBy ? { surface, mapped: true, matchedBy } : { surface, mapped: false }
  })

  const unmapped = items.filter(item => !item.mapped).map(item => item.surface)
  return {
    declared: surfaces.length,
    mapped: items.length - unmapped.length,
    unmapped,
    items,
  }
}

/** Render the soft-coverage warning lines (empty array when nothing to warn about). */
export function formatSurfaceCoverageWarnings(report: SurfaceCoverageReport): string[] {
  if (report.declared === 0 || report.unmapped.length === 0) return []
  const lines = [
    `[WARN] verificationSurface coverage: ${report.mapped}/${report.declared} mapped by evidence (soft check, not blocking)`,
  ]
  for (const surface of report.unmapped) {
    lines.push(`   [UNMAPPED] ${surface}`)
  }
  lines.push('   Map evidence to these items (or refine the Spec) before relying on "done".')
  return lines
}
