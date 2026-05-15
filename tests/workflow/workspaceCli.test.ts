import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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
})
