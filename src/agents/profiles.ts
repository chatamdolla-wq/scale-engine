// SCALE Engine — Professional Agent Profiles
// 12 个专业 Agent：前端、后端、测试、UI设计、运维、产品、代码审核、安全、数据库、性能、文档、架构

import type { AgentProfile } from './types.js'

export const PROFESSIONAL_AGENTS: AgentProfile[] = [
  {
    id: 'frontend-agent',
    name: 'Frontend Developer',
    domain: 'frontend',
    inheritsRole: 'Implementer',
    capabilities: ['react', 'vue', 'css', 'animation', 'accessibility', 'typescript', 'playwright-interactive', 'web-access'],
    // 外部技能：playwright-interactive (UI 调试), web-access (浏览器验证)
    preferredModel: 'balanced',
    outputFormat: { fileTypes: ['.tsx', '.css', '.html'], style: 'component-based' },
    collaboration: { reportsTo: 'backend-agent', sharesWith: ['ui-design-agent', 'test-agent'] },
    description: '负责 UI/UX 实现、组件开发、样式设计、动画效果、可访问性'
  },
  {
    id: 'backend-agent',
    name: 'Backend Developer',
    domain: 'backend',
    inheritsRole: 'Implementer',
    capabilities: ['api', 'database', 'auth', 'performance', 'caching', 'sql'],
    preferredModel: 'balanced',
    outputFormat: { fileTypes: ['.ts', '.sql', '.json'], style: 'layered-architecture' },
    collaboration: { reportsTo: 'frontend-agent', sharesWith: ['test-agent', 'ops-agent'] },
    description: '负责 API 设计、数据库操作、认证授权、性能优化、缓存策略'
  },
  {
    id: 'test-agent',
    name: 'Test Engineer',
    domain: 'testing',
    inheritsRole: 'Verifier',
    capabilities: ['tdd', 'e2e', 'mocking', 'coverage', 'playwright', 'jest', 'web-access', 'cua'],
    // 外部技能：playwright (E2E 脚本), web-access (登录态测试), cua (GUI 测试)
    preferredModel: 'fast',
    outputFormat: { fileTypes: ['.test.ts', '.spec.ts'], style: 'aaa-pattern' },
    collaboration: { sharesWith: ['code-review-agent'] },
    description: '负责 TDD、单元测试、集成测试、E2E 测试、测试覆盖率、Mocking'
  },
  {
    id: 'ui-design-agent',
    name: 'UI/UX Designer',
    domain: 'ui-design',
    inheritsRole: 'SpecWriter',
    capabilities: ['visual-design', 'accessibility', 'ux', 'responsive', 'animation', 'figma'],
    preferredModel: 'powerful',
    outputFormat: { fileTypes: ['.md', '.css'], style: 'design-spec' },
    collaboration: { reportsTo: 'frontend-agent', sharesWith: ['product-agent'] },
    description: '负责视觉设计、用户体验、响应式布局、设计规范、可访问性'
  },
  {
    id: 'ops-agent',
    name: 'DevOps Engineer',
    domain: 'operations',
    inheritsRole: 'Releaser',
    capabilities: ['deploy', 'cicd', 'monitoring', 'docker', 'k8s', 'terraform', 'cua', 'web-access'],
    // 外部技能：cua (电脑操控), web-access (浏览器监控)
    preferredModel: 'fast',
    outputFormat: { fileTypes: ['.yaml', '.sh', '.dockerfile'], style: 'automation' },
    collaboration: { reportsTo: 'backend-agent', sharesWith: ['security-agent'] },
    description: '负责部署、CI/CD、监控、容器化、Kubernetes、基础设施'
  },
  {
    id: 'product-agent',
    name: 'Product Manager',
    domain: 'product',
    inheritsRole: 'SpecWriter',
    capabilities: ['requirements', 'user-story', 'analytics', 'roadmap', 'prioritization'],
    preferredModel: 'powerful',
    outputFormat: { fileTypes: ['.md'], style: 'user-centric' },
    collaboration: { sharesWith: ['ui-design-agent'] },
    description: '负责需求分析、用户故事、数据分析、路线规划、优先级排序'
  },
  {
    id: 'code-review-agent',
    name: 'Code Reviewer',
    domain: 'code-review',
    inheritsRole: 'Verifier',
    capabilities: ['quality', 'security', 'patterns', 'best-practices', 'refactoring'],
    preferredModel: 'powerful',
    outputFormat: { fileTypes: ['.md'], style: 'review-report' },
    collaboration: { sharesWith: ['test-agent', 'security-agent'] },
    description: '负责代码质量、安全审查、设计模式、最佳实践、重构建议'
  },
  {
    id: 'security-agent',
    name: 'Security Specialist',
    domain: 'security',
    inheritsRole: 'Verifier',
    capabilities: ['owasp', 'auth', 'crypto', 'compliance', 'audit', 'penetration'],
    preferredModel: 'powerful',
    outputFormat: { fileTypes: ['.md', '.yaml'], style: 'review-report' },
    collaboration: { reportsTo: 'code-review-agent', sharesWith: ['ops-agent'] },
    description: '负责 OWASP 合规、认证安全、加密、渗透测试、安全审计'
  },
  // ===== 新增 4 个专业 Agent =====
  {
    id: 'database-agent',
    name: 'Database Specialist',
    domain: 'database',
    inheritsRole: 'Implementer',
    capabilities: ['migration', 'schema-design', 'sql-optimization', 'indexing', 'postgresql', 'mongodb', 'data-modeling'],
    preferredModel: 'balanced',
    outputFormat: { fileTypes: ['.sql', '.ts', '.prisma'], style: 'layered-architecture' },
    collaboration: { reportsTo: 'backend-agent', sharesWith: ['performance-agent'] },
    description: '负责数据库迁移、Schema 设计、SQL 优化、索引策略、数据建模、PostgreSQL/MongoDB'
  },
  {
    id: 'performance-agent',
    name: 'Performance Engineer',
    domain: 'performance',
    inheritsRole: 'Verifier',
    capabilities: ['profiling', 'load-testing', 'cache-strategy', 'benchmark', 'memory-analysis', 'lighthouse', 'web-vitals'],
    preferredModel: 'powerful',
    outputFormat: { fileTypes: ['.md', '.json'], style: 'review-report' },
    collaboration: { reportsTo: 'frontend-agent', sharesWith: ['backend-agent', 'database-agent'] },
    description: '负责性能分析、负载测试、缓存策略、Benchmark、内存泄漏排查、Core Web Vitals'
  },
  {
    id: 'docs-agent',
    name: 'Documentation Specialist',
    domain: 'documentation',
    inheritsRole: 'SpecWriter',
    capabilities: ['api-docs', 'readme', 'tutorials', 'swagger', 'markdown', 'tech-writing', 'changelog'],
    preferredModel: 'fast',
    outputFormat: { fileTypes: ['.md', '.mdx'], style: 'documentation' },
    collaboration: { sharesWith: ['product-agent', 'frontend-agent', 'backend-agent'] },
    description: '负责 API 文档、README、教程、技术博客、Swagger/OpenAPI、文档结构、变更日志'
  },
  {
    id: 'architect-agent',
    name: 'Software Architect',
    domain: 'architecture',
    inheritsRole: 'Planner',
    capabilities: ['system-design', 'tech-selection', 'module-boundary', 'dependency-analysis', 'patterns', 'ddd', 'microservices'],
    preferredModel: 'powerful',
    outputFormat: { fileTypes: ['.md', '.yaml'], style: 'design-spec' },
    collaboration: { reportsTo: 'product-agent', sharesWith: ['backend-agent', 'code-review-agent'] },
    description: '负责系统架构设计、技术选型、模块边界、依赖关系、架构评审、DDD、微服务拆分'
  }
]

export function getProfile(id: string): AgentProfile | undefined {
  return PROFESSIONAL_AGENTS.find(p => p.id === id)
}

export function getProfilesByDomain(domain: string): AgentProfile[] {
  return PROFESSIONAL_AGENTS.filter(p => p.domain === domain)
}

export function getProfilesByRole(role: string): AgentProfile[] {
  return PROFESSIONAL_AGENTS.filter(p => p.inheritsRole === role)
}

export function listProfiles(): string[] {
  return PROFESSIONAL_AGENTS.map(p => p.id)
}
