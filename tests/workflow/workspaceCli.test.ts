import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execa } from 'execa'

let dirs: string[] = []

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

function makeDir(prefix = 'scale-workspace-cli-'): string {
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

async function runScale(args: string[], projectDir: string) {
  return execa('node', ['--import', 'tsx', 'src/api/cli.ts', ...args], {
    env: {
      ...process.env,
      SCALE_DIR: join(projectDir, '.scale-test'),
      SCALE_PROJECT_DIR: projectDir,
      SCALE_LOG_LEVEL: undefined,
    },
    reject: false,
  })
}

describe('workspace CLI', () => {
  it('reports child repository blockers as JSON', async () => {
    const root = makeDir()
    await initRepo(root)
    const child = join(root, 'services', 'resource')
    mkdirSync(child, { recursive: true })
    await initRepo(child)
    writeFileSync(join(root, '.gitmodules'), '[submodule "services/resource"]\n\tpath = services/resource\n\turl = ./services/resource\n', 'utf-8')
    await git(root, ['add', '.gitmodules'])
    await git(root, ['commit', '-m', 'add child repo metadata'])
    writeFileSync(join(child, 'dirty.txt'), 'dirty\n', 'utf-8')

    const status = await runScale(['workspace', 'status', '--dir', root, '--json'], root)

    expect(status.exitCode).toBe(1)
    const json = JSON.parse(status.stdout) as {
      finish: { canCleanup: boolean; blockers: string[] }
      childRepositories: Array<{ relativePath: string; clean: boolean }>
    }
    expect(json.childRepositories).toEqual(expect.arrayContaining([
      expect.objectContaining({ relativePath: 'services/resource', clean: false }),
    ]))
    expect(json.finish.canCleanup).toBe(false)
    expect(json.finish.blockers).toContain('Child repository services/resource has uncommitted changes')
  })

  it('prints resolved workspace topology as JSON', async () => {
    const root = makeDir()
    await initRepo(root)
    mkdirSync(join(root, '.scale'), { recursive: true })
    writeFileSync(join(root, '.scale', 'workspace.json'), JSON.stringify({
      version: 1,
      topology: 'moe',
      repositories: [
        { name: 'root', path: '.', role: 'root', required: true },
        { name: 'common', path: 'packages/common', role: 'nested-repo', required: true },
      ],
    }, null, 2), 'utf-8')

    const status = await runScale(['workspace', 'map', '--dir', root, '--json'], root)

    expect(status.exitCode).toBe(0)
    const json = JSON.parse(status.stdout) as {
      configured: boolean
      topology: string
      repositories: Array<{ name: string; path: string }>
    }
    expect(json.configured).toBe(true)
    expect(json.topology).toBe('moe')
    expect(json.repositories.map(repo => repo.name)).toEqual(['root', 'common'])
  })

  it('writes a starter MOE workspace topology from the CLI', async () => {
    const root = makeDir()
    await initRepo(root)

    const result = await runScale(['workspace', 'map', '--dir', root, '--write', '--topology', 'moe', '--json'], root)

    expect(result.exitCode).toBe(0)
    const json = JSON.parse(result.stdout) as { written: string | null; topology: string }
    expect(json.topology).toBe('moe')
    expect(json.written).toBe(join(root, '.scale', 'workspace.json'))
    expect(JSON.parse(readFileSync(join(root, '.scale', 'workspace.json'), 'utf-8'))).toMatchObject({
      topology: 'moe',
      finishPolicy: {
        requireCleanRepositories: true,
        requirePushedBranches: true,
        requireRootPointerUpdate: true,
      },
    })
  })

  it('dry-runs linked worktree cleanup as JSON', async () => {
    const root = makeDir()
    await initRepo(root)
    writeFileSync(join(root, '.gitignore'), '.worktrees/\n', 'utf-8')
    await git(root, ['add', '.gitignore'])
    await git(root, ['commit', '-m', 'ignore worktrees'])
    const worktree = join(root, '.worktrees', 'agent-task')
    await git(root, ['worktree', 'add', worktree, '-b', 'claude/workspace-cli-cleanup-0515'])

    const cleanup = await runScale(['workspace', 'cleanup', '--dir', worktree, '--dry-run', '--json'], root)

    expect(cleanup.exitCode).toBe(0)
    const json = JSON.parse(cleanup.stdout) as {
      mode: string
      canApply: boolean
      applied: boolean
      confirmationToken: string | null
    }
    expect(json.mode).toBe('dry-run')
    expect(json.canApply).toBe(true)
    expect(json.applied).toBe(false)
    expect(json.confirmationToken).toBe('claude/workspace-cli-cleanup-0515')
    expect(existsSync(worktree)).toBe(true)
  })

  it('applies linked worktree cleanup only with the reported confirmation token', async () => {
    const root = makeDir()
    await initRepo(root)
    writeFileSync(join(root, '.gitignore'), '.worktrees/\n', 'utf-8')
    await git(root, ['add', '.gitignore'])
    await git(root, ['commit', '-m', 'ignore worktrees'])
    const worktree = join(root, '.worktrees', 'agent-task-apply')
    await git(root, ['worktree', 'add', worktree, '-b', 'claude/workspace-cli-apply-0515'])

    const rejected = await runScale(
      ['workspace', 'cleanup', '--dir', worktree, '--apply', '--confirm', 'wrong-token', '--json'],
      root,
    )

    expect(rejected.exitCode).toBe(1)
    const rejectedJson = JSON.parse(rejected.stdout) as { applied: boolean; blockers: string[] }
    expect(rejectedJson.applied).toBe(false)
    expect(rejectedJson.blockers.join('\n')).toContain('confirmation token')
    expect(existsSync(worktree)).toBe(true)

    const applied = await runScale(
      ['workspace', 'cleanup', '--dir', worktree, '--apply', '--confirm', 'claude/workspace-cli-apply-0515', '--json'],
      root,
    )

    expect(applied.exitCode).toBe(0)
    const appliedJson = JSON.parse(applied.stdout) as { applied: boolean; canApply: boolean }
    expect(appliedJson.applied).toBe(true)
    expect(appliedJson.canApply).toBe(true)
    expect(existsSync(worktree)).toBe(false)
  })
})
