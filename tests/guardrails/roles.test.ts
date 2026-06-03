// Tests: Role 定义 — 权限网关
import { describe, it, expect } from 'vitest'
import { ROLES, getRole, listRoles } from '../../src/guardrails/roles.js'

describe('roles', () => {
  describe('ROLES', () => {
    it('defines all 6 expected roles', () => {
      const names = Object.keys(ROLES)
      expect(names).toContain('Explorer')
      expect(names).toContain('SpecWriter')
      expect(names).toContain('Planner')
      expect(names).toContain('Implementer')
      expect(names).toContain('Verifier')
      expect(names).toContain('Releaser')
      expect(names).toHaveLength(6)
    })

    it('Explorer has read-only tools', () => {
      const explorer = ROLES.Explorer
      expect(explorer.allowedTools).toContain('Read')
      expect(explorer.allowedTools).toContain('Grep')
      expect(explorer.deniedTools).toContain('Edit')
      expect(explorer.deniedTools).toContain('Write')
      expect(explorer.deniedTools).toContain('Bash')
      expect(explorer.canCreateArtifacts).toEqual(['Insight'])
    })

    it('SpecWriter can create Spec only', () => {
      const spec = ROLES.SpecWriter
      expect(spec.canCreateArtifacts).toEqual(['Spec'])
      expect(spec.canModifyArtifacts).toEqual([{ type: 'Spec', statuses: ['DRAFT', 'REVIEWING'] }])
      expect(spec.requiresUpstream).toEqual([{ type: 'Need' }])
    })

    it('Planner requires FROZEN Spec', () => {
      const planner = ROLES.Planner
      expect(planner.requiresUpstream).toEqual([{ type: 'Spec', status: 'FROZEN' }])
      expect(planner.canCreateArtifacts).toContain('Plan')
      expect(planner.canCreateArtifacts).toContain('Task')
    })

    it('Implementer requires READY Task and has mustRunAfterEdit', () => {
      const impl = ROLES.Implementer
      expect(impl.requiresUpstream).toEqual([{ type: 'Task', status: 'READY' }])
      expect(impl.mustRunAfterEdit).toEqual(['lint', 'typecheck'])
      expect(impl.allowedTools).toContain('Edit')
      expect(impl.allowedTools).toContain('Write')
      expect(impl.allowedTools).toContain('Bash')
    })

    it('Verifier cannot Edit or Write', () => {
      const verifier = ROLES.Verifier
      expect(verifier.deniedTools).toContain('Edit')
      expect(verifier.deniedTools).toContain('Write')
      expect(verifier.canCreateArtifacts).toContain('Evidence')
      expect(verifier.canCreateArtifacts).toContain('Defect')
    })

    it('Releaser requires all Defects CLOSED and Evidence PASS', () => {
      const releaser = ROLES.Releaser
      expect(releaser.requiresUpstream).toEqual([
        { type: 'Defect', allMatch: 'CLOSED' },
        { type: 'Evidence', allMatch: 'PASS' },
      ])
      expect(releaser.canCreateArtifacts).toEqual(['Release'])
    })
  })

  describe('getRole', () => {
    it('returns role by name', () => {
      const role = getRole('Explorer')
      expect(role).toBeDefined()
      expect(role!.name).toBe('Explorer')
    })

    it('returns undefined for unknown role', () => {
      expect(getRole('NonExistent')).toBeUndefined()
    })

    it('returns all roles correctly', () => {
      for (const name of Object.keys(ROLES)) {
        const role = getRole(name)
        expect(role).toBeDefined()
        expect(role!.name).toBe(name)
      }
    })
  })

  describe('listRoles', () => {
    it('returns all role names', () => {
      const names = listRoles()
      expect(names).toHaveLength(6)
      expect(names).toContain('Explorer')
      expect(names).toContain('SpecWriter')
      expect(names).toContain('Planner')
      expect(names).toContain('Implementer')
      expect(names).toContain('Verifier')
      expect(names).toContain('Releaser')
    })
  })
})
