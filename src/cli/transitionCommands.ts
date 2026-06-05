// SCALE Engine — Transition, Verify-Task, and Role Commands
import { defineCommand } from 'citty'
import { getEngine } from './engineBootstrap.js'

export const transitionCommand = defineCommand({
  meta: { name: 'transition', description: 'Transition artifact state' },
  args: {
    id: { type: 'positional', required: true },
    action: { type: 'positional', required: true },
    reason: { type: 'string' },
  },
  async run({ args }) {
    const { fsm } = getEngine()
    const result = await fsm.transition(args.id, args.action, {
      actor: { kind: 'human', userId: process.env.USER ?? 'cli' },
      reason: args.reason,
    })
    console.log(JSON.stringify(result, null, 2))
    if (!result.success) process.exit(1)
  },
})

export const verifyTaskCommand = defineCommand({
  meta: { name: 'verify-task', description: 'Verify task code quality (build/lint/test)' },
  args: {
    id: { type: 'positional', required: true },
    'build-cmd': { type: 'string', default: 'npm run build', description: 'Build command' },
    'lint-cmd': { type: 'string', default: 'npm run lint', description: 'Lint command' },
    'test-cmd': { type: 'string', default: 'npm test', description: 'Test command' },
    'skip-build': { type: 'boolean', default: false, description: 'Skip build check' },
    'skip-lint': { type: 'boolean', default: false, description: 'Skip lint check' },
    'skip-test': { type: 'boolean', default: false, description: 'Skip test check' },
    json: { type: 'boolean', default: false, description: 'Output as JSON' },
  },
  async run({ args }) {
    const { store, eventBus } = getEngine()
    const { runSafeCommand } = await import('../tools/SafeCommandRunner.js')
    const artifact = await store.get(args.id)
    if (!artifact || artifact.type !== 'Task') {
      console.error(`Task not found: ${args.id}`)
      process.exit(1)
    }

    const results = {
      buildStatus: 'pending' as 'pending' | 'success' | 'failed',
      buildExitCode: undefined as number | undefined,
      lintStatus: 'pending' as 'pending' | 'success' | 'failed',
      testPassed: undefined as boolean | undefined,
      testCoverage: undefined as number | undefined,
    }

    const runCmd = async (cmd: string): Promise<{ exitCode: number; output: string }> => {
      try {
        const result = await runSafeCommand(cmd)
        return { exitCode: result.exitCode, output: [result.stdout, result.stderr].filter(Boolean).join('\n') }
      } catch (error) {
        return { exitCode: 1, output: error instanceof Error ? error.message : String(error) }
      }
    }

    if (!args['skip-build']) {
      if (!args.json) console.log('\n🔨 Running build...')
      const build = await runCmd(args['build-cmd'])
      results.buildStatus = build.exitCode === 0 ? 'success' : 'failed'
      results.buildExitCode = build.exitCode
      if (!args.json) {
        if (build.exitCode === 0) {
          console.log('   ✅ Build passed')
        } else {
          console.log('   ❌ Build failed (exit code:', build.exitCode, ')')
          console.log('   Output:', build.output.slice(0, 500))
        }
      }
    }

    if (!args['skip-lint']) {
      if (!args.json) console.log('\n🔍 Running lint...')
      const lint = await runCmd(args['lint-cmd'])
      results.lintStatus = lint.exitCode === 0 ? 'success' : 'failed'
      if (!args.json) {
        if (lint.exitCode === 0) {
          console.log('   ✅ Lint passed')
        } else {
          console.log('   ❌ Lint failed (exit code:', lint.exitCode, ')')
          console.log('   Output:', lint.output.slice(0, 500))
        }
      }
    }

    if (!args['skip-test']) {
      if (!args.json) console.log('\n🧪 Running tests...')
      const test = await runCmd(args['test-cmd'])
      results.testPassed = test.exitCode === 0
      const coverageMatch = test.output.match(/All files[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|\s*(\d+\.?\d*)/)
      if (coverageMatch) results.testCoverage = parseFloat(coverageMatch[1])
      if (!args.json) {
        if (test.exitCode === 0) {
          console.log('   ✅ Tests passed')
          if (results.testCoverage) console.log('   Coverage:', results.testCoverage, '%')
        } else {
          console.log('   ❌ Tests failed (exit code:', test.exitCode, ')')
          console.log('   Output:', test.output.slice(0, 500))
        }
      }
    }

    const currentPayload = artifact.payload as Record<string, unknown>
    const updated = await store.update(args.id, {
      payload: { ...currentPayload, ...results },
    })

    eventBus.emit('artifact.updated', {
      artifactId: args.id,
      changes: { payload: results },
      reason: 'verify-task',
    }, { sessionId: 'cli' })

    if (args.json) {
      console.log(JSON.stringify({ taskId: args.id, results, artifact: updated }, null, 2))
    } else {
      console.log('\n📊 Verification results:')
      console.log('──────────────────────────────────────────────────')
      console.log(`  Build:  ${results.buildStatus === 'success' ? '✅' : results.buildStatus === 'failed' ? '❌' : '⏭️'} ${results.buildStatus}`)
      if (results.buildExitCode !== undefined) console.log(`          Exit code: ${results.buildExitCode}`)
      console.log(`  Lint:   ${results.lintStatus === 'success' ? '✅' : results.lintStatus === 'failed' ? '❌' : '⏭️'} ${results.lintStatus}`)
      console.log(`  Tests:  ${results.testPassed === true ? '✅' : results.testPassed === false ? '❌' : '⏭️'} ${results.testPassed === undefined ? 'skipped' : results.testPassed ? 'passed' : 'failed'}`)
      if (results.testCoverage !== undefined) console.log(`          Coverage: ${results.testCoverage}%`)
      console.log('──────────────────────────────────────────────────')

      const allPassed = (results.buildStatus === 'success' || args['skip-build'])
        && (results.lintStatus === 'success' || args['skip-lint'])
        && (results.testPassed === true || args['skip-test'])

      if (allPassed) {
        console.log('\n✅ All checks passed! Task can now be completed.')
        console.log(`\nNext: scale transition ${args.id} complete --reason "Verified"`)
      } else {
        console.log('\n❌ Some checks failed. Fix issues before completing task.')
        process.exit(1)
      }
    }
  },
})

export const roleActivateCommand = defineCommand({
  meta: { name: 'activate', description: 'Activate a role' },
  args: { role: { type: 'positional', required: true } },
  async run({ args }) {
    const { BUILT_IN_ROLES } = await import('../guardrails/advancedDetectors.js')
    const { roleGate, eventBus } = getEngine()
    const roleDef = BUILT_IN_ROLES[args.role]
    if (!roleDef) {
      console.error(`Unknown role: ${args.role}. Available: ${Object.keys(BUILT_IN_ROLES).join(', ')}`)
      process.exit(1)
    }
    roleGate.setRole(roleDef)
    eventBus.emit('role.activated', { roleId: args.role })
    console.log(JSON.stringify({ ok: true, role: roleDef }))
  },
})

export const roleShowCommand = defineCommand({
  meta: { name: 'show', description: 'Show current role' },
  args: {},
  async run() {
    const { roleGate } = getEngine()
    console.log(JSON.stringify(roleGate.getRole(), null, 2))
  },
})

export const roleCommand = defineCommand({
  meta: { name: 'role', description: 'Role management' },
  subCommands: { activate: roleActivateCommand, show: roleShowCommand },
})
