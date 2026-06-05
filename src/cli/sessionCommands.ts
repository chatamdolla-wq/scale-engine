// SCALE Engine — Session Commands
import { defineCommand } from 'citty'
import { getEngine } from './engineBootstrap.js'

export const sessionStart = defineCommand({
  meta: { name: 'start', description: 'Start a new session' },
  args: {
    agent: { type: 'string', default: 'claude-code' },
    'session-id': { type: 'string', required: true },
  },
  async run({ args }) {
    const { eventBus } = getEngine()
    eventBus.emit('session.started', {
      agent: args.agent,
      sessionId: args['session-id'],
      startedAt: Date.now(),
    }, { sessionId: args['session-id'] })
    console.log(JSON.stringify({ ok: true, sessionId: args['session-id'], agent: args.agent }))
  },
})

export const sessionEnd = defineCommand({
  meta: { name: 'end', description: 'End current session' },
  args: {
    'session-id': { type: 'string', required: true },
  },
  async run({ args }) {
    const { eventBus } = getEngine()
    eventBus.emit('session.ended', {
      sessionId: args['session-id'],
      endedAt: Date.now(),
    }, { sessionId: args['session-id'] })
    console.log(JSON.stringify({ ok: true, sessionId: args['session-id'] }))
  },
})

export const sessionCommand = defineCommand({
  meta: { name: 'session', description: 'Session lifecycle' },
  subCommands: { start: sessionStart, end: sessionEnd },
})
