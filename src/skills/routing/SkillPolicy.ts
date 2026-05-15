import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import type {
  ResolvedSkillRoutingPolicy,
  SkillRoutingMode,
  SkillRoutingPolicyFile,
  SkillTaskLevel,
} from './SkillRoutingTypes.js'

const DEFAULT_ENFORCE_LEVELS: SkillTaskLevel[] = ['M', 'L', 'CRITICAL']

export const DEFAULT_SKILL_ROUTING_POLICY: ResolvedSkillRoutingPolicy = {
  version: 1,
  warnings: [],
  policy: {
    mode: 'warn',
    enforceLevels: DEFAULT_ENFORCE_LEVELS,
    requireSkillPlan: true,
  },
  domains: {
    ui: {
      detect: {
        files: ['src/**/*.tsx', 'src/**/*.jsx', 'app/**/*.tsx', 'pages/**/*.tsx', 'components/**/*.tsx', '**/*.css', '**/*.scss'],
        keywords: ['ui', 'ux', 'frontend', 'component', 'page', 'layout', 'responsive', 'visual', '界面', '页面', '交互', '视觉', '前端'],
      },
      recommendedSkills: ['ui-ux-pro-max', 'frontend-design', 'design-review'],
      requiredArtifacts: ['skill-plan.md', 'mini-prd.md', 'ui-spec.md', 'visual-review.md'],
      requiredVerification: ['screenshot', 'responsive-check'],
    },
    e2e: {
      detect: {
        files: ['tests/e2e/**', 'e2e/**', 'playwright.config.*'],
        keywords: ['e2e', 'browser', 'playwright', 'end-to-end', '端到端', '浏览器'],
      },
      recommendedSkills: ['playwright', 'playwright-interactive'],
      requiredArtifacts: ['skill-plan.md', 'e2e-plan.md'],
      requiredVerification: ['browser-run'],
    },
    api: {
      detect: {
        files: ['**/api/**', '**/routes/**', '**/controller/**', '**/*.api', '**/*.proto'],
        keywords: ['api', 'endpoint', 'route', 'handler', '接口', '路由'],
      },
      recommendedSkills: ['tdd-guide', 'code-review'],
      requiredArtifacts: ['skill-plan.md', 'mini-prd.md', 'api-contract.md'],
      requiredVerification: ['contract-check'],
    },
    db: {
      detect: {
        files: ['**/migration/**', '**/migrations/**', '**/*.sql', '**/schema.*', '**/model/**'],
        keywords: ['database', 'db', 'migration', 'schema', 'sql', '数据表', '数据库', '迁移'],
      },
      requiredSkills: ['security-review'],
      recommendedSkills: ['systematic-debugging'],
      requiredArtifacts: ['skill-plan.md', 'db-change-plan.md', 'security-review.md'],
      requiredVerification: ['rollback-plan', 'migration-test'],
    },
    security: {
      detect: {
        files: ['**/auth/**', '**/permission/**', '**/security/**', '**/middleware/**'],
        keywords: ['auth', 'permission', 'tenant', 'token', 'credential', 'secret', 'rbac', '鉴权', '权限', '租户', '密钥'],
      },
      requiredSkills: ['security-review'],
      recommendedSkills: ['code-review'],
      requiredArtifacts: ['skill-plan.md', 'security-review.md'],
      requiredVerification: ['threat-model', 'rollback-plan'],
      blockLevels: ['CRITICAL'],
    },
    docs: {
      detect: {
        files: ['docs/**', '**/*.md'],
        keywords: ['docs', 'documentation', 'readme', '文档'],
      },
      recommendedSkills: ['workflow-guide'],
      requiredArtifacts: ['skill-plan.md'],
    },
    release: {
      detect: {
        files: ['CHANGELOG.md', 'package.json', '.github/workflows/**'],
        keywords: ['release', 'ship', 'publish', 'deploy', '发版', '发布', '部署'],
      },
      recommendedSkills: ['verification', 'code-review'],
      requiredArtifacts: ['skill-plan.md', 'review.md', 'summary.md'],
      requiredVerification: ['preflight'],
    },
  },
}

export function skillRoutingPolicyPath(projectDir = process.cwd(), scaleDir = '.scale'): string {
  const root = isAbsolute(scaleDir) ? scaleDir : join(resolve(projectDir), scaleDir)
  return join(root, 'skills.json')
}

export function loadSkillRoutingPolicy(projectDir = process.cwd(), scaleDir = '.scale'): ResolvedSkillRoutingPolicy {
  const path = skillRoutingPolicyPath(projectDir, scaleDir)
  if (!existsSync(path)) {
    return {
      ...DEFAULT_SKILL_ROUTING_POLICY,
      warnings: [`No skill routing policy found at ${path}; using built-in defaults.`],
    }
  }

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as SkillRoutingPolicyFile
    return resolveSkillRoutingPolicy(parsed)
  } catch (error) {
    return {
      ...DEFAULT_SKILL_ROUTING_POLICY,
      warnings: [`Failed to read ${path}: ${(error as Error).message}; using built-in defaults.`],
    }
  }
}

export function resolveSkillRoutingPolicy(input: SkillRoutingPolicyFile | null | undefined): ResolvedSkillRoutingPolicy {
  const warnings: string[] = []
  const mode = normalizeMode(input?.policy?.mode)
  if (input?.policy?.mode && !mode) {
    warnings.push(`Invalid skill policy mode "${String(input.policy.mode)}"; using warn.`)
  }

  return {
    version: typeof input?.version === 'number' ? input.version : 1,
    warnings,
    policy: {
      mode: mode ?? DEFAULT_SKILL_ROUTING_POLICY.policy.mode,
      enforceLevels: normalizeLevels(input?.policy?.enforceLevels),
      requireSkillPlan: input?.policy?.requireSkillPlan ?? DEFAULT_SKILL_ROUTING_POLICY.policy.requireSkillPlan,
    },
    domains: {
      ...DEFAULT_SKILL_ROUTING_POLICY.domains,
      ...(input?.domains ?? {}),
    },
  }
}

export function skillRoutingPolicyTemplate(mode: 'minimal' | 'standard' | 'critical' = 'standard'): string {
  const policy = {
    version: 1,
    policy: {
      mode: mode === 'critical' ? 'block' : 'warn',
      enforceLevels: DEFAULT_ENFORCE_LEVELS,
      requireSkillPlan: true,
    },
    domains: DEFAULT_SKILL_ROUTING_POLICY.domains,
  }
  return JSON.stringify(policy, null, 2) + '\n'
}

function normalizeMode(value: unknown): SkillRoutingMode | undefined {
  if (value === 'off' || value === 'warn' || value === 'block') return value
  return undefined
}

function normalizeLevels(value: unknown): SkillTaskLevel[] {
  if (!Array.isArray(value)) return DEFAULT_ENFORCE_LEVELS
  const levels = value.filter((level): level is SkillTaskLevel =>
    level === 'S' || level === 'M' || level === 'L' || level === 'CRITICAL',
  )
  return levels.length > 0 ? levels : DEFAULT_ENFORCE_LEVELS
}
