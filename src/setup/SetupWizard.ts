import { stdin as defaultInput, stdout as defaultOutput } from 'node:process'
import { createInterface, type Interface } from 'node:readline'
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
  promptLanguage?: boolean
  input?: NodeJS.ReadableStream
  output?: NodeJS.WritableStream
  bootstrap?: (options: DependencyBootstrapOptions) => Promise<DependencyBootstrapReport>
  switchMemoryProvider?: typeof useMemoryProvider
}

export interface SetupWizardInteractiveChoices {
  lang?: ScaleLanguage
  memoryProvider?: string
  memoryMode?: MemoryProviderRoutingConfig['mode']
}

interface PromptSession {
  rl: Interface
  output: NodeJS.WritableStream
  iterator: AsyncIterator<string>
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
  interactiveChoices?: SetupWizardInteractiveChoices
}

export async function runSetupWizard(options: SetupWizardOptions = {}): Promise<SetupWizardReport> {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  let lang = options.lang ?? 'zh'
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
  const interactiveChoices: SetupWizardInteractiveChoices = {}
  let shouldApply = Boolean(options.apply || options.yes)
  const interactive = Boolean(options.interactive)
  let memoryProvider = options.memoryProvider
  let memoryMode = options.memoryMode

  let promptSession: PromptSession | undefined
  try {
    if (interactive) {
      promptSession = createPromptSession(options.input ?? defaultInput, options.output ?? defaultOutput)
    }

    if (promptSession && options.promptLanguage) {
      const question = languageQuestion(lang)
      prompts.push(question.trim())
      lang = normalizeLanguageChoice(await askLine(promptSession, question), lang)
      interactiveChoices.lang = lang
    }

    if (promptSession && !memoryProvider && shouldPromptMemoryProvider(plan)) {
      const question = memoryProviderQuestion(lang)
      prompts.push(question.trim())
      memoryProvider = normalizeMemoryProviderChoice(await askLine(promptSession, question))
      interactiveChoices.memoryProvider = memoryProvider
    }

    if (promptSession && memoryProvider && memoryProvider !== 'skip' && !memoryMode) {
      if (memoryProvider === 'scale-local') {
        memoryMode = 'local-only'
      } else {
        const question = memoryModeQuestion(lang)
        prompts.push(question.trim())
        memoryMode = normalizeMemoryModeChoice(await askLine(promptSession, question))
      }
      interactiveChoices.memoryMode = memoryMode
    }

    if (!shouldApply && promptSession && plan.items.some(item => item.status === 'ready')) {
      const question = lang === 'zh'
        ? '是否现在安装所有可安装依赖？输入 y 确认，直接回车跳过: '
        : 'Install all ready dependencies now? Type y to confirm, press Enter to skip: '
      prompts.push(question.trim())
      shouldApply = await askYesNo(promptSession, question)
    }
  } finally {
    promptSession?.rl.close()
  }

  const final = shouldApply
    ? await bootstrap({ ...planOptions, apply: true })
    : plan
  const memoryProviderSwitch = memoryProvider && memoryProvider !== 'skip'
    ? (options.switchMemoryProvider ?? useMemoryProvider)({
      projectDir,
      scaleDir: options.scaleDir,
      provider: memoryProvider,
      mode: memoryMode,
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
    interactiveChoices: Object.keys(interactiveChoices).length > 0 ? interactiveChoices : undefined,
  }
}

function shouldPromptMemoryProvider(plan: DependencyBootstrapReport): boolean {
  return plan.packIds.includes('memory') || plan.items.some(item => item.id === 'gbrain' || item.id === 'agentmemory' || item.id === 'scale-local')
}

function languageQuestion(lang: ScaleLanguage): string {
  return lang === 'zh'
    ? '选择安装语言 zh/en，默认 zh: '
    : 'Choose setup language zh/en, default en: '
}

function memoryProviderQuestion(lang: ScaleLanguage): string {
  return lang === 'zh'
    ? '选择记忆供应商 gbrain/scale-local/agentmemory/skip，默认 gbrain: '
    : 'Choose memory provider gbrain/scale-local/agentmemory/skip, default gbrain: '
}

function memoryModeQuestion(lang: ScaleLanguage): string {
  return lang === 'zh'
    ? '选择记忆路由模式 external-first/auto/local-only，默认 external-first: '
    : 'Choose memory routing mode external-first/auto/local-only, default external-first: '
}

function normalizeLanguageChoice(value: string, fallback: ScaleLanguage): ScaleLanguage {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'en' || normalized === 'english') return 'en'
  if (normalized === 'zh' || normalized === 'cn' || normalized === 'chinese' || normalized === '中文') return 'zh'
  return fallback
}

function normalizeMemoryProviderChoice(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (!normalized || normalized === '1') return 'gbrain'
  if (normalized === '2' || normalized === 'local' || normalized === 'scale') return 'scale-local'
  if (normalized === '3' || normalized === 'agent') return 'agentmemory'
  if (normalized === '4' || normalized === 'none' || normalized === 'no') return 'skip'
  if (['gbrain', 'scale-local', 'agentmemory', 'skip'].includes(normalized)) return normalized
  return 'gbrain'
}

function normalizeMemoryModeChoice(value: string): MemoryProviderRoutingConfig['mode'] {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'auto' || normalized === '2') return 'auto'
  if (normalized === 'local-only' || normalized === 'local' || normalized === '3') return 'local-only'
  return 'external-first'
}

function createPromptSession(input: NodeJS.ReadableStream, output: NodeJS.WritableStream): PromptSession {
  const rl = createInterface({ input, crlfDelay: Infinity })
  return {
    rl,
    output,
    iterator: rl[Symbol.asyncIterator](),
  }
}

async function askYesNo(promptSession: PromptSession, question: string): Promise<boolean> {
  const answer = (await askLine(promptSession, question)).trim().toLowerCase()
  return answer === 'y' || answer === 'yes' || answer === '是' || answer === '确认'
}

async function askLine(promptSession: PromptSession, question: string): Promise<string> {
  promptSession.output.write(question)
  const answer = await promptSession.iterator.next()
  return answer.done ? '' : answer.value
}
