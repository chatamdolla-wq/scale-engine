import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PassThrough } from 'node:stream'
import {
  getOnboardQuestions,
  recommendProfile,
  runOnboardWizard,
  ONBOARD_QUESTIONS,
  type OnboardAnswer,
} from '../../src/api/onboard.js'

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'scale-onboard-'))
}

describe('OnboardWizard', () => {
  it('returns 4 questions', () => {
    const questions = getOnboardQuestions()
    expect(questions).toHaveLength(4)
    expect(questions.map(q => q.id)).toEqual(['experience', 'project-stage', 'team-size', 'priority'])
    for (const q of questions) {
      expect(q.options.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('recommends minimal for beginner + prototype + solo + speed', () => {
    const answers: OnboardAnswer[] = [
      { questionId: 'experience', value: 'beginner' },
      { questionId: 'project-stage', value: 'prototype' },
      { questionId: 'team-size', value: 'solo' },
      { questionId: 'priority', value: 'speed' },
    ]
    const dir = makeTmpDir()
    try {
      const classification = { language: 'unknown' as const, isMonorepo: false, isLibrary: false, recommendedPack: 'standard', recommendedProfile: 'minimal' as const }
      const result = recommendProfile(answers, classification)
      expect(result.profileId).toBe('minimal')
      expect(result.confidence).toBeGreaterThan(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('recommends advanced for advanced + production + large + quality', () => {
    const answers: OnboardAnswer[] = [
      { questionId: 'experience', value: 'advanced' },
      { questionId: 'project-stage', value: 'production' },
      { questionId: 'team-size', value: 'large' },
      { questionId: 'priority', value: 'quality' },
    ]
    const classification = { language: 'unknown' as const, isMonorepo: false, isLibrary: false, recommendedPack: 'standard', recommendedProfile: 'critical' as const }
    const result = recommendProfile(answers, classification)
    expect(result.profileId).toBe('advanced')
  })

  it('recommends standard for balanced answers', () => {
    const answers: OnboardAnswer[] = [
      { questionId: 'experience', value: 'intermediate' },
      { questionId: 'project-stage', value: 'development' },
      { questionId: 'team-size', value: 'small' },
      { questionId: 'priority', value: 'balance' },
    ]
    const classification = { language: 'unknown' as const, isMonorepo: false, isLibrary: false, recommendedPack: 'standard', recommendedProfile: 'standard' as const }
    const result = recommendProfile(answers, classification)
    expect(result.profileId).toBe('standard')
  })

  it('runOnboardWizard returns recommendation with pre-supplied answers', async () => {
    const dir = makeTmpDir()
    try {
      const answers: OnboardAnswer[] = [
        { questionId: 'experience', value: 'intermediate' },
        { questionId: 'project-stage', value: 'development' },
        { questionId: 'team-size', value: 'small' },
        { questionId: 'priority', value: 'balance' },
      ]
      const result = await runOnboardWizard({ projectDir: dir, answers })
      expect(result.profileId).toBe('standard')
      expect(result.classification).toBeDefined()
      expect(result.nextSteps.length).toBeGreaterThan(0)
      expect(result.answers).toEqual(answers)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('runOnboardWizard interactively via stream', async () => {
    const dir = makeTmpDir()
    try {
      const input = new PassThrough()
      const output = new PassThrough()

      let outputData = ''
      output.on('data', (chunk: Buffer) => { outputData += chunk.toString() })

      // Answer: 2, 2, 2, 2 (all "standard" choices)
      const answers = ['2', '2', '2', '2']
      const promise = runOnboardWizard({ projectDir: dir, input, output, lang: 'zh' })

      for (const answer of answers) {
        input.write(answer + '\n')
        await new Promise(r => setTimeout(r, 50))
      }

      const result = await promise
      expect(result.profileId).toBe('standard')
      expect(outputData).toContain('SCALE Engine')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('exports ONBOARD_QUESTIONS constant', () => {
    expect(ONBOARD_QUESTIONS).toHaveLength(4)
    expect(ONBOARD_QUESTIONS[0].id).toBe('experience')
  })
})
