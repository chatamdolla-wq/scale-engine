import { defineCommand } from 'citty'
import { runOnboardWizard, getOnboardQuestions, recommendProfile, type OnboardAnswer } from '../api/onboard.js'
import { classifyProject, detectPlatform } from '../api/quickstart.js'
import { listProfiles } from '../config/profiles.js'
import { logger } from '../core/logger.js'

export const onboardCommand = defineCommand({
  meta: {
    name: 'onboard',
    description: 'Interactive onboarding wizard — answer 4 questions, get a personalized profile recommendation',
  },
  args: {
    dir: { type: 'string', default: process.cwd(), description: 'Project directory' },
    json: { type: 'boolean', default: false, description: 'Output recommendation as JSON' },
    questions: { type: 'boolean', default: false, description: 'List questions only (for automation)' },
    lang: { type: 'string', default: 'zh', description: 'Language (zh|en)' },
  },
  async run({ args }) {
    if (args.questions) {
      const questions = getOnboardQuestions()
      console.log(JSON.stringify(questions, null, 2))
      return
    }

    const recommendation = await runOnboardWizard({
      projectDir: args.dir as string,
      lang: args.lang as 'zh' | 'en',
    })

    if (args.json) {
      console.log(JSON.stringify(recommendation, null, 2))
      return
    }

    console.log('\n🎯 推荐配置\n')
    console.log(`  Profile:    ${recommendation.profileName} (${recommendation.profileId})`)
    console.log(`  原因:       ${recommendation.reason}`)
    console.log(`  置信度:     ${Math.round(recommendation.confidence * 100)}%`)
    console.log(`  治理包:     ${recommendation.governancePack}`)
    console.log(`  项目类型:   ${recommendation.classification.language}${recommendation.classification.framework ? ` (${recommendation.classification.framework})` : ''}`)
    console.log(`  平台:       ${recommendation.platform ?? '未检测到'}`)

    console.log('\n  下一步:')
    for (const step of recommendation.nextSteps) {
      console.log(`    → ${step}`)
    }
    console.log('')
  },
})
