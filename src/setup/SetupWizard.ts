import { stdin as defaultInput, stdout as defaultOutput } from 'node:process'
import { createInterface, type Interface } from 'node:readline/promises'
import { resolve } from 'node:path'
import {
  bootstrapDependencies,
  type DependencyBootstrapOptions,
  type DependencyBootstrapReport,
} from '../bootstrap/DependencyBootstrap.js'
import type { ScaleLanguage } from '../i18n/Language.js'
import {
  useMemoryProvider,
  type MemoryProviderRoutingConfig,
  type MemoryProviderUseReport,
  type MemoryProviderWriteMode,
} from '../memory/MemoryProviders.js'

export interface SetupWizardOptions {
  projectDir?: string
  scaleDir?: string
  packIds?: string[]
  includeIds?: string[]
  apply?: boolean
  yes?: boolean
  interactive?: boolean
  lang?: ScaleLanguage
  memoryProvider?: string
  memoryMode?: MemoryProviderRoutingConfig['mode']
  memoryEndpoint?: string
  memoryWriteMode?: MemoryProviderWriteMode
  allowExternalWrite?: boolean
  input?: NodeJS.ReadableStream
  output?: NodeJS.WritableStream
  bootstrap?: (options: DependencyBootstrapOptions) => Promise<DependencyBootstrapReport>
  switchMemoryProvider?: typeof useMemoryProvider
}

export interface SetupWizardReport {
  ok: boolean
  lang: ScaleLanguage
  projectDir: string
  interactive: boolean
  requestedApply: boolean
  applied: boolean
  plan: DependencyBootstrapReport
  final: DependencyBootstrapReport
  memoryProviderSwitch?: MemoryProviderUseReport
  prompts: string[]
}

export async function runSetupWizard(options: SetupWizardOptions = {}): Promise<SetupWizardReport> {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const lang = options.lang ?? 'zh'
  const bootstrap = options.bootstrap ?? bootstrapDependencies
  const planOptions: DependencyBootstrapOptions = {
    projectDir,
    scaleDir: options.scaleDir,
    packIds: options.packIds,
    includeIds: options.includeIds,
    apply: false,
  }
  const plan = await bootstrap(planOptions)
  const prompts: string[] = []
  let shouldApply = Boolean(options.apply || options.yes)
  const interactive = Boolean(options.interactive)

  if (!shouldApply && interactive && plan.items.some(item => item.status === 'ready')) {
    const question = lang === 'zh'
      ? '是否现在安装所有可安装依赖？输入 y 确认，直接回车跳过: '
      : 'Install all ready dependencies now? Type y to confirm, press Enter to skip: '
    prompts.push(question.trim())
    shouldApply = await askYesNo(question, options.input ?? defaultInput, options.output ?? defaultOutput)
  }

  const final = shouldApply
    ? await bootstrap({ ...planOptions, apply: true })
    : plan
  const memoryProviderSwitch = options.memoryProvider
    ? (options.switchMemoryProvider ?? useMemoryProvider)({
      projectDir,
      scaleDir: options.scaleDir,
      provider: options.memoryProvider,
      mode: options.memoryMode,
      endpoint: options.memoryEndpoint,
      writeMode: options.memoryWriteMode,
      allowExternalWrite: options.allowExternalWrite,
    })
    : undefined

  return {
    ok: final.ok && (memoryProviderSwitch?.ok ?? true),
    lang,
    projectDir,
    interactive,
    requestedApply: Boolean(options.apply || options.yes),
    applied: shouldApply,
    plan,
    final,
    memoryProviderSwitch,
    prompts,
  }
}

async function askYesNo(
  question: string,
  input: NodeJS.ReadableStream,
  output: NodeJS.WritableStream,
): Promise<boolean> {
  let rl: Interface | undefined
  try {
    rl = createInterface({ input, output })
    const answer = (await rl.question(question)).trim().toLowerCase()
    return answer === 'y' || answer === 'yes' || answer === '是' || answer === '确认'
  } finally {
    rl?.close()
  }
}
