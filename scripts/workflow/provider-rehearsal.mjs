#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const options = parseArgs(process.argv.slice(2))
const runId = `provider-rehearsal-${Date.now()}-${Math.random().toString(16).slice(2)}`
const workRoot = options.outDir ? resolve(options.outDir) : join(tmpdir(), runId)
const results = []
const RTK_BYPASS_COMMANDS = new Set(['gbrain'])

mkdirSync(workRoot, { recursive: true })

try {
  const gbrain = options.skipGbrain ? skipped('gbrain') : runGbrainReplay()
  const graphify = options.skipGraphify ? skipped('graphify') : runGraphifyRehearsal()
  const report = buildReport([gbrain, graphify])
  if (options.writeReport || options.reportFile) writeReport(report)
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  if (!report.ok) process.exitCode = 1
} finally {
  if (!options.keepOutput && !options.outDir) rmSync(workRoot, { recursive: true, force: true })
}

function runGbrainReplay() {
  const healthCheck = runCommand('gbrain-health', 'gbrain', ['list', '-n', '1'], { timeoutMs: 60_000 })
  const health = evaluateGbrainList(healthCheck)
  if (!health.available) {
    return capability('gbrain', options.requireGbrain ? 'failed' : 'blocked', {
      reason: health.reason || failureLine(`${healthCheck.stdout}\n${healthCheck.stderr}`) || 'gbrain health check failed',
      required: options.requireGbrain,
      health,
      commands: [healthCheck],
      nextCommands: [
        'gbrain init --pglite --no-embedding',
        'gbrain init --supabase',
        'gbrain init --url <remote-gbrain-url>',
        'gbrain list -n 1',
        'gbrain doctor --json',
        'npm run smoke:gbrain',
      ],
    })
  }

  const slug = `scale-rehearsal-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const sentinel = `scale-engine-gbrain-replay-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const body = `# ${slug}. Sentinel: ${sentinel}. This page verifies that SCALE can write memory in one process and read/query it in later processes.`

  const put = runCommand('gbrain-put', 'gbrain', ['put', slug, '--content', body], { timeoutMs: 60_000 })
  const get = runCommand('gbrain-get', 'gbrain', ['get', slug], { timeoutMs: 8_000 })
  const query = runCommand('gbrain-query', 'gbrain', ['query', sentinel], { timeoutMs: 8_000 })
  const queryOutput = `${query.stdout}\n${query.stderr}`
  const search = query.exitCode === 0 && (queryOutput.includes(sentinel) || queryOutput.includes(slug))
    ? undefined
    : runCommand('gbrain-search', 'gbrain', ['search', sentinel], { timeoutMs: 8_000 })
  const cleanup = options.keepGbrainPage ? undefined : runCommand('gbrain-delete', 'gbrain', ['delete', slug], { timeoutMs: 60_000 })

  const recallOutput = `${queryOutput}\n${search?.stdout ?? ''}\n${search?.stderr ?? ''}`
  const getPassed = (get.exitCode === 0 || get.timedOut) && get.stdout.includes(sentinel)
  const recallPassed = (query.exitCode === 0 || query.timedOut || search?.exitCode === 0 || search?.timedOut)
    && (recallOutput.includes(sentinel) || recallOutput.includes(slug))
  const replayPassed = put.exitCode === 0
    && getPassed
    && recallPassed

  return capability('gbrain', replayPassed ? 'passed' : 'failed', {
    reason: replayPassed
      ? 'gbrain write/get/query replay passed across separate CLI processes'
      : 'gbrain was configured, but write/get/query replay did not prove recall',
    required: options.requireGbrain,
    health,
    sentinel,
    slug,
    commands: [healthCheck, put, get, query, search, cleanup].filter(Boolean),
    nextCommands: replayPassed ? [] : ['gbrain doctor --json', `gbrain get ${slug}`, `gbrain query ${sentinel}`],
  })
}

function evaluateGbrainList(command) {
  const output = `${command.stdout}\n${command.stderr}`
  if (/no brain configured/i.test(output)) {
    return { available: false, degraded: false, reason: 'gbrain CLI is installed but no brain is configured' }
  }
  return {
    available: command.exitCode === 0,
    degraded: false,
    reason: command.exitCode === 0 ? 'gbrain list passed; brain is reachable' : failureLine(output),
  }
}

function runGraphifyRehearsal() {
  const help = runCommand('graphify-help', 'graphify', ['--help'], { timeoutMs: 30_000 })
  if (help.exitCode !== 0) {
    return capability('graphify', options.requireGraphify ? 'failed' : 'blocked', {
      reason: failureLine(`${help.stdout}\n${help.stderr}`) || 'graphify CLI is not available',
      required: options.requireGraphify,
      commands: [help],
      nextCommands: [
        'uv tool install graphify',
        'graphify install --platform codex',
        'npm run smoke:graphify',
      ],
    })
  }

  const projectPath = resolve(options.largeProject)
  const graphOut = options.semanticExtract ? resolve(workRoot, 'graphify-out') : join(projectPath, 'graphify-out')
  if (options.semanticExtract) mkdirSync(graphOut, { recursive: true })
  const extractCommand = options.semanticExtract ? 'extract' : 'update'
  const extractArgs = options.semanticExtract
    ? ['extract', projectPath, '--out', graphOut]
    : ['update', projectPath]
  if (!options.semanticExtract) removeGeneratedGraphJson(graphOut)
  if (options.semanticExtract && options.graphifyBackend) extractArgs.push('--backend', options.graphifyBackend)
  if (options.noCluster) extractArgs.push('--no-cluster')
  if (options.semanticExtract && options.globalExtract) extractArgs.push('--global')

  const extract = runCommand(`graphify-${extractCommand}`, 'graphify', extractArgs, {
    timeoutMs: options.timeoutMs,
    env: graphifyNoModelEnv(),
  })
  if (extract.exitCode !== 0) {
    return capability('graphify', options.requireGraphify ? 'failed' : 'blocked', {
      reason: failureLine(`${extract.stdout}\n${extract.stderr}`) || `graphify ${extractCommand} failed`,
      required: options.requireGraphify,
      commands: [help, extract],
      nextCommands: [
        'graphify install --platform codex',
        'graphify hook status',
        `graphify update ${quoteArg(projectPath)} --no-cluster`,
        'Use --semantic-extract only when semantic LLM extraction is explicitly allowed.',
      ],
    })
  }

  const graphPath = findGraphJson(graphOut)
  if (!graphPath) {
    return capability('graphify', options.requireGraphify ? 'failed' : 'blocked', {
      reason: `graphify ${extractCommand} completed but graph.json was not found under ${graphOut}`,
      required: options.requireGraphify,
      commands: [help, extract],
      nextCommands: [`Get-ChildItem -Recurse ${quoteArg(graphOut)}`],
    })
  }

  const stats = parseGraphStats(graphPath)
  const query = runCommand('graphify-query', 'graphify', [
    'query',
    options.graphifyQuestion,
    '--graph',
    graphPath,
  ], { timeoutMs: 120_000, env: graphifyNoModelEnv() })
  const benchmark = runCommand('graphify-benchmark', 'graphify', ['benchmark', graphPath], {
    timeoutMs: 120_000,
    env: graphifyNoModelEnv(),
  })
  const globalAdd = options.globalAdd
    ? runCommand('graphify-global-add', 'graphify', ['global', 'add', graphPath, '--as', options.globalTag], {
        timeoutMs: 120_000,
        env: graphifyNoModelEnv(),
      })
    : undefined

  const passed = stats.ok && query.exitCode === 0
  return capability('graphify', passed ? 'passed' : options.requireGraphify ? 'failed' : 'blocked', {
    reason: passed
      ? `graphify ${extractCommand} built a real project graph and answered a graph query`
      : 'graphify generated an artifact but graph stats or query validation failed',
    required: options.requireGraphify,
    project: projectPath,
    mode: options.semanticExtract ? 'semantic-extract' : 'ast-update-no-llm',
    graphPath,
    stats,
    commands: [help, extract, query, benchmark, globalAdd].filter(Boolean),
    nextCommands: passed ? [] : [`graphify query ${quoteArg(options.graphifyQuestion)} --graph ${quoteArg(graphPath)}`],
  })
}

function parseGraphStats(graphPath) {
  try {
    const graph = JSON.parse(readFileSync(graphPath, 'utf8'))
    const nodes = firstArray(graph.nodes, graph.graph?.nodes, graph.data?.nodes)
    const edges = firstArray(graph.edges, graph.links, graph.graph?.edges, graph.graph?.links, graph.data?.edges, graph.data?.links)
    return {
      ok: nodes.length > 0,
      nodes: nodes.length,
      edges: edges.length,
    }
  } catch (error) {
    return {
      ok: false,
      nodes: 0,
      edges: 0,
      error: String(error.message ?? error),
    }
  }
}

function firstArray(...values) {
  return values.find(Array.isArray) ?? []
}

function findGraphJson(root) {
  const direct = [
    join(root, 'graph.json'),
    join(root, 'graphify-out', 'graph.json'),
    join(root, 'graph', 'graph.json'),
  ].find(candidate => existsSync(candidate))
  if (direct) return direct

  const scan = runCommand('find-graph-json', process.platform === 'win32' ? 'powershell' : 'find', process.platform === 'win32'
    ? ['-NoProfile', '-Command', `Get-ChildItem -Path ${quoteArg(root)} -Recurse -Filter graph.json | Select-Object -First 1 -ExpandProperty FullName`]
    : [root, '-name', 'graph.json', '-print', '-quit'], { timeoutMs: 30_000, wrapRtk: false })
  const found = scan.stdout.trim().split(/\r?\n/).find(Boolean)
  return found && existsSync(found) ? found : null
}

function skipped(id) {
  return capability(id, 'skipped', { reason: `${id} rehearsal was skipped`, required: false, commands: [], nextCommands: [] })
}

function capability(id, status, details) {
  return {
    id,
    status,
    required: Boolean(details.required),
    reason: details.reason,
    nextCommands: details.nextCommands ?? [],
    ...Object.fromEntries(Object.entries(details).filter(([key]) => !['required', 'reason', 'nextCommands'].includes(key))),
  }
}

function buildReport(capabilities) {
  const failedRequired = capabilities.filter(item => item.required && item.status !== 'passed' && item.status !== 'skipped')
  return {
    version: 1,
    ok: failedRequired.length === 0,
    status: failedRequired.length === 0 ? 'completed' : 'failed',
    runId,
    generatedAt: new Date().toISOString(),
    repoRoot,
    workRoot,
    rtkWrapped: options.useRtk && commandExists('rtk'),
    capabilities,
    results,
  }
}

function writeReport(report) {
  const target = options.reportFile
    ? resolve(options.reportFile)
    : join(repoRoot, '.scale', 'reports', `${runId}.json`)
  mkdirSync(dirname(target), { recursive: true })
  report.reportFile = target
  writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}

function runCommand(name, command, args, opts = {}) {
  const invocation = opts.wrapRtk === false
    ? { command, args, wrapped: false }
    : wrapWithRtk(command, args)
  const startedAt = new Date().toISOString()
  const commandLine = formatCommand(invocation.command, invocation.args)
  if (options.verbose) process.stderr.write(`[RUN] ${commandLine}\n`)
  const result = spawnStructured(invocation.command, invocation.args, {
    cwd: repoRoot,
    env: opts.env ?? process.env,
    input: opts.input,
    encoding: 'utf8',
    timeout: opts.timeoutMs ?? options.timeoutMs,
    maxBuffer: 80 * 1024 * 1024,
  })
  const stdout = String(result.stdout ?? '')
  const stderr = String(result.stderr ?? '') + (result.error ? `\n${result.error.message}` : '')
  const exitCode = typeof result.status === 'number' ? result.status : 1
  const timedOut = /ETIMEDOUT/i.test(String(result.error?.message ?? ''))
  const entry = {
    name,
    command: commandLine,
    wrappedByRtk: invocation.wrapped,
    exitCode,
    timedOut,
    startedAt,
    endedAt: new Date().toISOString(),
    stdoutTail: tail(stdout),
    stderrTail: tail(stderr),
  }
  results.push(entry)
  return { ...entry, stdout, stderr }
}

function graphifyNoModelEnv() {
  const env = { ...process.env }
  for (const key of [
    'GEMINI_API_KEY',
    'GOOGLE_API_KEY',
    'MOONSHOT_API_KEY',
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'DEEPSEEK_API_KEY',
    'KIMI_API_KEY',
  ]) {
    delete env[key]
  }
  return env
}

function removeGeneratedGraphJson(graphOut) {
  const outputDir = resolve(graphOut)
  if (outputDir.split(/[\\/]/).at(-1) !== 'graphify-out') {
    throw new Error(`Refusing to clean graphify output outside a graphify-out directory: ${outputDir}`)
  }
  rmSync(join(outputDir, 'graph.json'), { force: true })
}

function wrapWithRtk(command, args) {
  if (RTK_BYPASS_COMMANDS.has(command)) return { command, args, wrapped: false }
  if (!options.useRtk || command === 'rtk' || !commandExists('rtk')) return { command, args, wrapped: false }
  return { command: 'rtk', args: [command, ...args], wrapped: true }
}

function spawnStructured(command, args, options) {
  const direct = resolveDirectWindowsInvocation(command, args)
  if (direct) {
    return spawnSync(direct.command, direct.args, {
      ...options,
      shell: false,
      windowsHide: true,
    })
  }
  const resolved = resolveWindowsCommandShim(resolveCommandPath(command) ?? command)
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(resolved)) {
    const commandLine = ['&', powershellQuote(resolved), ...args.map(powershellQuote)].join(' ')
    return spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', commandLine], {
      ...options,
      shell: false,
      windowsHide: true,
    })
  }
  return spawnSync(resolved, args, {
    ...options,
    shell: false,
    windowsHide: true,
  })
}

function resolveDirectWindowsInvocation(command, args) {
  if (process.platform !== 'win32' || command !== 'gbrain') return null
  const gbrainShim = resolveCommandPath('gbrain')
  if (!gbrainShim || !/\.cmd$/i.test(gbrainShim) || !existsSync(gbrainShim)) return null
  try {
    const content = readFileSync(gbrainShim, 'utf8')
    const cliPath = content.match(/"([^"]*gbrain[^"]*src[\\/]cli\.ts)"/i)?.[1]
    const bunShim = resolveCommandPath('bun')
    const bunExe = bunShim ? join(dirname(bunShim), 'node_modules', 'bun', 'bin', 'bun.exe') : ''
    if (cliPath && bunExe && existsSync(bunExe)) {
      return { command: bunExe, args: [cliPath, ...args] }
    }
  } catch {
    return null
  }
  return null
}

function resolveWindowsCommandShim(command) {
  if (process.platform !== 'win32') return command
  if (!/[\\/]/.test(command) || extname(command)) return command
  for (const extension of ['.cmd', '.exe', '.bat', '.com']) {
    const candidate = `${command}${extension}`
    if (existsSync(candidate)) return candidate
  }
  return command
}

function resolveCommandPath(command) {
  if (/[\\/]/.test(command)) return command
  const lookup = process.platform === 'win32' ? 'where.exe' : 'which'
  const result = spawnSync(lookup, [command], {
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  })
  if (result.status !== 0) return null
  return String(result.stdout ?? '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean) ?? null
}

function commandExists(command) {
  return Boolean(resolveCommandPath(command))
}

function parseArgs(args) {
  const parsed = {
    skipGbrain: false,
    skipGraphify: false,
    requireGbrain: false,
    requireGraphify: false,
    keepOutput: false,
    keepGbrainPage: false,
    verbose: false,
    useRtk: true,
    noCluster: true,
    semanticExtract: false,
    globalExtract: false,
    globalAdd: false,
    globalTag: 'scale-engine-rehearsal',
    largeProject: repoRoot,
    outDir: undefined,
    reportFile: undefined,
    writeReport: false,
    graphifyBackend: undefined,
    graphifyQuestion: 'Where are SCALE setup, memory provider, and graphify knowledge integration implemented?',
    timeoutMs: 900_000,
  }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--skip-gbrain') parsed.skipGbrain = true
    else if (arg === '--skip-graphify') parsed.skipGraphify = true
    else if (arg === '--require-gbrain') parsed.requireGbrain = true
    else if (arg === '--require-graphify') parsed.requireGraphify = true
    else if (arg === '--keep-output') parsed.keepOutput = true
    else if (arg === '--keep-gbrain-page') parsed.keepGbrainPage = true
    else if (arg === '--verbose') parsed.verbose = true
    else if (arg === '--no-rtk') parsed.useRtk = false
    else if (arg === '--cluster') parsed.noCluster = false
    else if (arg === '--semantic-extract') parsed.semanticExtract = true
    else if (arg === '--global') parsed.globalExtract = true
    else if (arg === '--global-add') parsed.globalAdd = true
    else if (arg === '--global-tag') parsed.globalTag = requireValue(args, ++index, arg)
    else if (arg === '--large-project') parsed.largeProject = requireValue(args, ++index, arg)
    else if (arg === '--out') parsed.outDir = requireValue(args, ++index, arg)
    else if (arg === '--report-file') parsed.reportFile = requireValue(args, ++index, arg)
    else if (arg === '--write-report') parsed.writeReport = true
    else if (arg === '--graphify-backend') parsed.graphifyBackend = requireValue(args, ++index, arg)
    else if (arg === '--graphify-question') parsed.graphifyQuestion = requireValue(args, ++index, arg)
    else if (arg === '--timeout-ms') parsed.timeoutMs = Number.parseInt(requireValue(args, ++index, arg), 10)
    else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  if (!Number.isFinite(parsed.timeoutMs) || parsed.timeoutMs <= 0) parsed.timeoutMs = 900_000
  return parsed
}

function requireValue(args, index, flag) {
  const value = args[index]
  if (!value) throw new Error(`${flag} requires a value`)
  return value
}

function printHelp() {
  process.stdout.write(`Usage: node scripts/workflow/provider-rehearsal.mjs [options]

Runs real provider checks for:
  - gbrain cross-process write/get/query replay
  - graphify real-project extraction and graph query

Default mode records blocked capabilities without failing unless --require-gbrain or --require-graphify is set.

Options:
  --require-gbrain       Fail when gbrain is missing, unconfigured, or replay fails
  --require-graphify     Fail when graphify is missing or graph extraction/query fails
  --skip-gbrain          Skip gbrain replay
  --skip-graphify        Skip graphify rehearsal
  --large-project PATH   Project to extract with graphify, default current repo
  --out PATH             Output directory for temporary graphify artifacts
  --keep-output          Keep temporary output when --out is not supplied
  --keep-gbrain-page     Do not delete the temporary gbrain page
  --semantic-extract     Use graphify extract, which may call an LLM; default is graphify update with no LLM
  --graphify-backend ID  Pass --backend to graphify extract only with --semantic-extract
  --graphify-question Q  Query to ask graphify after graph generation
  --global               Pass --global to graphify extract only with --semantic-extract
  --global-add           Add generated graph to graphify global store
  --global-tag TAG       Tag for --global-add, default scale-engine-rehearsal
  --write-report         Write JSON report to .scale/reports
  --report-file PATH     Write JSON report to the supplied path
  --timeout-ms N         Command timeout, default 900000
  --no-rtk               Do not wrap provider CLIs through rtk
  --verbose              Print command lines to stderr
`)
}

function failureLine(value) {
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  return lines.find(line => /^error[:\s]/i.test(line))
    ?? lines.find(line => !/^warning[:\s]/i.test(line))
    ?? lines[0]
    ?? ''
}

function formatCommand(command, args) {
  return [command, ...args].map(quoteArg).join(' ')
}

function quoteArg(value) {
  const raw = String(value)
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(raw)) return raw
  return `"${raw.replace(/(["\\$`])/g, '\\$1')}"`
}

function powershellQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function tail(value, max = 4000) {
  return value.length > max ? value.slice(-max) : value
}
