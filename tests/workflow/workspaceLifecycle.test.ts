import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execa } from 'execa'
import { inspectWorkspaceLifecycle } from '../../src/workflow/WorkspaceLifecycle.js'

let dirs: string[] = []

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

function makeDir(prefix = 'scale-workspace-'): string {
  const dir = mkdtempSync(join(process.cwd(), `.tmp-${prefix}`))
  dirs.push(dir)
  return dir
}

async function git(cwd: string, args: string[]) {
  return execa('git', args, { cwd })
}

async function initRepo(dir: string) {
  await git(dir, ['init'])
  await git(dir, ['config', 'user.email', 'scale@example.test'])
  await git(dir, ['config', 'user.name', 'SCALE Test'])
  writeFileSync(join(dir, 'README.md'), '# test\n', 'utf-8')
  await git(dir, ['add', 'README.md'])
  await git(dir, ['commit', '-m', 'init'])
}

describe('WorkspaceLifecycle', () => {
  it('blocks cleanup when a child repository has uncommitted changes even if the root is clean', async () => {
    const root = makeDir()
    await initRepo(root)
    const child = join(root, 'modules', 'common')
    mkdirSync(child, { recursive: true })
    await initRepo(child)
    writeFileSync(join(root, '.gitmodules'), '[submodule "modules/common"]\n\tpath = modules/common\n\turl = ./modules/common\n', 'utf-8')
    writeFileSync(join(root, '.gitignore'), 'modules/\n', 'utf-8')
    await git(root, ['add', '.gitmodules', '.gitignore'])
    await git(root, ['commit', '-m', 'add submodule metadata'])
    writeFileSync(join(child, 'dirty.txt'), 'dirty\n', 'utf-8')

    const result = await inspectWorkspaceLifecycle({ projectDir: root })

    expect(result.root.clean).toBe(true)
    expect(result.childRepositories).toHaveLength(1)
    expect(result.childRepositories[0]).toMatchObject({
      kind: 'submodule',
      relativePath: 'modules/common',
      clean: false,
    })
    expect(result.finish.canCleanup).toBe(false)
    expect(result.finish.blockers).toContain('Child repository modules/common has uncommitted changes')
  })

  it('identifies linked worktrees and marks clean temporary branches as cleanup candidates', async () => {
    const root = makeDir()
    await initRepo(root)
    writeFileSync(join(root, '.gitignore'), '.worktrees/\n', 'utf-8')
    await git(root, ['add', '.gitignore'])
    await git(root, ['commit', '-m', 'ignore worktrees'])
    const worktree = join(root, '.worktrees', 'claude-compassionate-cray-141861')
    await git(root, ['worktree', 'add', worktree, '-b', 'claude/compassionate-cray-141861'])

    const result = await inspectWorkspaceLifecycle({ projectDir: worktree })

    expect(result.root.branch).toBe('claude/compassionate-cray-141861')
    expect(result.root.isLinkedWorktree).toBe(true)
    expect(result.root.isSubmodule).toBe(false)
    expect(result.finish.canCleanup).toBe(true)
    expect(result.finish.nextActions).toContain('Safe to remove linked worktree after branch is pushed, merged, or intentionally discarded')
  })

  it('keeps porcelain leading spaces so unstaged changes are not counted as staged', async () => {
    const root = makeDir()
    await initRepo(root)
    writeFileSync(join(root, 'README.md'), '# changed\n', 'utf-8')

    const result = await inspectWorkspaceLifecycle({ projectDir: root })

    expect(result.root.clean).toBe(false)
    expect(result.root.staged).toBe(0)
    expect(result.root.unstaged).toBe(1)
  })
})
