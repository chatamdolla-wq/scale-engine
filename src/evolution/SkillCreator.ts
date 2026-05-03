// SCALE Engine — Skill Creator
// Purpose: Convert verified patterns into reusable skills

import type { Pattern, IPatternExtractor } from './PatternExtractor.js'
import type { IEventBus } from '../core/eventBus.js'
import { logger } from '../core/logger.js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export interface SkillProposal {
  id: string
  name: string
  description: string
  triggers: string[]
  agents: string[]
  steps: SkillStep[]
  sourcePattern: string
  status: 'draft' | 'proposed' | 'approved' | 'published'
  createdAt: number
}

export interface SkillStep {
  phase: string
  actions: string[]
  checklist: string[]
}

export interface ISkillCreator {
  patternToSkill(pattern: Pattern): SkillProposal
  proposeToUser(skill: SkillProposal): Promise<boolean>
  publish(skill: SkillProposal, skillsDir: string): string
  getProposals(): SkillProposal[]
}

export class SkillCreator implements ISkillCreator {
  private proposals: Map<string, SkillProposal> = new Map()
  private seq = 0

  constructor(
    private extractor: IPatternExtractor,
    private eventBus: IEventBus,
  ) {}

  patternToSkill(pattern: Pattern): SkillProposal {
    const skill: SkillProposal = {
      id: 'SKILL-' + Date.now() + '-' + (++this.seq).toString().padStart(3, '0'),
      name: this.skillNameFromPattern(pattern),
      description: pattern.description,
      triggers: this.inferTriggers(pattern),
      agents: this.inferAgents(pattern),
      steps: this.convertSteps(pattern.steps),
      sourcePattern: pattern.id,
      status: 'draft',
      createdAt: Date.now(),
    }

    this.proposals.set(skill.id, skill)
    logger.info({ skillId: skill.id, patternId: pattern.id }, 'Pattern converted to skill draft')
    return skill
  }

  async proposeToUser(skill: SkillProposal): Promise<boolean> {
    skill.status = 'proposed'
    this.eventBus.emit('skill.proposed', { skillId: skill.id, name: skill.name })
    
    // In real implementation, this would wait for user approval
    // For now, log the proposal
    logger.info({ skillId: skill.id }, 'Skill proposed for user approval')
    return true
  }

  publish(skill: SkillProposal, skillsDir: string): string {
    if (skill.status !== 'approved') {
      logger.warn({ skillId: skill.id }, 'Skill not approved - cannot publish')
      throw new Error('Skill must be approved before publishing')
    }

    mkdirSync(skillsDir, { recursive: true })
    const skillDir = join(skillsDir, skill.name.toLowerCase().replace(/\s+/g, '-'))
    mkdirSync(skillDir, { recursive: true })

    const skillPath = join(skillDir, 'SKILL.md')
    const content = this.generateSkillMarkdown(skill)
    writeFileSync(skillPath, content, 'utf-8')

    skill.status = 'published'
    this.eventBus.emit('skill.published', { skillId: skill.id, path: skillPath })
    logger.info({ skillId: skill.id, path: skillPath }, 'Skill published')
    return skillPath
  }

  getProposals(): SkillProposal[] {
    return Array.from(this.proposals.values())
  }

  // Private helpers

  private skillNameFromPattern(pattern: Pattern): string {
    return pattern.name.replace(' Pattern', '').replace(' Workflow', '')
  }

  private inferTriggers(pattern: Pattern): string[] {
    const triggers: string[] = []
    for (const step of pattern.steps) {
      const words = step.action.toLowerCase().split(/\s+/)
      triggers.push(...words.filter(w => w.length > 3))
    }
    return [...new Set(triggers)].slice(0, 5)
  }

  private inferAgents(pattern: Pattern): string[] {
    const agentMap: Record<string, string[]> = {
      plan: ['planner'],
      implement: ['implementer'],
      test: ['tester'],
      review: ['reviewer'],
      debug: ['debugger'],
      document: ['doc-writer'],
    }

    const agents: string[] = []
    for (const step of pattern.steps) {
      for (const [keyword, agentList] of Object.entries(agentMap)) {
        if (step.action.toLowerCase().includes(keyword)) {
          agents.push(...agentList)
        }
      }
    }
    return [...new Set(agents)]
  }

  private convertSteps(patternSteps: any[]): SkillStep[] {
    const phases = ['Setup', 'Execute', 'Verify']
    return patternSteps.map((ps, i) => ({
      phase: phases[i] ?? 'Step ' + (i + 1),
      actions: [ps.action],
      checklist: ['Verify ' + ps.expectedOutcome],
    }))
  }

  private generateSkillMarkdown(skill: SkillProposal): string {
    let md = '---\n'
    md += 'name: ' + skill.name + '\n'
    md += 'version: 1.0.0\n'
    md += 'description: ' + skill.description + '\n'
    md += 'triggers:\n'
    for (const t of skill.triggers) md += '  - ' + t + '\n'
    md += 'agents:\n'
    for (const a of skill.agents) md += '  - ' + a + '\n'
    md += '---\n\n'
    md += '# ' + skill.name + '\n\n'
    md += 'Auto-generated from pattern: ' + skill.sourcePattern + '\n\n'

    for (const step of skill.steps) {
      md += '## ' + step.phase + '\n\n'
      for (const action of step.actions) md += '1. ' + action + '\n'
      md += '\n**Checklist:**\n'
      for (const item of step.checklist) md += '- [ ] ' + item + '\n'
      md += '\n'
    }

    return md
  }
}
