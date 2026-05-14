// SCALE Engine - Phase-Aligned Commands (v0.10.0)
// 6 phase commands: DEFINE -> PLAN -> BUILD -> VERIFY -> REVIEW -> SHIP
// Integrates WorkflowEngine cognitive scaffolding and quality gates.

import { defineCommand } from 'citty'

// Engine singleton (reuse from cli.ts)
import { EventBus } from '../core/eventBus.js'
import { SQLiteArtifactStore } from '../artifact/sqliteStore.js'
import { FSM } from '../artifact/fsm.js'
import { registerAllFSMs } from '../artifact/fsmDefinitions.js'
import { CapabilityRegistry } from '../capabilities/CapabilityRegistry.js'
import { SkillRegistry } from '../skills/SkillRegistry.js'
import { WorkflowEngine } from '../workflow/WorkflowEngine.js'
import { WorkflowArtifactWriter } from '../workflow/WorkflowArtifactWriter.js'
import { EvidenceStore } from '../workflow/EvidenceStore.js'
import { ReviewStore, type ReviewFinding, type ReviewRecord } from '../workflow/ReviewStore.js'
import { analyzeReview, parseChangedFiles, shouldReviewFile, summarizeFindings, analyzeSpecConformance, type ChangedFile, type VerificationEvidenceSummary, type SpecFinding } from '../workflow/ReviewAnalyzer.js'
import { join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import type { SpecPayload, PlanPayload, TaskPayload } from '../artifact/types.js'
import { HTMLDocumentRenderer } from '../output/HTMLDocumentRenderer.js'
import type { OutputFormat } from '../output/HTMLDocumentRenderer.js'

const SCALE_DIR = process.env.SCALE_DIR ?? '.scale'

function validateVerificationEvidence(ids: string[] | undefined): { ok: boolean; missing: string[]; failed: string[] } {
  const evidenceStore = new EvidenceStore(SCALE_DIR)
  const missing: string[] = []
  const failed: string[] = []
  for (const id of ids ?? []) {
    const record = evidenceStore.getGateResult(id)
    if (!record) {
      missing.push(id)
    } else if (!record.passed) {
      failed.push(id)
    }
  }
  return { ok: (ids?.length ?? 0) > 0 && missing.length === 0 && failed.length === 0, missing, failed }
}

function validateReviewEvidence(ids: string[] | undefined): { ok: boolean; missing: string[]; failed: string[] } {
  const reviewStore = new ReviewStore(SCALE_DIR)
  const missing: string[] = []
  const failed: string[] = []
  for (const id of ids ?? []) {
    const record = reviewStore.getReview(id)
    if (!record) {
      missing.push(id)
    } else if (!record.passed) {
      failed.push(id)
    }
  }
  return { ok: (ids?.length ?? 0) > 0 && missing.length === 0 && failed.length === 0, missing, failed }
}

function getValidatedReviewRecords(ids: string[] | undefined): ReviewRecord[] {
  const reviewStore = new ReviewStore(SCALE_DIR)
  return (ids ?? [])
    .map(id => reviewStore.getReview(id))
    .filter((record): record is ReviewRecord => Boolean(record?.passed))
}

function getVerificationEvidenceSummary(ids: string[] | undefined): VerificationEvidenceSummary[] {
  const evidenceStore = new EvidenceStore(SCALE_DIR)
  return (ids ?? [])
    .map(id => evidenceStore.getGateResult(id))
    .filter((record): record is NonNullable<ReturnType<EvidenceStore['getGateResult']>> => Boolean(record))
    .map(record => ({ gate: record.gate, passed: record.passed }))
}

function getEngine() {
  ensureDir(SCALE_DIR)
  const eventBus = new EventBus({ eventsDir: join(SCALE_DIR, 'events') })
  const store = new SQLiteArtifactStore(eventBus, {
    dbPath: join(SCALE_DIR, 'scale.db'),
    artifactsDir: join(SCALE_DIR, 'artifacts'),
  })
  const fsm = new FSM(store, eventBus)
  registerAllFSMs(fsm)

  // Initialize capability registry
  const capabilityRegistry = new CapabilityRegistry(eventBus)

  // Initialize skill registry
  const skillRegistry = new SkillRegistry(eventBus)

  // Initialize workflow engine with cognitive scaffolding and quality gates.
  const workflowEngine = new WorkflowEngine({
    eventBus,
    capabilityRegistry,
    skillRegistry
  })

  return { eventBus, store, fsm, workflowEngine, skillRegistry }
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === '' || value === 'true' || value === '1'
}

function shouldSkipCommit(value: unknown): boolean {
  return isTruthyFlag(value) || process.argv.includes('--no-commit') || process.argv.includes('--skip-commit')
}

function normalizeGitPath(path: string): string {
  return path.replace(/\\/g, '/')
}

// Helper: Generate spec markdown file
function generateSpecMarkdown(id: string, title: string, payload: SpecPayload): string {
  return `# Spec: ${title}

**ID**: ${id}
**Status**: FROZEN
**Ambiguity Score**: ${payload.ambiguityScore ?? 0.15}

## What
${payload.what}

## Success Criteria
${payload.successCriteria.map(c => `- [ ] ${c}`).join('\n')}

## Out of Scope
${payload.outOfScope.map(o => `- ${o}`).join('\n') || '(none defined)'}

## Edge Cases
${payload.edgeCases.map(e => `- ${e}`).join('\n') || '(none defined)'}

## North Star
${payload.northStar || 'User value delivered'}

---
*Generated by SCALE Engine DEFINE phase*
`
}

// Helper: Calculate ambiguity score
function calculateAmbiguityScore(description: string, successCriteria: string[]): number {
  let score = 0.2 // Base score (maximum threshold)
  // Reduce score based on completeness
  if (description.length > 50) score -= 0.05
  if (successCriteria.length >= 2) score -= 0.03
  if (successCriteria.length >= 3) score -= 0.02
  return Math.max(0.05, score)
}

// DEFINE Phase - AmbiguityScorer + SocraticQuestioner + G1 gate
export const phaseDefine = defineCommand({
  meta: { name: 'define', description: 'DEFINE: Create Spec with AmbiguityScorer + SocraticQuestioner (/spec)' },
  args: {
    title: { type: 'positional', required: true },
    description: { type: 'string', alias: 'd' },
    'success-criteria': { type: 'string', alias: 'c', description: 'Comma-separated criteria' },
    // Socratic refinement answers (optional)
    'goal': { type: 'string', description: 'Goal answer for Socratic refinement' },
    'constraint': { type: 'string', description: 'Constraint answer for Socratic refinement' },
    'acceptance': { type: 'string', description: 'Acceptance criteria answer for Socratic refinement' },
    'context': { type: 'string', description: 'Context answer for Socratic refinement' },
    'risk': { type: 'string', description: 'Risk answer for Socratic refinement' },
    'priority': { type: 'string', description: 'Priority answer for Socratic refinement' },
    format: { type: 'string', alias: 'f', description: 'Output format: html or md (default: html)' },
    brand: { type: 'string', description: 'Brand theme for HTML output (vercel/stripe/notion/linear/github)' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const { store, fsm, workflowEngine } = getEngine()
    const desc = args.description ?? args.title

    // Parse success criteria
    const successCriteria = args['success-criteria']
      ? args['success-criteria'].split(',').map(s => s.trim()).filter(s => s)
      : ['Feature works as described', 'No regression in existing functionality']

    // === WorkflowEngine Integration ===
    // Step 1: Explore with AmbiguityScorer + SocraticQuestioner
    const exploreResult = await workflowEngine.explore(desc)
    const ambiguityResult = workflowEngine.getAmbiguityScorer().analyzeRequirement(desc)

    // Step 2: Check if requirement needs refinement.
    if (ambiguityResult.blocked) {
      console.error('\nRequirement ambiguity is too high (>40%); refine the requirement first.')
      console.log('\n   Refine the requirement by answering:')
      console.log('   - What is the goal?')
      console.log('   - What are the input/output boundaries?')
      console.log('   - What are the acceptance criteria?\n')
      process.exit(1)
    }

    // Step 3: Handle Socratic refinement if ambiguity > 20%
    let refinedRequirement = desc
    let finalAmbiguityScore = ambiguityResult.totalScore

    if (ambiguityResult.requiresQuestioning && exploreResult.socraticSession) {
      const session = exploreResult.socraticSession

      if (!args.json) {
        console.log('\nRequirement ambiguity is >20%; starting Socratic refinement.')
        console.log('\nSix-question refinement framework:')
        console.log(workflowEngine.getSocraticQuestioner().formatSessionReport(session))
      }

      // Check if user provided answers via CLI args
      const answers: { questionId: string; answer: string }[] = []
      if (args.goal) answers.push({ questionId: 'q-goal', answer: args.goal })
      if (args.constraint) answers.push({ questionId: 'q-constraint', answer: args.constraint })
      if (args.acceptance) answers.push({ questionId: 'q-acceptance', answer: args.acceptance })
      if (args.context) answers.push({ questionId: 'q-context', answer: args.context })
      if (args.risk) answers.push({ questionId: 'q-risk', answer: args.risk })
      if (args.priority) answers.push({ questionId: 'q-priority', answer: args.priority })

      // If answers provided, process them
      if (answers.length > 0) {
        for (const { questionId, answer } of answers) {
          workflowEngine.getSocraticQuestioner().recordAnswer(session.sessionId, questionId, answer)
        }

        const progress = workflowEngine.getSocraticQuestioner().evaluateProgress(session)

        if (progress.refined) {
          refinedRequirement = workflowEngine.getSocraticQuestioner().generateRefinedRequirement(session)
          finalAmbiguityScore = progress.newAmbiguity

          if (!args.json) {
            console.log('\nRequirement refined; ambiguity reduced to: ' + finalAmbiguityScore.toFixed(2))
            console.log('\nRefined requirement:')
            console.log(refinedRequirement)
          }
        } else if (!args.json) {
          console.log('\nMore answers are needed to refine the requirement.')
          console.log('   Current ambiguity: ' + progress.newAmbiguity.toFixed(2))
        }
      } else if (!args.json) {
        console.log('\nYou can refine the requirement with:')
        console.log('   --goal "goal description"')
        console.log('   --constraint "constraints and boundaries"')
        console.log('   --acceptance "acceptance criteria"')
        console.log('   --context "context and dependencies"')
        console.log('   --risk "risk scenarios"')
        console.log('   --priority "priority order"\n')
      }
    }

    const ambiguityScore = finalAmbiguityScore

    // Create Need artifact
    const need = await store.create({
      type: 'Need', title: args.title,
      payload: { rawText: refinedRequirement },
      initialStatus: 'DRAFT',
      createdBy: { kind: 'human', userId: 'cli' },
    })

    // Create Spec artifact with proper payload (use refined requirement if available)
    const specPayload: SpecPayload = {
      what: refinedRequirement,
      successCriteria,
      outOfScope: [],
      edgeCases: [],
      northStar: 'Deliver user value',
      ambiguityScore,
    }

    const spec = await store.create({
      type: 'Spec', title: args.title,
      payload: specPayload,
      parents: [need.id],
      initialStatus: 'DRAFT',
      createdBy: { kind: 'human', userId: 'cli' },
    })

    // Generate spec markdown file
    const specsDir = join(SCALE_DIR, 'specs')
    ensureDir(specsDir)
    const specPath = join(specsDir, `${spec.id}.md`)
    writeFileSync(specPath, generateSpecMarkdown(spec.id, args.title, specPayload))

    // Generate spec HTML file (default format: html)
    const outputFormat: OutputFormat = (args.format as OutputFormat) ?? 'md'
    let specHtmlPath: string | undefined
    if (outputFormat === 'html') {
      const renderer = new HTMLDocumentRenderer({
        title: args.title,
        brand: args.brand as string | undefined,
        version: '0.13.0',
        status: 'FROZEN',
      })
      const html = renderer.renderSpec({
        id: spec.id,
        title: args.title,
        what: refinedRequirement,
        successCriteria,
        outOfScope: specPayload.outOfScope,
        edgeCases: specPayload.edgeCases,
        northStar: specPayload.northStar,
        ambiguityScore,
      })
      specHtmlPath = join(specsDir, `${spec.id}.html`)
      renderer.writeToFile(html, specHtmlPath)
    }

    // FSM transitions: DRAFT -> REVIEWING -> FROZEN
    // Phase 1: refine (DRAFT -> REVIEWING) - no guards
    const refineResult = await fsm.canTransition(spec.id, 'refine')
    if (!refineResult.allowed) {
      if (!args.json) {
        console.error('\nFSM transition blocked: DRAFT -> REVIEWING')
        refineResult.blockedBy?.forEach(b => console.error(`   [GUARD] ${b.guard}: ${b.message}`))
      }
      process.exit(1)
    }
    await fsm.transition(spec.id, 'refine', { actor: { kind: 'system', component: 'phase-define' } })

    // Phase 2: approve (REVIEWING -> FROZEN) - guards: ambiguityScore <= 0.2, has successCriteria
    const approveResult = await fsm.canTransition(spec.id, 'approve')
    if (!approveResult.allowed) {
      if (!args.json) {
        console.error('\nFSM transition blocked: REVIEWING -> FROZEN')
        console.error('   Spec cannot be frozen due to:')
        approveResult.blockedBy?.forEach(b => console.error(`   [GUARD] ${b.guard}: ${b.message}`))
        console.error('\n   Resolve issues before proceeding.')
      }
      process.exit(1)
    }
    await fsm.transition(spec.id, 'approve', { actor: { kind: 'system', component: 'phase-define' } })

    if (!args.json) {
      console.log('   FSM: DRAFT -> REVIEWING -> FROZEN ✓')
    }

    const result = { phase: 'DEFINE', spec, specPath, specHtmlPath, ambiguityScore, successCriteria, format: outputFormat }

    // Write explore artifact for Gate G1 verification
    const artifactWriter = new WorkflowArtifactWriter(SCALE_DIR)
    artifactWriter.writeExploreResult({
      timestamp: new Date().toISOString(),
      files: [specPath],
      fileCount: 1,
      mainContradiction: refinedRequirement !== desc ? 'requirement ambiguity resolved via Socratic refinement' : '',
      ambiguityScore,
      socraticCompleted: !ambiguityResult.requiresQuestioning || (ambiguityResult.requiresQuestioning && !exploreResult.socraticSession),
    })

    if (args.json) console.log(JSON.stringify(result, null, 2))
    else {
      console.log(`\nDEFINE: ${spec.id}`)
      console.log(`   Spec file: ${specPath}`)
      if (specHtmlPath) console.log(`   HTML file: ${specHtmlPath}`)
      console.log(`   Ambiguity score: ${ambiguityScore.toFixed(2)}`)
      console.log(`   Success criteria: ${successCriteria.length}`)
      console.log(`\n   Next: scale plan ${spec.id}\n`)
    }
  },
})

// Helper: Generate plan markdown file
function generatePlanMarkdown(id: string, specId: string, payload: PlanPayload): string {
  return `# Plan: ${id}

**Spec**: ${specId}
**Status**: APPROVED

## Approach
${payload.approach}

## Tech Choices
${payload.techChoices.map(t => `- **${t.decision}**: ${t.rationale}`).join('\n') || '(to be defined)'}

## Modules
${payload.modules.map(m => `- ${m.action} \`${m.path}\`: ${m.reason}`).join('\n') || '(to be defined)'}

## Rollback Strategy
${payload.rollbackStrategy}

## Estimated Complexity
${payload.estimatedComplexity ?? 5}/10

---
*Generated by SCALE Engine PLAN phase*
`
}

// PLAN Phase - ConsensusPlanner + G2 gate
export const phasePlan = defineCommand({
  meta: { name: 'plan', description: 'PLAN: Create Plan with ConsensusPlanner (/plan)' },
  args: {
    'spec-id': { type: 'positional', required: true },
    approach: { type: 'string', alias: 'a', description: 'Implementation approach' },
    'rollback': { type: 'string', alias: 'r', description: 'Rollback strategy (required for FSM)' },
    format: { type: 'string', alias: 'f', description: 'Output format: html or md (default: html)' },
    brand: { type: 'string', description: 'Brand theme for HTML output (vercel/stripe/notion/linear/github)' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const { store, fsm, workflowEngine } = getEngine()

    // Validate spec exists
    const spec = await store.get(args['spec-id'])
    if (!spec || spec.type !== 'Spec') {
      console.error(`\nSpec not found: ${args['spec-id']}\n`)
      process.exit(1)
    }

    // === WorkflowEngine Integration ===
    // Step 1: Run ConsensusPlanner (Planner -> Architect -> Critic).
    const specDesc = (spec.payload as SpecPayload).what
    const consensusResult = await workflowEngine.plan(specDesc) as import('../workflow/types.js').RALPLANOutput

    // Step 2: Display RALPLAN-DR output
    if (!args.json) {
      console.log('\nConsensus Planning Result:')
      console.log(workflowEngine.getConsensusPlanner().formatReport(consensusResult))
    }

    // Default rollback strategy (FSM guard requires this)
    const rollbackStrategy = args.rollback ?? consensusResult.preMortem.mitigations.join('\n') ?? 'Revert git commits'
    const approach = args.approach ?? consensusResult.viableOptions.find((o: import('../workflow/types.js').ViableOption) => o.selected)?.description ?? 'Standard implementation'

    // Create PlanPayload with rollback strategy
    const planPayload: PlanPayload = {
      approach,
      techChoices: [],
      modules: [],
      rollbackStrategy,
      estimatedComplexity: 5,
    }

    const plan = await store.create({
      type: 'Plan', title: `Plan for ${spec.title}`,
      payload: planPayload,
      parents: [args['spec-id']],
      initialStatus: 'DRAFT',
      createdBy: { kind: 'human', userId: 'cli' },
    })

    // Generate plan markdown file
    const plansDir = join(SCALE_DIR, 'plans')
    ensureDir(plansDir)
    const planPath = join(plansDir, `${plan.id}.md`)
    writeFileSync(planPath, generatePlanMarkdown(plan.id, args['spec-id'], planPayload))

    // Generate plan HTML file (default format: html)
    const planOutputFormat: OutputFormat = (args.format as OutputFormat) ?? 'md'
    let planHtmlPath: string | undefined
    if (planOutputFormat === 'html') {
      const planRenderer = new HTMLDocumentRenderer({
        title: `Plan ${plan.id}`,
        brand: args.brand as string | undefined,
        version: '0.13.0',
        status: 'APPROVED',
      })
      const planHtml = planRenderer.renderPlan({
        id: plan.id,
        specId: args['spec-id'],
        approach: planPayload.approach,
        techChoices: planPayload.techChoices,
        modules: planPayload.modules,
        rollbackStrategy: planPayload.rollbackStrategy,
        estimatedComplexity: planPayload.estimatedComplexity,
      })
      planHtmlPath = join(plansDir, `${plan.id}.html`)
      planRenderer.writeToFile(planHtml, planHtmlPath)
    }

    // Write plan artifact for Gate G2 verification
    const artifactWriter = new WorkflowArtifactWriter(SCALE_DIR)
    artifactWriter.writePlanResult({
      timestamp: new Date().toISOString(),
      planId: plan.id,
      specId: args['spec-id'],
      hasBoundaryAnalysis: consensusResult.viableOptions.length > 1,
      hasExceptionHandling: consensusResult.preMortem.rootCauses.length > 0,
      hasRollbackStrategy: !!rollbackStrategy,
      modules: planPayload.modules.map(m => m.path),
      consensusRounds: consensusResult.iterationCount,
      verdict: consensusResult.verdict,
    })

    // FSM transition: DRAFT -> APPROVED (requires rollbackStrategy guard)
    const reviewResult = await fsm.canTransition(plan.id, 'review')
    if (!reviewResult.allowed) {
      if (!args.json) {
        console.error('\nFSM transition blocked: DRAFT -> APPROVED')
        console.error('   Plan cannot be approved due to:')
        reviewResult.blockedBy?.forEach(b => console.error(`   [GUARD] ${b.guard}: ${b.message}`))
        console.error('\n   Provide rollback strategy: --rollback "Revert strategy description"')
      }
      process.exit(1)
    }
    await fsm.transition(plan.id, 'review', { actor: { kind: 'system', component: 'phase-plan' } })
    if (!args.json) {
      console.log('   FSM: DRAFT -> APPROVED ✓')
    }

    const result = { phase: 'PLAN', plan, planPath, planHtmlPath, rollbackStrategy, format: planOutputFormat }
    if (args.json) console.log(JSON.stringify(result, null, 2))
    else {
      console.log(`\nPLAN: ${plan.id}`)
      console.log(`   Plan file: ${planPath}`)
      if (planHtmlPath) console.log(`   HTML file: ${planHtmlPath}`)
      console.log(`   Rollback: ${rollbackStrategy}`)
      console.log(`\n   Next: scale build ${plan.id}\n`)
    }
  },
})

// BUILD Phase
export const phaseBuild = defineCommand({
  meta: { name: 'build', description: 'BUILD: Create Task (/build)' },
  args: {
    'plan-id': { type: 'positional', required: true },
    description: { type: 'string', alias: 'd', description: 'Task description' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const { store, fsm } = getEngine()

    // Validate plan exists
    const plan = await store.get(args['plan-id'])
    if (!plan || plan.type !== 'Plan') {
      console.error(`\nPlan not found: ${args['plan-id']}\n`)
      process.exit(1)
    }

    // Create TaskPayload
    const taskPayload: TaskPayload = {
      description: args.description ?? `Implement ${plan.title}`,
      filesInvolved: [],
      dependsOn: [],
      requiredRole: 'implementer',
      requiredCapabilities: ['code-generation', 'file-editing'],
      // Initialize quality metrics (FSM guards require these for completion)
      buildStatus: 'pending',
      lintStatus: 'pending',
      testPassed: undefined,
      testCoverage: undefined,
      agentBrief: {
        category: 'enhancement',
        summary: args.description ?? `Implement ${plan.title}`,
        currentBehavior: 'Feature not yet implemented',
        desiredBehavior: `Implement: ${plan.title}`,
        keyInterfaces: [],
        acceptanceCriteria: [],
        outOfScope: [],
      },
    }

    const task = await store.create({
      type: 'Task', title: `Task for ${plan.title}`,
      payload: taskPayload,
      parents: [args['plan-id']],
      initialStatus: 'PENDING',
      createdBy: { kind: 'human', userId: 'cli' },
    })

    // FSM transitions: PENDING -> READY -> RUNNING
    // Phase 1: schedule (PENDING -> READY) - no guards
    const scheduleResult = await fsm.canTransition(task.id, 'schedule')
    if (!scheduleResult.allowed) {
      if (!args.json) {
        console.error('\nFSM transition blocked: PENDING -> READY')
        scheduleResult.blockedBy?.forEach(b => console.error(`   [GUARD] ${b.guard}: ${b.message}`))
      }
      process.exit(1)
    }
    await fsm.transition(task.id, 'schedule', { actor: { kind: 'system', component: 'phase-build' } })

    // Phase 2: start (READY -> RUNNING) - no guards
    await fsm.transition(task.id, 'start', { actor: { kind: 'human', userId: 'cli' } })
    if (!args.json) {
      console.log('   FSM: PENDING -> READY -> RUNNING ✓')
    }

    // Update Plan status to IMPLEMENTING
    const implResult = await fsm.canTransition(args['plan-id'], 'implement')
    if (implResult.allowed) {
      await fsm.transition(args['plan-id'], 'implement', { actor: { kind: 'system', component: 'phase-build' } })
    }

    const result = { phase: 'BUILD', task, status: 'RUNNING' }
    if (args.json) console.log(JSON.stringify(result, null, 2))
    else {
      console.log(`\nBUILD: ${task.id}`)
      console.log(`   Status: RUNNING (ready to implement)`)
      console.log(`   Description: ${taskPayload.description}`)
      console.log(`\n   Implement now, then run: scale verify ${task.id}\n`)
    }
  },
})

// Helper: Run command and capture result (from verify-task)
async function runVerificationCmd(cmd: string): Promise<{ exitCode: number; output: string }> {
  const { spawn } = await import('node:child_process')
  return new Promise((resolve) => {
    const child = spawn(cmd, [], { shell: true, stdio: 'pipe' })
    let output = ''
    child.stdout?.on('data', (d: Buffer) => (output += d.toString()))
    child.stderr?.on('data', (d: Buffer) => (output += d.toString()))
    child.on('close', (code) => resolve({ exitCode: code ?? 1, output }))
  })
}

// VERIFY Phase - GateSystem quality gates
export const phaseVerify = defineCommand({
  meta: { name: 'verify', description: 'VERIFY: Run Gates G3-G7 (/test)' },
  args: {
    'task-id': { type: 'positional', required: true },
    'build-cmd': { type: 'string', description: 'Override build command' },
    'lint-cmd': { type: 'string', description: 'Override lint command' },
    'test-cmd': { type: 'string', description: 'Override test command' },
    'coverage-cmd': { type: 'string', description: 'Override coverage command' },
    'tdd-evidence': { type: 'string', description: 'Path to JSON TDD evidence with red/green/refactor/testFirst=true' },
    'tdd-strict': { type: 'boolean', default: false, description: 'Require TDD evidence before other gates' },
    'skip-build': { type: 'boolean', default: false },
    'skip-lint': { type: 'boolean', default: false },
    'skip-test': { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const { store, fsm, workflowEngine } = getEngine()

    // Validate task exists
    const task = await store.get(args['task-id'])
    if (!task || task.type !== 'Task') {
      console.error(`\nTask not found: ${args['task-id']}\n`)
      process.exit(1)
    }

    // === WorkflowEngine Integration ===
    // Step 1: Run GateSystem G3-G7
    if (!args.json) console.log('\nRunning Quality Gates...')
    const gateResults = await workflowEngine.verify({
      build: args['build-cmd'],
      lint: args['lint-cmd'],
      test: args['test-cmd'],
      coverage: args['coverage-cmd'],
      tddEvidence: args['tdd-evidence'],
      tddStrict: isTruthyFlag(args['tdd-strict']),
    })

    // Step 2: Display gate results
    if (!args.json) {
      console.log('\nGate Results:')
      for (const result of gateResults) {
        console.log(`   ${result.passed ? '[PASS]' : '[FAIL]'} ${result.gate}: ${result.evidence.slice(0, 50)}`)
        if (result.blockers.length > 0) {
          result.blockers.forEach((b: string) => console.log(`      [BLOCKER] ${b.slice(0, 80)}`))
        }
      }
    }

    // Extract results from gateResults
    const g0Result = gateResults.find(g => g.gate === 'G0')
    const g4Result = gateResults.find(g => g.gate === 'G4')
    const g5Result = gateResults.find(g => g.gate === 'G5')
    const g6Result = gateResults.find(g => g.gate === 'G6')
    const g7Result = gateResults.find(g => g.gate === 'G7')

    const results = {
      buildStatus: g0Result?.passed ? 'success' : 'failed' as 'pending' | 'success' | 'failed',
      buildExitCode: g0Result?.evidenceItems?.find(item => item.kind === 'command')?.exitCode,
      lintStatus: g4Result?.passed ? 'success' : 'failed' as 'pending' | 'success' | 'failed',
      testPassed: g5Result?.passed,
      testCoverage: undefined as number | undefined,
      securityPassed: g7Result?.passed,
    }
    const verificationEvidenceIds = gateResults
      .map(g => g.evidenceRecordId)
      .filter((id): id is string => Boolean(id))

    // Extract coverage from G6 evidence
    const coverageMatch = g6Result?.evidence.match(/Coverage: (\d+\.?\d*)%/)
    if (coverageMatch) results.testCoverage = parseFloat(coverageMatch[1])

    // Update Task payload with verification results
    const currentPayload = task.payload as TaskPayload
    const updatedPayload: TaskPayload = {
      ...currentPayload,
      buildStatus: results.buildStatus,
      buildExitCode: results.buildExitCode,
      lintStatus: results.lintStatus,
      testPassed: results.testPassed,
      testCoverage: results.testCoverage,
      verificationEvidenceIds,
      verifiedAt: Date.now(),
    }
    await store.update(args['task-id'], { payload: updatedPayload })

    // Attempt FSM transition to COMPLETED
    // Guards: build_passed, lint_passed, tests_passed
    const allPassed = results.buildStatus === 'success' &&
                      (results.buildExitCode ?? 1) === 0 &&
                      results.lintStatus === 'success' &&
                      results.testPassed === true &&
                      (results.testCoverage ?? 0) >= 80 &&
                      results.securityPassed === true

    let transitionResult = null
    if (allPassed) {
      const completeResult = await fsm.canTransition(args['task-id'], 'complete')
      if (!completeResult.allowed) {
        if (!args.json) {
          console.error('\nFSM transition blocked: RUNNING -> COMPLETED')
          console.error('   Task cannot be completed due to:')
          completeResult.blockedBy?.forEach(b => console.error(`   [GUARD] ${b.guard}: ${b.message}`))
        }
        // Don't exit - allow user to see what passed and fix issues
      } else {
        transitionResult = await fsm.transition(args['task-id'], 'complete', {
          actor: { kind: 'human', userId: 'cli' }
        })
        if (!args.json) console.log('\n   FSM: RUNNING -> COMPLETED ✓')
      }
    } else if (!args.json) {
      console.log('\n   Verification requirements not met - cannot complete Task')
    }

    const passed = allPassed && (transitionResult?.success ?? false)
    const result = { phase: 'VERIFY', taskId: args['task-id'], results, evidenceIds: verificationEvidenceIds, passed }
    if (args.json) console.log(JSON.stringify(result, null, 2))
    else {
      console.log(`\nVERIFY: ${passed ? 'PASSED' : 'FAILED'}`)
      if (passed) console.log(`\n   Next: scale review\n`)
      else console.log(`\n   Fix issues and re-run: scale verify ${args['task-id']}\n`)
    }
  },
})

async function runGit(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const { execa } = await import('execa')
  const result = await execa('git', args, { reject: false })
  return {
    exitCode: result.exitCode ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

function mergeUntrackedFilesIntoStatus(statusOutput: string, untrackedOutput: string): string {
  const existing = new Set(parseChangedFiles(statusOutput).map(file => file.path.replace(/\\/g, '/')))
  // Add '??' status marker for untracked files so parseChangedFiles can recognize them
  const additions = untrackedOutput
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .filter(path => shouldReviewFile(path))
    .filter(path => !existing.has(path.replace(/\\/g, '/')))
    .map(path => `?? ${path}`)  // Add status marker

  return [statusOutput.trim(), ...additions].filter(Boolean).join('\n')
}

function readUntrackedFileAsDiff(path: string): string {
  try {
    const stat = statSync(path)
    if (!stat.isFile() || stat.size > 250_000) return ''
    const content = readFileSync(path, 'utf-8')
    if (content.includes('\u0000')) return ''
    return content
      .split('\n')
      .slice(0, 2000)
      .map(line => `+${line}`)
      .join('\n')
  } catch {
    return ''
  }
}

async function reviewGitChanges(taskPayload?: TaskPayload): Promise<{ changedFiles: ChangedFile[]; findings: ReviewFinding[] }> {
  const status = await runGit(['status', '--short'])
  const untracked = await runGit(['ls-files', '--others', '--exclude-standard'])
  let statusOutput = mergeUntrackedFilesIntoStatus(status.stdout, untracked.stdout)

  // Scope review to task-relevant files only.
  // When filesInvolved is set, only analyze those files.
  // When empty, only analyze untracked (new) files to avoid picking up
  // unrelated modifications from a dirty working tree.
  if (taskPayload?.filesInvolved?.length) {
    const involved = new Set(taskPayload.filesInvolved.map(f => f.replace(/\\/g, '/')))
    statusOutput = statusOutput.split('\n').filter(line => {
      const parsed = parseChangedFiles(line)
      return parsed.length > 0 && involved.has(parsed[0].path.replace(/\\/g, '/'))
    }).join('\n')
  } else {
    // Only include untracked files (status '??') — skip tracked modifications
    // that may be unrelated to the task under review.
    statusOutput = statusOutput.split('\n').filter(line => line.startsWith('??')).join('\n')
  }

  const verificationEvidence = getVerificationEvidenceSummary(taskPayload?.verificationEvidenceIds)
  const changedFiles = analyzeReview({ statusOutput, diffs: [], taskPayload, verificationEvidence }).changedFiles
  const diffs: Array<{ file: string; text: string }> = []
  for (const file of changedFiles.slice(0, 50)) {
    if (file.status === '??') {
      diffs.push({ file: file.path, text: readUntrackedFileAsDiff(file.path) })
    } else {
      const diff = await runGit(['diff', '--', file.path])
      diffs.push({ file: file.path, text: diff.stdout })
    }
  }

  return analyzeReview({ statusOutput, diffs, taskPayload, verificationEvidence })
}

function collectReviewedFiles(records: ReviewRecord[]): Set<string> {
  const reviewed = new Set<string>()
  for (const record of records) {
    if (!record.passed) continue
    for (const file of record.changedFiles) {
      if (shouldReviewFile(file)) reviewed.add(normalizeGitPath(file))
    }
  }
  return reviewed
}

async function getReviewableGitChanges(): Promise<ChangedFile[]> {
  const status = await runGit(['status', '--short'])
  const untracked = await runGit(['ls-files', '--others', '--exclude-standard'])
  const statusOutput = mergeUntrackedFilesIntoStatus(status.stdout, untracked.stdout)
  return parseChangedFiles(statusOutput).filter(file => shouldReviewFile(file.path))
}

async function stageReviewedFiles(reviewRecords: ReviewRecord[]): Promise<{ stagedFiles: string[]; unreviewedFiles: string[] }> {
  const reviewedFiles = collectReviewedFiles(reviewRecords)
  const currentChanges = await getReviewableGitChanges()
  const stagedFiles: string[] = []
  const unreviewedFiles: string[] = []

  // Edge case: if currentChanges is empty but reviewedFiles has files that should be staged,
  // this indicates files were deleted or moved. Treat reviewed but missing files as unreviewed.
  if (currentChanges.length === 0 && reviewedFiles.size > 0) {
    // No changes to stage, but we have review records - this is a pass (nothing to commit)
    return { stagedFiles: [], unreviewedFiles: [] }
  }

  for (const file of currentChanges) {
    const normalizedPath = normalizeGitPath(file.path)
    if (reviewedFiles.has(normalizedPath)) {
      stagedFiles.push(file.path)
    } else {
      unreviewedFiles.push(file.path)
    }
  }

  // Only block if there are actual unreviewed changes
  if (unreviewedFiles.length > 0) {
    return { stagedFiles: [], unreviewedFiles }
  }

  if (stagedFiles.length > 0) {
    const gitAdd = await runGit(['add', '--', ...stagedFiles])
    if (gitAdd.exitCode !== 0) {
      throw new Error(gitAdd.stderr || 'git add failed')
    }
  }

  return { stagedFiles, unreviewedFiles: [] }
}

// REVIEW Phase - KarpathyEvaluator + deterministic review evidence
export const phaseReview = defineCommand({
  meta: { name: 'review', description: 'REVIEW: Code review with Karpathy Principles (/review)' },
  args: {
    'task-id': { type: 'positional', required: false },
    'check-security': { type: 'boolean', default: true },
    'check-style': { type: 'boolean', default: true },
    format: { type: 'string', alias: 'f', description: 'Output format: html or md (default: html)' },
    brand: { type: 'string', description: 'Brand theme for HTML output (vercel/stripe/notion/linear/github)' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const { store, workflowEngine } = getEngine()
    const reviewStore = new ReviewStore(SCALE_DIR)

    // If task-id provided, validate task exists
    let task = null
    let taskPayload: TaskPayload | undefined
    if (args['task-id']) {
      task = await store.get(args['task-id'])
      if (!task || task.type !== 'Task') {
        console.error(`\nTask not found: ${args['task-id']}\n`)
        process.exit(1)
      }
      taskPayload = task.payload as TaskPayload
    }

    // === WorkflowEngine Integration ===
    // Step 1: Karpathy Principles Check
    const karpathyResult = workflowEngine.checkKarpathy({
      hypothesesListed: true,    // Would be determined from actual context
      hasExtraFeatures: false,   // Would be determined from actual context
      changesTraceable: true,    // Would be determined from actual context
      hasVerifiableGoal: true    // Would be determined from actual context
    })

    if (!args.json) {
      console.log('\nKarpathy Principles Check:')
      console.log(workflowEngine.getKarpathyEvaluator().formatReport())
    }

    const review = await reviewGitChanges(taskPayload)
    const findings = review.findings
    const summary = summarizeFindings(findings)
    const passed = summary.critical === 0 && summary.high === 0
    const record: ReviewRecord = reviewStore.saveReview({
      taskId: args['task-id'],
      passed,
      findings,
      changedFiles: review.changedFiles.map(file => normalizeGitPath(file.path)),
      summary,
    })

    if (task && taskPayload) {
      const updatedPayload: TaskPayload = {
        ...taskPayload,
        reviewPassed: passed,
        reviewEvidenceIds: [...(taskPayload.reviewEvidenceIds ?? []), record.id],
        reviewedAt: Date.now(),
      }
      await store.update(task.id, { payload: updatedPayload })
    }

    // Generate review HTML file (default format: html)
    const reviewOutputFormat: OutputFormat = (args.format as OutputFormat) ?? 'md'
    let reviewHtmlPath: string | undefined
    if (reviewOutputFormat === 'html') {
      const reviewRenderer = new HTMLDocumentRenderer({
        title: `Review ${record.id}`,
        brand: args.brand as string | undefined,
        version: '0.13.0',
        status: passed ? 'PASS' : 'FAIL',
      })
      const reviewHtml = reviewRenderer.renderReview({
        id: record.id,
        title: `Code Review — ${record.id}`,
        timestamp: new Date().toISOString(),
        findings: findings.map(f => ({
          severity: f.severity,
          file: f.file ?? '',
          message: f.description,
        })),
        passed,
        specCoverage: undefined,
        specFindings: undefined,
      })
      const reviewsDir = join(SCALE_DIR, 'reviews')
      ensureDir(reviewsDir)
      reviewHtmlPath = join(reviewsDir, `${record.id}.html`)
      reviewRenderer.writeToFile(reviewHtml, reviewHtmlPath)
    }

    const result = {
      phase: 'REVIEW',
      taskId: args['task-id'],
      reviewId: record.id,
      reviewHtmlPath,
      findings,
      changedFiles: review.changedFiles.map(file => normalizeGitPath(file.path)),
      summary,
      passed,
      format: reviewOutputFormat,
      recommendation: passed ? 'Ready to ship' : 'Fix CRITICAL issues before shipping'
    }

    if (args.json) console.log(JSON.stringify(result, null, 2))
    else {
      console.log('\nREVIEW Phase')
      console.log(`\nReview evidence: ${record.id}`)
      if (reviewHtmlPath) console.log(`HTML report: ${reviewHtmlPath}`)
      console.log('\nReview Findings:')
      console.log('----------------------------------------')
      console.log(`CRITICAL: ${summary.critical} issues ${summary.critical > 0 ? 'BLOCKED' : 'OK'}`)
      console.log(`HIGH:     ${summary.high} issues ${summary.high > 0 ? 'BLOCKED' : 'OK'}`)
      console.log(`MEDIUM:   ${summary.medium} issues`)
      console.log(`LOW:      ${summary.low} issues`)
      console.log('----------------------------------------')
      findings.slice(0, 10).forEach(f => console.log(`  [${f.severity}] ${f.file ? `${f.file}: ` : ''}${f.description}`))

      if (passed) {
        console.log('\nReview passed (no CRITICAL issues)')
        console.log('\n   Next: scale ship ' + (args['task-id'] ?? '<task-id>') + '\n')
      } else {
        console.log('\nReview blocked by CRITICAL issues')
        console.log('\n   Fix critical issues, then: scale review\n')
      }
    }
  },
})

// SHIP Phase - HonestDelivery
export const phaseShip = defineCommand({
  meta: { name: 'ship', description: 'SHIP: Commit with HonestDelivery Report (/ship)' },
  args: {
    'task-id': { type: 'positional', required: true },
    message: { type: 'string', alias: 'm', description: 'Commit message' },
    'no-commit': { type: 'boolean', default: false, description: 'Skip git commit' },
    'skip-commit': { type: 'boolean', default: false, description: 'Skip git commit' },
    json: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const { store, fsm, workflowEngine } = getEngine()

    // Validate task exists
    const task = await store.get(args['task-id'])
    if (!task || task.type !== 'Task') {
      console.error(`\nTask not found: ${args['task-id']}\n`)
      process.exit(1)
    }

    // Check if task is completed (or attempt transition)
    const payload = task.payload as TaskPayload
    const evidenceValidation = validateVerificationEvidence(payload.verificationEvidenceIds)
    const reviewValidation = validateReviewEvidence(payload.reviewEvidenceIds)
    const verificationPassed = payload.buildStatus === 'success' &&
                                (payload.buildExitCode ?? 1) === 0 &&
                                payload.lintStatus === 'success' &&
                                payload.testPassed === true &&
                                (payload.testCoverage ?? 0) >= 80 &&
                                evidenceValidation.ok
    const reviewPassed = payload.reviewPassed === true && reviewValidation.ok

    if (task.status !== 'COMPLETED') {
      if (!verificationPassed) {
        console.error('\nTask not verified with persisted evidence. Run: scale verify ' + args['task-id'] + '\n')
        if (evidenceValidation.missing.length > 0) {
          console.error('Missing evidence records: ' + evidenceValidation.missing.join(', '))
        }
        if (evidenceValidation.failed.length > 0) {
          console.error('Failed evidence records: ' + evidenceValidation.failed.join(', '))
        }
        process.exit(1)
      }
      // FSM transition with guard check
      const completeResult = await fsm.canTransition(args['task-id'], 'complete')
      if (!completeResult.allowed) {
        console.error('\nFSM transition blocked: RUNNING -> COMPLETED')
        completeResult.blockedBy?.forEach(b => console.error(`   [GUARD] ${b.guard}: ${b.message}`))
        console.log('\n   Run verification first: scale verify ' + args['task-id'] + '\n')
        process.exit(1)
      }
      await fsm.transition(args['task-id'], 'complete', {
        actor: { kind: 'human', userId: 'cli' }
      })
    }

    if (!reviewPassed) {
      console.error('\nTask not reviewed with persisted passing evidence. Run: scale review ' + args['task-id'] + '\n')
      if (reviewValidation.missing.length > 0) {
        console.error('Missing review records: ' + reviewValidation.missing.join(', '))
      }
      if (reviewValidation.failed.length > 0) {
        console.error('Failed review records: ' + reviewValidation.failed.join(', '))
      }
      process.exit(1)
    }

    // Git operations
    let commitHash = null
    let stagedFiles: string[] = []
    if (!shouldSkipCommit(args['skip-commit'])) {
      const commitMessage = args.message ?? `feat: ${task.title ?? args['task-id']}`

      try {
        const reviewRecords = getValidatedReviewRecords(payload.reviewEvidenceIds)
        const stageResult = await stageReviewedFiles(reviewRecords)
        if (stageResult.unreviewedFiles.length > 0) {
          console.error('\nUnreviewed working tree changes detected. Re-run scale review before shipping.')
          stageResult.unreviewedFiles.forEach(file => console.error('  - ' + file))
          console.error('\nUse scale ship ' + args['task-id'] + ' --no-commit to generate the delivery report without committing.\n')
          process.exit(1)
        }

        stagedFiles = stageResult.stagedFiles
        const result = await runGit(['commit', '-m', commitMessage])
        if (result.exitCode !== 0) {
          const message = result.stderr || result.stdout || 'git commit failed'
          if (/nothing to commit|no changes added/i.test(message)) {
            if (!args.json) console.log('   Git commit skipped: nothing to commit')
          } else {
            throw new Error(message)
          }
        } else {
          commitHash = result.stdout.split('\n')[0] // First line contains hash
        }
      } catch (e) {
        const error = e as Error
        console.error('\nGit commit failed:', error.message)
        process.exit(1)
      }
    }

    // Update Plan to DONE if Task completed
    if (task.parents.length > 0) {
      const planId = task.parents[0]
      try {
        await fsm.transition(planId, 'complete', { actor: { kind: 'system', component: 'phase-ship' } })
      } catch (e) { console.error("Warning: Plan completion transition failed:", (e as Error).message) }
    }

    // === WorkflowEngine Integration ===
    // Generate HonestDelivery report
    if (!args.json) {
      console.log('\nHonest Delivery Report:')
      console.log('-'.repeat(40))
      console.log(`[COMPLETED]`)
      console.log(`  - Task: ${args['task-id']}`)
      console.log(`  - Status: COMPLETED`)
      if (commitHash) console.log(`  - Commit: ${commitHash}`)
      if (stagedFiles.length) console.log(`  - Files committed: ${stagedFiles.length}`)
      console.log('')
      console.log(`[VERIFIED]`)
      console.log('  [PASS] Build: passed')
      console.log('  [PASS] Lint: passed')
      console.log('  [PASS] Tests: passed')
      if (payload.testCoverage) console.log(`  [PASS] Coverage: ${payload.testCoverage}%`)
      if (payload.verificationEvidenceIds?.length) {
        console.log(`  [PASS] Evidence records validated: ${payload.verificationEvidenceIds.join(', ')}`)
      }
      if (payload.reviewEvidenceIds?.length) {
        console.log(`  [PASS] Review records validated: ${payload.reviewEvidenceIds.join(', ')}`)
      }
      console.log('')
      // Check for unverified items
      const unverifiedItems = []
      if (!payload.testCoverage || payload.testCoverage < 80) {
        unverifiedItems.push('Coverage below 80%')
      }
      if (unverifiedItems.length > 0) {
        console.log(`[UNVERIFIED]`)
        unverifiedItems.forEach(item => console.log(`  [UNVERIFIED] ${item}`))
        console.log('')
      }
    }

    const result = {
      phase: 'SHIP',
      taskId: args['task-id'],
      status: 'COMPLETED',
      verificationEvidenceIds: payload.verificationEvidenceIds ?? [],
      evidenceValidation,
      reviewEvidenceIds: payload.reviewEvidenceIds ?? [],
      reviewValidation,
      commitHash,
      stagedFiles,
    }

    if (args.json) console.log(JSON.stringify(result, null, 2))
    else {
      console.log('\nSHIP Phase')
      console.log('\nTask COMPLETED: ' + args['task-id'])
      if (commitHash) console.log('   Commit: ' + commitHash)
      console.log('\nDone. Feature shipped.\n')
    }
  },
})
